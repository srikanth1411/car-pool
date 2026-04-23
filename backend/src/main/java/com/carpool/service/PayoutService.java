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

        // Authenticate with Cashfree Payouts and register beneficiary
        String token = getPayoutsToken();
        String beneficiaryId = ensureBeneficiary(account, driver, token);

        // Create the settlement record
        WalletSettlement settlement = WalletSettlement.builder()
                .id(UUID.randomUUID().toString())
                .driver(driver)
                .wallet(wallet)
                .amount(amount)
                .status("PENDING")
                .build();
        settlementRepository.save(settlement);

        // Flush so that @CreationTimestamp is written before the update below
        settlementRepository.flush();

        // Call Cashfree Payouts transfer API
        try {
            String transferId = callCashfreeTransfer(beneficiaryId, amount, settlement.getId(), token);
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

    private String getPayoutsToken() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.set("X-Client-Id", cashfree.getAppId());
        h.set("X-Client-Secret", cashfree.getSecretKey());

        Map<?, ?> response = restTemplate.exchange(
                getPayoutsBaseUrl() + "/payout/v1/authorize",
                HttpMethod.POST,
                new HttpEntity<>(null, h),
                Map.class
        ).getBody();

        if (response == null) throw new RuntimeException("No response from Cashfree Payouts auth");
        if (!"SUCCESS".equalsIgnoreCase(String.valueOf(response.get("status")))) {
            throw new RuntimeException("Cashfree Payouts auth failed: " + response.get("message"));
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) response.get("data");
        return String.valueOf(data.get("token"));
    }

    private HttpHeaders buildPayoutHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setBearerAuth(token);
        return h;
    }

    private String ensureBeneficiary(DriverBankAccount account, User driver, String token) {
        if (account.getCfBeneficiaryId() != null) return account.getCfBeneficiaryId();

        String beneId = "bene_" + driver.getId().replace("-", "").substring(0, 12);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("beneId", beneId);
        body.put("name", account.getAccountHolderName());
        body.put("email", driver.getId());
        body.put("phone", "9999999999");
        body.put("bankAccount", account.getAccountNumber());
        body.put("ifsc", account.getIfscCode());
        body.put("address1", "India");

        try {
            restTemplate.exchange(
                    getPayoutsBaseUrl() + "/payout/v1/addBeneficiary",
                    HttpMethod.POST,
                    new HttpEntity<>(body, buildPayoutHeaders(token)),
                    Map.class
            );
        } catch (Exception e) {
            // Beneficiary may already exist — that's fine
            log.warn("Beneficiary registration: {}", e.getMessage());
        }

        account.setCfBeneficiaryId(beneId);
        bankAccountRepository.save(account);
        return beneId;
    }

    private String callCashfreeTransfer(String beneficiaryId, BigDecimal amount, String settlementId, String token) {
        String transferId = "settle_" + settlementId.replace("-", "").substring(0, 16);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("beneId", beneficiaryId);
        body.put("amount", amount.toPlainString());
        body.put("transferId", transferId);
        body.put("transferMode", "NEFT");
        body.put("remarks", "Carpool wallet settlement");

        Map<?, ?> response = restTemplate.exchange(
                getPayoutsBaseUrl() + "/payout/v1/requestTransfer",
                HttpMethod.POST,
                new HttpEntity<>(body, buildPayoutHeaders(token)),
                Map.class
        ).getBody();

        if (response == null) throw new RuntimeException("Empty response from Cashfree Payouts");

        Object status = response.get("status");
        if (!"SUCCESS".equalsIgnoreCase(String.valueOf(status))) {
            Object msg = response.get("message");
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
