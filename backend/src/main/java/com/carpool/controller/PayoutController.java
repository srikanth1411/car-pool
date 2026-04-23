package com.carpool.controller;

import com.carpool.dto.request.SaveBankAccountRequest;
import com.carpool.dto.response.SettlementResponse;
import com.carpool.service.PayoutService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/payouts")
@RequiredArgsConstructor
@Tag(name = "Payouts")
public class PayoutController {

    private final PayoutService payoutService;

    @GetMapping("/bank-account")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get saved bank account for the driver")
    public ResponseEntity<SettlementResponse> getBankAccount(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(payoutService.getBankAccount(user.getUsername()));
    }

    @PostMapping("/bank-account")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Save or update driver bank account for settlement")
    public ResponseEntity<SettlementResponse> saveBankAccount(
            @AuthenticationPrincipal UserDetails user,
            @Valid @RequestBody SaveBankAccountRequest req) {
        return ResponseEntity.ok(payoutService.saveBankAccount(user.getUsername(), req));
    }

    @PostMapping("/settle")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Transfer full wallet balance to driver bank account (Cashfree Payouts)")
    public ResponseEntity<SettlementResponse> settleNow(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(payoutService.settleNow(user.getUsername()));
    }

    @GetMapping("/history")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get settlement history for the driver")
    public ResponseEntity<List<SettlementResponse>> getHistory(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(payoutService.getSettlementHistory(user.getUsername()));
    }
}
