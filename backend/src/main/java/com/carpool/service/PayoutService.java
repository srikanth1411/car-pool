package com.carpool.service;

import com.carpool.config.CashfreeProperties;
import com.carpool.dto.request.SaveBankAccountRequest;
import com.carpool.dto.response.SettlementResponse;
import com.carpool.exception.BadRequestException;
import com.carpool.exception.ResourceNotFoundException;
import com.carpool.model.*;
import com.carpool.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final DriverBankAccountRepository bankAccountRepository;
    private final WalletSettlementRepository settlementRepository;
    private final PayoutRequestRepository payoutRequestRepository;
    private final CashfreeProperties cashfree;
    private final WebClient.Builder webClientBuilder;

    // ─── Save / update bank account ────────────────────────────────────────────

    @Transactional
    public SettlementResponse saveBankAccount(String driverEmail, SaveBankAccountRequest req) {
        User driver = userRepository.findById(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        DriverBankAccount account = bankAccountRepository.findByDriverId(driver.getId())
                .orElseGet(() -> DriverBankAccount.builder()
                        .id(UUID.randomUUID().toString())
                        .driver(driver)
                        .build());

        account.setAccountHolderName(req.getAccountHolderName());
        account.setAccountNumber(req.getAccountNumber());
        account.setIfscCode(req.getIfscCode().toUpperCase());
        account.setBankName(req.getBankName());
        account.setVerified(false);
        account.setCfBeneficiaryId(null);
        bankAccountRepository.save(account);

        return toSettlementResponse(account, null);
    }

    // ─── Get saved bank account ─────────────────────────────────────────────────

    public SettlementResponse getBankAccount(String driverEmail) {
        User driver = userRepository.findById(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        DriverBankAccount account = bankAccountRepository.findByDriverId(driver.getId()).orElse(null);
        return toSettlementResponse(account, null);
    }

    // ─── Settle Now ─────────────────────────────────────────────────────────────

    @Transactional
    public SettlementResponse settleNow(String driverEmail) {
        User driver = userRepository.findById(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Wallet wallet = walletRepository.findByUserId(driver.getId())
                .orElseThrow(() -> new BadRequestException("No wallet found"));

        if (wallet.getBalance().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("No balance to settle");
        }

        DriverBankAccount account = bankAccountRepository.findByDriverId(driver.getId())
                .orElseThrow(() -> new BadRequestException("Please add your bank account details before settling"));

        if (!payoutsConfigured()) {
            throw new BadRequestException("Cashfree Payouts not configured. Set CASHFREE_PAYOUTS_APP_ID and CASHFREE_PAYOUTS_SECRET_KEY.");
        }

        BigDecimal amount = wallet.getBalance();

        // Ensure beneficiary ID
        if (account.getCfBeneficiaryId() == null) {
            String beneId = "bene_" + driver.getId().replace("-", "").substring(0, 12);
            account.setCfBeneficiaryId(beneId);
            bankAccountRepository.save(account);
        }

        // Idempotency key for this transfer
        String requestId = "pay_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);

        // Create settlement record
        WalletSettlement settlement = WalletSettlement.builder()
                .id(UUID.randomUUID().toString())
                .driver(driver)
                .wallet(wallet)
                .amount(amount)
                .status("PENDING")
                .build();
        settlementRepository.save(settlement);
        settlementRepository.flush();

        // Track in payout_requests for reconciliation
        PayoutRequest payoutRequest = PayoutRequest.builder()
                .id(UUID.randomUUID().toString())
                .walletSettlement(settlement)
                .driver(driver)
                .amount(amount)
                .requestId(requestId)
                .status("CREATED")
                .beneficiaryId(account.getCfBeneficiaryId())
                .build();
        payoutRequestRepository.save(payoutRequest);

        try {
            WebClient client = buildPayoutsClient();

            // Register beneficiary in Cashfree v2
            ensureBeneficiary(client, account, driver.getEmail());

            // Initiate transfer
            initiateTransfer(client, requestId, amount, account.getCfBeneficiaryId());

            // Mark PROCESSING — webhook/reconciliation will confirm final state
            settlement.setStatus("PROCESSING");
            settlement.setCfTransferId(requestId);
            settlementRepository.save(settlement);

            payoutRequest.setStatus("PROCESSING");
            payoutRequest.setCfTransferId(requestId);
            payoutRequestRepository.save(payoutRequest);

            // Deduct wallet balance optimistically
            wallet.setBalance(BigDecimal.ZERO);
            walletRepository.save(wallet);

            log.info("Payout initiated: requestId={} amount={} driver={}", requestId, amount, driverEmail);

        } catch (Exception e) {
            settlement.setStatus("FAILED");
            settlement.setFailureReason(e.getMessage());
            settlementRepository.save(settlement);

            payoutRequest.setStatus("FAILED");
            payoutRequest.setFailureReason(e.getMessage());
            payoutRequestRepository.save(payoutRequest);

            log.error("Payout failed: requestId={} error={}", requestId, e.getMessage());
        }

        return toSettlementResponse(account, settlement);
    }

    // ─── Cashfree Payouts v2 webhook ────────────────────────────────────────────

    @Transactional
    public void handlePayoutWebhook(String rawBody) {
        log.info("Payout webhook received: {}", rawBody);
        String transferId = extractField(rawBody, "transfer_id");
        String transferStatus = extractField(rawBody, "transfer_status");

        if (transferId == null || transferStatus == null) {
            log.warn("Payout webhook missing fields: {}", rawBody);
            return;
        }

        payoutRequestRepository.findByRequestId(transferId).ifPresent(pr -> {
            if ("SUCCESS".equals(pr.getStatus())) return;

            WalletSettlement settlement = pr.getWalletSettlement();

            if ("SUCCESS".equalsIgnoreCase(transferStatus)) {
                pr.setStatus("SUCCESS");
                payoutRequestRepository.save(pr);
                settlement.setStatus("SUCCESS");
                settlement.setCfTransferId(transferId);
                settlementRepository.save(settlement);
                log.info("Payout webhook SUCCESS: transferId={}", transferId);

            } else if ("FAILED".equalsIgnoreCase(transferStatus) || "REVERSED".equalsIgnoreCase(transferStatus)) {
                pr.setStatus("FAILED");
                pr.setFailureReason("Cashfree status: " + transferStatus);
                payoutRequestRepository.save(pr);
                settlement.setStatus("FAILED");
                settlement.setFailureReason("Cashfree status: " + transferStatus);
                settlementRepository.save(settlement);

                // Refund wallet on failure
                walletRepository.findByUserId(pr.getDriver().getId()).ifPresent(w -> {
                    w.setBalance(w.getBalance().add(pr.getAmount()));
                    walletRepository.save(w);
                });
                log.warn("Payout webhook FAILED: transferId={}", transferId);
            }
        });
    }

    // ─── Settlement history ─────────────────────────────────────────────────────

    public List<SettlementResponse> getSettlementHistory(String driverEmail) {
        User driver = userRepository.findById(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        DriverBankAccount account = bankAccountRepository.findByDriverId(driver.getId()).orElse(null);

        return settlementRepository.findByDriverIdOrderByCreatedAtDesc(driver.getId())
                .stream()
                .map(s -> toSettlementResponse(account, s))
                .toList();
    }

    // ─── Cashfree v2 helpers ─────────────────────────────────────────────────────

    private void ensureBeneficiary(WebClient client, DriverBankAccount account, String driverEmail) {
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
        body.put("beneficiary_id", account.getCfBeneficiaryId());
        body.put("beneficiary_name", account.getAccountHolderName());
        body.put("beneficiary_instrument_details", instrumentDetails);
        body.put("beneficiary_contact_details", contactDetails);

        try {
            Map<?, ?> resp = client.post().uri("/v2/beneficiary")
                    .bodyValue(body).retrieve().bodyToMono(Map.class).block();
            log.info("Beneficiary v2 response: {}", resp);
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().value() == 409) {
                log.info("Beneficiary {} already exists", account.getCfBeneficiaryId());
            } else {
                log.warn("Beneficiary v2 error: {} — {}", e.getStatusCode(), e.getResponseBodyAsString());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void initiateTransfer(WebClient client, String requestId, BigDecimal amount, String beneficiaryId) {
        Map<String, Object> beneficiaryDetails = new LinkedHashMap<>();
        beneficiaryDetails.put("beneficiary_id", beneficiaryId);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("transfer_id", requestId);
        body.put("transfer_amount", amount);
        body.put("transfer_currency", "INR");
        body.put("transfer_mode", "banktransfer");
        body.put("beneficiary_details", beneficiaryDetails);
        body.put("transfer_remarks", "Carpool wallet settlement");

        Map<String, Object> response = (Map<String, Object>) client
                .post().uri("/v2/transfers")
                .bodyValue(body).retrieve().bodyToMono(Map.class).block();

        log.info("Cashfree v2 transfer response: {}", response);

        if (response == null) throw new RuntimeException("Empty response from Cashfree Payouts v2");

        if ("ERROR".equalsIgnoreCase(String.valueOf(response.get("status")))) {
            throw new RuntimeException("Cashfree error: " + response.get("message") + " (code: " + response.get("subCode") + ")");
        }
    }

    @SuppressWarnings("unchecked")
    private WebClient buildPayoutsClient() {
        String baseUrl = cashfree.getBaseUrl().contains("sandbox")
                ? "https://sandbox.cashfree.com/payout"
                : "https://api.cashfree.com/payout";

        // Step 1: get Bearer token via v1/authorize (v2/authorize not supported on sandbox)
        WebClient authClient = webClientBuilder.baseUrl(baseUrl)
                .defaultHeader("X-Client-Id", cashfree.getPayoutsAppId())
                .defaultHeader("X-Client-Secret", cashfree.getPayoutsSecretKey())
                .defaultHeader("Content-Type", "application/json")
                .build();

        Map<String, Object> authResp = (Map<String, Object>) authClient
                .post().uri("/v1/authorize")
                .retrieve().bodyToMono(Map.class).block();

        log.info("Payouts authorize response: {}", authResp);

        if (authResp == null || !"SUCCESS".equalsIgnoreCase(String.valueOf(authResp.get("status")))) {
            throw new RuntimeException("Cashfree Payouts authorization failed: " + authResp);
        }

        String token = String.valueOf(((Map<?, ?>) authResp.get("data")).get("token"));

        // Step 2: build client with Bearer token for subsequent calls
        return webClientBuilder.baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + token)
                .defaultHeader("x-api-version", "2024-01-01")
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    private boolean payoutsConfigured() {
        String id = cashfree.getPayoutsAppId();
        String key = cashfree.getPayoutsSecretKey();
        return id != null && !id.isBlank() && key != null && !key.isBlank();
    }

    private String extractField(String json, String key) {
        String search = "\"" + key + "\"";
        int idx = json.indexOf(search);
        if (idx < 0) return null;
        int colon = json.indexOf(':', idx + search.length());
        if (colon < 0) return null;
        int start = json.indexOf('"', colon + 1);
        if (start < 0) return null;
        int end = json.indexOf('"', start + 1);
        if (end < 0) return null;
        return json.substring(start + 1, end);
    }

    private SettlementResponse toSettlementResponse(DriverBankAccount account, WalletSettlement settlement) {
        SettlementResponse.SettlementResponseBuilder b = SettlementResponse.builder();
        if (account != null) {
            String acctNo = account.getAccountNumber();
            String masked = acctNo != null && acctNo.length() > 4
                    ? "****" + acctNo.substring(acctNo.length() - 4) : "****";
            b.accountHolderName(account.getAccountHolderName())
             .accountNumber(masked)
             .ifscCode(account.getIfscCode())
             .bankName(account.getBankName());
        }
        if (settlement != null) {
            b.settlementId(settlement.getId())
             .status(settlement.getStatus())
             .amount(settlement.getAmount())
             .cfTransferId(settlement.getCfTransferId())
             .failureReason(settlement.getFailureReason())
             .createdAt(settlement.getCreatedAt());
        }
        return b.build();
    }
}
