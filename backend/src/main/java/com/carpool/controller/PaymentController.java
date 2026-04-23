package com.carpool.controller;

import com.carpool.dto.request.CreatePaymentOrderRequest;
import com.carpool.dto.response.PaymentOrderResponse;
import com.carpool.dto.response.PaymentStatusResponse;
import com.carpool.dto.response.WalletResponse;
import com.carpool.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Tag(name = "Payments")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/orders")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Create a Cashfree payment order for a ride")
    public ResponseEntity<PaymentOrderResponse> createOrder(
            @AuthenticationPrincipal UserDetails user,
            @Valid @RequestBody CreatePaymentOrderRequest req) {
        return ResponseEntity.ok(paymentService.createOrder(user.getUsername(), req));
    }

    @GetMapping("/ride/{rideId}/status")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get payment status for the current user on a specific ride")
    public ResponseEntity<PaymentStatusResponse> getPaymentStatus(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable String rideId) {
        return ResponseEntity.ok(paymentService.getPaymentStatus(user.getUsername(), rideId));
    }

    @GetMapping("/ride/{rideId}/all")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get payment status for every confirmed rider on a ride (driver only)")
    public ResponseEntity<java.util.List<PaymentStatusResponse>> getRidePaymentStatuses(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable String rideId) {
        return ResponseEntity.ok(paymentService.getRidePaymentStatuses(user.getUsername(), rideId));
    }

    @PostMapping("/ride/{rideId}/remind")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Send payment reminder notifications to unpaid riders (driver only)")
    public ResponseEntity<Void> remindPendingPayments(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable String rideId) {
        paymentService.remindPendingPayments(user.getUsername(), rideId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/wallet")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get driver wallet balance and recent credits")
    public ResponseEntity<WalletResponse> getWallet(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(paymentService.getWallet(user.getUsername()));
    }

    @PostMapping("/verify/{paymentId}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Verify payment status with Cashfree and credit driver wallet if paid")
    public ResponseEntity<PaymentStatusResponse> verifyPayment(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable String paymentId) {
        return ResponseEntity.ok(paymentService.verifyAndCreditPayment(user.getUsername(), paymentId));
    }

    // ─── No-auth endpoints ──────────────────────────────────────────────────────

    @PostMapping("/webhook")
    @Operation(summary = "Cashfree payment webhook (called by Cashfree, no auth)")
    public ResponseEntity<Void> webhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "x-webhook-signature", required = false) String signature,
            @RequestHeader(value = "x-webhook-timestamp", required = false) String timestamp) {
        paymentService.handleWebhook(rawBody, signature, timestamp);
        return ResponseEntity.ok().build();
    }

    @GetMapping(value = "/checkout/{paymentId}", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Hosted Cashfree checkout page (opened in WebView)")
    public ResponseEntity<String> checkout(@PathVariable String paymentId) {
        return ResponseEntity.ok(paymentService.buildCheckoutHtml(paymentId));
    }

    @GetMapping(value = "/return", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Cashfree return URL after payment completes")
    public ResponseEntity<String> paymentReturn(
            @RequestParam String paymentId,
            @RequestParam(required = false, defaultValue = "FAILED") String status) {
        return ResponseEntity.ok(paymentService.buildReturnHtml(paymentId, status));
    }
}
