package com.carpool.service;

import com.carpool.config.CashfreeProperties;
import com.carpool.dto.request.SaveBankAccountRequest;
import com.carpool.dto.response.SettlementResponse;
import com.carpool.exception.BadRequestException;
import com.carpool.exception.ResourceNotFoundException;
import com.carpool.model.DriverBankAccount;
import com.carpool.model.User;
import com.carpool.model.Wallet;
import com.carpool.model.WalletSettlement;
import com.carpool.repository.DriverBankAccountRepository;
import com.carpool.repository.UserRepository;
import com.carpool.repository.WalletRepository;
import com.carpool.repository.WalletSettlementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final DriverBankAccountRepository bankAccountRepository;
    private final WalletSettlementRepository settlementRepository;
    private final CashfreeProperties cashfree;
    private final RestTemplate restTemplate;

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

        DriverBankAccount account = bankAccountRepository.findByDriverId(driver.getId())
                .orElse(null);

        return toSettlementResponse(account, null);
    }

    // ─── Settle Now: transfer wallet balance to bank ───────────────────────────

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

        BigDecimal amount = wallet.getBalance();

        // Create the settlement record first so it's always tracked
        WalletSettlement settlement = WalletSettlement.builder()
                .id(UUID.randomUUID().toString())
                .driver(driver)
                .wallet(wallet)
                .amount(amount)
                .status("PENDING")
                .build();
        settlementRepository.save(settlement);

        // Flush so @CreationTimestamp is populated before the update below
        settlementRepository.flush();

        if (!payoutsConfigured()) {
            // Payouts not configured yet — leave as PENDING and notify
            settlement.setFailureReason("Cashfree Payouts not configured. Set CASHFREE_PAYOUTS_APP_ID and CASHFREE_PAYOUTS_SECRET_KEY.");
            settlement.setStatus("PENDING");
            settlementRepository.save(settlement);
            log.warn("Payouts not configured; settlement {} left as PENDING", settlement.getId());
            return toSettlementResponse(account, settlement);
        }

        // Register beneficiary (v2: no separate auth step)
        String beneficiaryId = ensureBeneficiary(account, driver);

        // Call Cashfree Payouts v2 transfer API
        try {
            String transferId = callCashfreeTransfer(beneficiaryId, amount, settlement.getId());
            settlement.setCfTransferId(transferId);
            settlement.setStatus("SUCCESS");

            // Deduct from wallet
            wallet.setBalance(BigDecimal.ZERO);
            walletRepository.save(wallet);

            log.info("Settlement SUCCESS: settlementId={}, amount={}, driver={}", settlement.getId(), amount, driverEmail);
        } catch (Exception e) {
            settlement.setStatus("FAILED");
            settlement.setFailureReason(e.getMessage());
            log.error("Settlement FAILED: settlementId={}, error={}", settlement.getId(), e.getMessage());
        }
        settlementRepository.save(settlement);

        return toSettlementResponse(account, settlement);
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

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private String getPayoutsBaseUrl() {
        return cashfree.getBaseUrl().contains("sandbox")
                ? "https://payout-gamma.cashfree.com"
                : "https://payout-api.cashfree.com";
    }

    private boolean payoutsConfigured() {
        String id = cashfree.getPayoutsAppId();
        String key = cashfree.getPayoutsSecretKey();
        return id != null && !id.isBlank() && key != null && !key.isBlank();
    }

    // Cashfree Payouts v2: credentials sent on every request — no separate token step
    private HttpHeaders buildPayoutHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.set("x-client-id", cashfree.getPayoutsAppId());
        h.set("x-client-secret", cashfree.getPayoutsSecretKey());
        h.set("x-api-version", "2024-01-01");
        return h;
    }

    private String ensureBeneficiary(DriverBankAccount account, User driver) {
        if (account.getCfBeneficiaryId() != null) return account.getCfBeneficiaryId();

        String beneId = "bene_" + driver.getId().replace("-", "").substring(0, 12);

        Map<String, Object> contactDetails = new LinkedHashMap<>();
        contactDetails.put("beneficiary_email", driver.getId());
        contactDetails.put("beneficiary_phone", "9999999999");
        contactDetails.put("beneficiary_country_code", "+91");
        contactDetails.put("beneficiary_address", "India");
        contactDetails.put("beneficiary_city", "India");
        contactDetails.put("beneficiary_state", "India");
        contactDetails.put("beneficiary_postal_code", "000000");

        Map<String, Object> instrumentDetails = new LinkedHashMap<>();
        instrumentDetails.put("bank_account_number", account.getAccountNumber());
        instrumentDetails.put("bank_ifsc", account.getIfscCode());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("beneficiary_id", beneId);
        body.put("beneficiary_name", account.getAccountHolderName());
        body.put("beneficiary_instrument_details", instrumentDetails);
        body.put("beneficiary_contact_details", contactDetails);

        try {
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> resp = restTemplate.exchange(
                    getPayoutsBaseUrl() + "/payout/v2/beneficiary",
                    HttpMethod.POST,
                    new HttpEntity<>(body, buildPayoutHeaders()),
                    Map.class
            );
            log.info("Beneficiary registration response: status={} body={}", resp.getStatusCode(), resp.getBody());
        } catch (Exception e) {
            // Beneficiary may already exist — that's fine
            log.warn("Beneficiary registration failed: {}", e.getMessage());
        }

        account.setCfBeneficiaryId(beneId);
        bankAccountRepository.save(account);
        return beneId;
    }

    private String callCashfreeTransfer(String beneficiaryId, BigDecimal amount, String settlementId) {
        String transferId = "settle_" + settlementId.replace("-", "").substring(0, 16);

        Map<String, Object> beneficiaryDetails = new LinkedHashMap<>();
        beneficiaryDetails.put("beneficiary_id", beneficiaryId);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("transfer_id", transferId);
        body.put("transfer_amount", amount);
        body.put("beneficiary_details", beneficiaryDetails);
        body.put("transfer_currency", "INR");
        body.put("transfer_mode", "banktransfer");
        body.put("transfer_remarks", "Carpool wallet settlement");

        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> transferResp = restTemplate.exchange(
                getPayoutsBaseUrl() + "/payout/v2/transfers",
                HttpMethod.POST,
                new HttpEntity<>(body, buildPayoutHeaders()),
                Map.class
        );
        Map<?, ?> response = transferResp.getBody();
        log.info("Cashfree transfer response: status={} body={}", transferResp.getStatusCode(), response);

        if (response == null) throw new RuntimeException("Empty response from Cashfree Payouts");

        Object status = response.get("transfer_status");
        log.info("transfer_status={}", status);
        if ("FAILED".equalsIgnoreCase(String.valueOf(status))) {
            Object msg = response.get("transfer_message");
            throw new RuntimeException("Cashfree Payouts error: " + msg);
        }
        return transferId;
    }

    private SettlementResponse toSettlementResponse(DriverBankAccount account, WalletSettlement settlement) {
        SettlementResponse.SettlementResponseBuilder b = SettlementResponse.builder();
        if (account != null) {
            String acctNo = account.getAccountNumber();
            String masked = acctNo.length() > 4
                    ? "****" + acctNo.substring(acctNo.length() - 4)
                    : "****";
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
