package com.carpool.service;

import com.carpool.config.CashfreeProperties;
import com.carpool.model.PayoutRequest;
import com.carpool.model.Wallet;
import com.carpool.repository.PayoutRequestRepository;
import com.carpool.repository.WalletRepository;
import com.carpool.repository.WalletSettlementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class PayoutReconciliationJob {

    private final PayoutRequestRepository payoutRequestRepository;
    private final WalletSettlementRepository settlementRepository;
    private final WalletRepository walletRepository;
    private final CashfreeProperties cashfree;
    private final WebClient.Builder webClientBuilder;

    // Run every 30 minutes
    @Scheduled(fixedDelay = 1_800_000)
    @Transactional
    public void reconcile() {
        List<PayoutRequest> processing = payoutRequestRepository.findByStatusIn(List.of("PROCESSING", "CREATED"));
        if (processing.isEmpty()) {
            log.debug("Reconciliation: no pending payout requests");
            return;
        }

        log.info("Reconciliation: checking {} payout request(s)", processing.size());
        WebClient client = buildPayoutsClient();

        for (PayoutRequest pr : processing) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> resp = (Map<String, Object>) client
                        .get().uri("/transfers/" + pr.getRequestId())
                        .retrieve()
                        .bodyToMono(Map.class)
                        .block();

                if (resp == null) continue;

                Object statusObj = resp.get("transfer_status");
                String transferStatus = statusObj != null ? statusObj.toString() : "";
                log.info("Reconciliation: requestId={} transferStatus={}", pr.getRequestId(), transferStatus);

                if ("SUCCESS".equalsIgnoreCase(transferStatus)) {
                    applySuccess(pr);
                } else if ("FAILED".equalsIgnoreCase(transferStatus) || "REVERSED".equalsIgnoreCase(transferStatus)) {
                    applyFailed(pr, "Cashfree status: " + transferStatus);
                }
            } catch (Exception e) {
                log.warn("Reconciliation check failed for requestId={}: {}", pr.getRequestId(), e.getMessage());
            }
        }
    }

    private void applySuccess(PayoutRequest pr) {
        pr.setStatus("SUCCESS");
        payoutRequestRepository.save(pr);

        settlementRepository.findById(pr.getWalletSettlement().getId()).ifPresent(s -> {
            s.setStatus("SUCCESS");
            s.setCfTransferId(pr.getRequestId());
            settlementRepository.save(s);
        });

        log.info("Reconciliation SUCCESS: requestId={}", pr.getRequestId());
    }

    private void applyFailed(PayoutRequest pr, String reason) {
        pr.setStatus("FAILED");
        pr.setFailureReason(reason);
        payoutRequestRepository.save(pr);

        settlementRepository.findById(pr.getWalletSettlement().getId()).ifPresent(s -> {
            s.setStatus("FAILED");
            s.setFailureReason(reason);
            settlementRepository.save(s);
        });

        log.warn("Reconciliation FAILED: requestId={} reason={}", pr.getRequestId(), reason);
    }

    @SuppressWarnings("unchecked")
    private WebClient buildPayoutsClient() {
        String baseUrl = cashfree.getBaseUrl().contains("sandbox")
                ? "https://sandbox.cashfree.com/payout"
                : "https://api.cashfree.com/payout";

        WebClient authClient = webClientBuilder.baseUrl(baseUrl)
                .defaultHeader("X-Client-Id", cashfree.getPayoutsAppId())
                .defaultHeader("X-Client-Secret", cashfree.getPayoutsSecretKey())
                .build();

        Map<String, Object> authResp = (Map<String, Object>) authClient
                .post().uri("/v1/authorize")
                .retrieve().bodyToMono(Map.class).block();

        if (authResp == null || !"SUCCESS".equalsIgnoreCase(String.valueOf(authResp.get("status")))) {
            log.warn("Reconciliation: Payouts authorization failed: {}", authResp);
            throw new RuntimeException("Payouts auth failed");
        }

        String token = String.valueOf(((Map<?, ?>) authResp.get("data")).get("token"));

        return webClientBuilder.baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + token)
                .defaultHeader("x-api-version", "2024-01-01")
                .build();
    }
}
