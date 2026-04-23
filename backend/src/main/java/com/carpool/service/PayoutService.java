package com.carpool.service;

import com.carpool.config.CashfreeProperties;
import com.carpool.dto.PayoutEventMessage;
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

import java.math.BigDecimal;
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
    private final PayoutKafkaProducer kafkaProducer;
    private final CashfreeProperties cashfree;

    // ─── Save / update bank account ────────────────────────────────────────────

    @Transactional
    public SettlementResponse saveBankAccount(String driverEmail, SaveBankAccountRequest req) {
        User driver = userRepository.findByEmail(driverEmail)
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
        User driver = userRepository.findByEmail(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        DriverBankAccount account = bankAccountRepository.findByDriverId(driver.getId()).orElse(null);
        return toSettlementResponse(account, null);
    }

    // ─── Settle Now: publish Kafka event for async payout ─────────────────────

    @Transactional
    public SettlementResponse settleNow(String driverEmail) {
        User driver = userRepository.findByEmail(driverEmail)
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

        // Ensure beneficiary ID is set (used as idempotency key per driver)
        if (account.getCfBeneficiaryId() == null) {
            String beneId = "bene_" + driver.getId().replace("-", "").substring(0, 12);
            account.setCfBeneficiaryId(beneId);
            bankAccountRepository.save(account);
        }

        // Generate unique idempotency key for this settlement attempt
        String requestId = "pay_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);

        // Create wallet settlement record (balance deducted after webhook confirms SUCCESS)
        WalletSettlement settlement = WalletSettlement.builder()
                .id(UUID.randomUUID().toString())
                .driver(driver)
                .wallet(wallet)
                .amount(amount)
                .status("PENDING")
                .build();
        settlementRepository.save(settlement);
        settlementRepository.flush();

        // Create payout request record
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

        // Deduct wallet balance optimistically (reversed on FAILED webhook)
        wallet.setBalance(BigDecimal.ZERO);
        walletRepository.save(wallet);

        // Publish to Kafka — consumer will call Cashfree v2
        PayoutEventMessage event = PayoutEventMessage.builder()
                .eventId(payoutRequest.getId())
                .requestId(requestId)
                .walletSettlementId(settlement.getId())
                .driverId(driver.getId())
                .driverEmail(driver.getEmail())
                .amount(amount)
                .beneficiaryId(account.getCfBeneficiaryId())
                .retryCount(0)
                .build();
        kafkaProducer.publishPayoutRequest(event);

        log.info("Payout event published: requestId={} amount={} driver={}", requestId, amount, driverEmail);
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
            if ("SUCCESS".equals(pr.getStatus())) return; // already processed

            if ("SUCCESS".equalsIgnoreCase(transferStatus)) {
                pr.setStatus("SUCCESS");
                pr.setCfTransferId(transferId);
                payoutRequestRepository.save(pr);

                settlementRepository.findById(pr.getWalletSettlement().getId()).ifPresent(s -> {
                    s.setStatus("SUCCESS");
                    s.setCfTransferId(transferId);
                    settlementRepository.save(s);
                });
                log.info("Payout webhook SUCCESS: transferId={}", transferId);

            } else if ("FAILED".equalsIgnoreCase(transferStatus) || "REVERSED".equalsIgnoreCase(transferStatus)) {
                pr.setStatus("FAILED");
                pr.setFailureReason("Cashfree webhook status: " + transferStatus);
                payoutRequestRepository.save(pr);

                settlementRepository.findById(pr.getWalletSettlement().getId()).ifPresent(s -> {
                    s.setStatus("FAILED");
                    s.setFailureReason("Cashfree webhook status: " + transferStatus);
                    settlementRepository.save(s);

                    // Refund wallet balance on failure
                    walletRepository.findByUserId(pr.getDriver().getId()).ifPresent(w -> {
                        w.setBalance(w.getBalance().add(pr.getAmount()));
                        walletRepository.save(w);
                    });
                });
                log.warn("Payout webhook FAILED: transferId={}", transferId);
            }
        });
    }

    // ─── Settlement history ─────────────────────────────────────────────────────

    public List<SettlementResponse> getSettlementHistory(String driverEmail) {
        User driver = userRepository.findByEmail(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        DriverBankAccount account = bankAccountRepository.findByDriverId(driver.getId()).orElse(null);

        return settlementRepository.findByDriverIdOrderByCreatedAtDesc(driver.getId())
                .stream()
                .map(s -> toSettlementResponse(account, s))
                .toList();
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

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
