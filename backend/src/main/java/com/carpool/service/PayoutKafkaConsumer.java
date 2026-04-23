package com.carpool.service;

import com.carpool.config.CashfreeProperties;
import com.carpool.dto.PayoutEventMessage;
import com.carpool.model.DriverBankAccount;
import com.carpool.model.PayoutRequest;
import com.carpool.model.WalletSettlement;
import com.carpool.repository.DriverBankAccountRepository;
import com.carpool.repository.PayoutRequestRepository;
import com.carpool.repository.WalletSettlementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutKafkaConsumer {

    private final PayoutRequestRepository payoutRequestRepository;
    private final WalletSettlementRepository settlementRepository;
    private final DriverBankAccountRepository bankAccountRepository;
    private final PayoutKafkaProducer producer;
    private final CashfreeProperties cashfree;
    private final WebClient.Builder webClientBuilder;

    private static final int MAX_RETRIES = 3;

    @KafkaListener(topics = {"payout_requests", "payout_retry"}, groupId = "payout-processor")
    @Transactional
    public void processPayoutEvent(PayoutEventMessage msg) {
        log.info("Processing payout event: requestId={} retryCount={}", msg.getRequestId(), msg.getRetryCount());

        Optional<PayoutRequest> existing = payoutRequestRepository.findByRequestId(msg.getRequestId());
        if (existing.isEmpty()) {
            log.warn("PayoutRequest not found for requestId={}, skipping", msg.getRequestId());
            return;
        }

        PayoutRequest payoutRequest = existing.get();

        // Idempotency: skip if already succeeded
        if ("SUCCESS".equals(payoutRequest.getStatus())) {
            log.info("PayoutRequest {} already SUCCESS, skipping", msg.getRequestId());
            return;
        }

        payoutRequest.setStatus("PROCESSING");
        payoutRequestRepository.save(payoutRequest);

        try {
            // Step 1: ensure beneficiary registered in Cashfree v2
            DriverBankAccount account = bankAccountRepository.findByDriverId(payoutRequest.getDriver().getId())
                    .orElseThrow(() -> new RuntimeException("Bank account not found for driver"));
            ensureBeneficiaryV2(msg.getBeneficiaryId(), account, msg.getDriverEmail());

            // Step 2: initiate transfer
            String cfTransferId = initiateTransferV2(msg);

            // Step 3: update to PROCESSING (webhook will confirm SUCCESS/FAILED)
            payoutRequest.setCfTransferId(cfTransferId);
            payoutRequest.setStatus("PROCESSING");
            payoutRequestRepository.save(payoutRequest);

            log.info("Transfer initiated: requestId={} cfTransferId={}", msg.getRequestId(), cfTransferId);

        } catch (WebClientResponseException e) {
            handleFailure(msg, payoutRequest, e.getStatusCode().is5xxServerError(), e.getMessage());
        } catch (Exception e) {
            boolean retryable = e.getMessage() != null && (
                    e.getMessage().contains("timeout") || e.getMessage().contains("connection") || e.getMessage().contains("5xx"));
            handleFailure(msg, payoutRequest, retryable, e.getMessage());
        }
    }

    private void handleFailure(PayoutEventMessage msg, PayoutRequest payoutRequest, boolean retryable, String reason) {
        if (retryable && msg.getRetryCount() < MAX_RETRIES) {
            int nextRetry = msg.getRetryCount() + 1;
            log.warn("Retryable failure for requestId={}, scheduling retry {}/{}", msg.getRequestId(), nextRetry, MAX_RETRIES);
            payoutRequest.setRetryCount(nextRetry);
            payoutRequest.setStatus("CREATED");
            payoutRequestRepository.save(payoutRequest);

            PayoutEventMessage retry = PayoutEventMessage.builder()
                    .eventId(msg.getEventId()).requestId(msg.getRequestId())
                    .walletSettlementId(msg.getWalletSettlementId()).driverId(msg.getDriverId())
                    .driverEmail(msg.getDriverEmail()).amount(msg.getAmount())
                    .beneficiaryId(msg.getBeneficiaryId()).retryCount(nextRetry)
                    .build();
            producer.publishRetry(retry);
        } else {
            log.error("Payout failed (max retries or fatal): requestId={} reason={}", msg.getRequestId(), reason);
            payoutRequest.setStatus("FAILED");
            payoutRequest.setFailureReason(reason);
            payoutRequestRepository.save(payoutRequest);

            settlementRepository.findById(msg.getWalletSettlementId()).ifPresent(s -> {
                s.setStatus("FAILED");
                s.setFailureReason(reason);
                settlementRepository.save(s);
            });

            producer.publishDlq(msg);
        }
    }

    private void ensureBeneficiaryV2(String beneId, DriverBankAccount account, String driverEmail) {
        Map<String, Object> instrumentDetails = new LinkedHashMap<>();
        instrumentDetails.put("bank_account_number", account.getAccountNumber());
        instrumentDetails.put("bank_ifsc", account.getIfscCode());

        Map<String, Object> contactDetails = new LinkedHashMap<>();
        contactDetails.put("beneficiary_email", driverEmail);
        contactDetails.put("beneficiary_phone", "9999999999");
        contactDetails.put("beneficiary_country_code", "+91");
        contactDetails.put("beneficiary_address", "India");
        contactDetails.put("beneficiary_city", "India");
        contactDetails.put("beneficiary_state", "India");
        contactDetails.put("beneficiary_postal_code", "000000");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("beneficiary_id", beneId);
        body.put("beneficiary_name", account.getAccountHolderName());
        body.put("beneficiary_instrument_details", instrumentDetails);
        body.put("beneficiary_contact_details", contactDetails);

        try {
            Map<?, ?> resp = buildPayoutsClient()
                    .post().uri("/v2/beneficiary")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            log.info("Beneficiary v2 response: {}", resp);
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().value() == 409) {
                log.info("Beneficiary {} already exists, continuing", beneId);
            } else {
                log.warn("Beneficiary v2 error (non-fatal): {}", e.getMessage());
            }
        } catch (Exception e) {
            log.warn("Beneficiary v2 registration failed (non-fatal): {}", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private String initiateTransferV2(PayoutEventMessage msg) {
        Map<String, Object> beneficiaryDetails = new LinkedHashMap<>();
        beneficiaryDetails.put("beneficiary_id", msg.getBeneficiaryId());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("transfer_id", msg.getRequestId());
        body.put("transfer_amount", msg.getAmount());
        body.put("transfer_currency", "INR");
        body.put("transfer_mode", "banktransfer");
        body.put("beneficiary_details", beneficiaryDetails);
        body.put("transfer_remarks", "Carpool wallet settlement");

        Map<String, Object> response = (Map<String, Object>) buildPayoutsClient()
                .post().uri("/v2/transfers")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (response == null) throw new RuntimeException("Empty response from Cashfree Payouts v2");

        log.info("Cashfree v2 transfer response: {}", response);

        Object status = response.get("status");
        if ("ERROR".equalsIgnoreCase(String.valueOf(status))) {
            throw new RuntimeException("Cashfree Payouts v2 error: " + response.get("message") + " (code: " + response.get("subCode") + ")");
        }

        return msg.getRequestId();
    }

    private WebClient buildPayoutsClient() {
        String baseUrl = cashfree.getBaseUrl().contains("sandbox")
                ? "https://sandbox.cashfree.com/payout"
                : "https://api.cashfree.com/payout";

        return webClientBuilder.baseUrl(baseUrl)
                .defaultHeader("x-client-id", cashfree.getPayoutsAppId())
                .defaultHeader("x-client-secret", cashfree.getPayoutsSecretKey())
                .defaultHeader("x-api-version", "2024-01-01")
                .defaultHeader("Content-Type", "application/json")
                .build();
    }
}
