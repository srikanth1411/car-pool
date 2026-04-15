package com.carpool.service;

import com.carpool.config.CashfreeProperties;
import com.carpool.dto.request.CreatePaymentOrderRequest;
import com.carpool.dto.response.PaymentOrderResponse;
import com.carpool.dto.response.PaymentStatusResponse;
import com.carpool.dto.response.WalletResponse;
import com.carpool.enums.NotificationType;
import com.carpool.enums.PaymentStatus;
import com.carpool.enums.RequestStatus;
import com.carpool.enums.RideStatus;
import com.carpool.exception.BadRequestException;
import com.carpool.exception.ResourceNotFoundException;
import com.carpool.model.*;
import com.carpool.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final RideRequestRepository rideRequestRepository;
    private final NotificationService notificationService;
    private final CashfreeProperties cashfree;
    private final RestTemplate restTemplate;

    @Value("${upload.base-url:http://localhost:8080}")
    private String backendBaseUrl;

    // ─── Create Cashfree order and Payment record ──────────────────────────────

    @Transactional
    public PaymentOrderResponse createOrder(String userEmail, CreatePaymentOrderRequest req) {
        User rider = userRepository.findById(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Ride ride = rideRepository.findById(req.getRideId())
                .orElseThrow(() -> new ResourceNotFoundException("Ride not found"));

        if (ride.getStatus() != RideStatus.DEPARTED) {
            throw new BadRequestException("Payment is only available after the driver starts the ride");
        }

        if (ride.getPrice() == null || ride.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("This ride has no price set");
        }

        // Verify rider has a confirmed seat
        RideRequest rideRequest = rideRequestRepository
                .findByRiderIdAndRideId(rider.getId(), ride.getId())
                .orElseThrow(() -> new BadRequestException("You don't have a booking on this ride"));

        if (rideRequest.getStatus() != RequestStatus.CONFIRMED) {
            throw new BadRequestException("Your seat request is not confirmed");
        }

        // Check for existing successful payment
        if (paymentRepository.existsByRideIdAndRiderIdAndStatus(ride.getId(), rider.getId(), PaymentStatus.SUCCESS)) {
            throw new BadRequestException("You have already paid for this ride");
        }

        // Reuse existing PENDING payment or create new one
        Payment payment = paymentRepository
                .findByRideIdAndRiderId(ride.getId(), rider.getId())
                .filter(p -> p.getStatus() == PaymentStatus.PENDING)
                .orElse(null);

        BigDecimal amount = ride.getPrice().multiply(BigDecimal.valueOf(rideRequest.getSeatsRequested()));

        // Create Cashfree order
        String cfOrderId = "ride_" + ride.getId().replace("-", "").substring(0, 10)
                + "_" + rider.getId().replace("-", "").substring(0, 6)
                + "_" + System.currentTimeMillis();

        Map<String, Object> orderPayload = buildCashfreeOrderPayload(cfOrderId, amount, rider);
        Map<String, Object> cfResponse = callCashfreeCreateOrder(orderPayload);

        String paymentSessionId = (String) cfResponse.get("payment_session_id");
        if (paymentSessionId == null) {
            log.error("Cashfree order creation failed: {}", cfResponse);
            throw new BadRequestException("Payment gateway error. Please try again.");
        }

        if (payment == null) {
            payment = Payment.builder()
                    .ride(ride)
                    .rider(rider)
                    .driver(ride.getDriver())
                    .amount(amount)
                    .seatsPaid(rideRequest.getSeatsRequested())
                    .status(PaymentStatus.PENDING)
                    .build();
        }
        payment.setCfOrderId(cfOrderId);
        payment.setPaymentSessionId(paymentSessionId);
        payment = paymentRepository.save(payment);

        String ourCheckoutUrl = backendBaseUrl + "/api/v1/payments/checkout/" + payment.getId();

        return PaymentOrderResponse.builder()
                .paymentId(payment.getId())
                .cfOrderId(cfOrderId)
                .paymentSessionId(paymentSessionId)
                .checkoutUrl(ourCheckoutUrl)
                .amount(amount)
                .status(payment.getStatus().name())
                .build();
    }

    // ─── Payment status for a ride (rider's own) ───────────────────────────────

    public PaymentStatusResponse getPaymentStatus(String userEmail, String rideId) {
        User rider = userRepository.findById(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride not found"));

        if (ride.getPrice() == null || ride.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
            return PaymentStatusResponse.builder().rideId(rideId).status("NOT_REQUIRED").build();
        }

        return paymentRepository.findByRideIdAndRiderId(rideId, rider.getId())
                .map(p -> PaymentStatusResponse.builder()
                        .paymentId(p.getId())
                        .rideId(rideId)
                        .status(p.getStatus().name())
                        .amount(p.getAmount())
                        .cfOrderId(p.getCfOrderId())
                        .cfPaymentId(p.getCfPaymentId())
                        .createdAt(p.getCreatedAt())
                        .updatedAt(p.getUpdatedAt())
                        .build())
                .orElse(PaymentStatusResponse.builder()
                        .rideId(rideId)
                        .status("NOT_PAID")
                        .amount(ride.getPrice())
                        .build());
    }

    // ─── Wallet ─────────────────────────────────────────────────────────────────

    public WalletResponse getWallet(String userEmail) {
        User user = userRepository.findById(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Wallet wallet = getOrCreateWallet(user);

        List<Payment> credits = paymentRepository.findByDriverIdOrderByCreatedAtDesc(user.getId())
                .stream().filter(p -> p.getStatus() == PaymentStatus.SUCCESS).toList();

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");
        List<WalletResponse.WalletTransactionResponse> txns = credits.stream()
                .map(p -> WalletResponse.WalletTransactionResponse.builder()
                        .paymentId(p.getId())
                        .riderName(p.getRider().getName())
                        .rideName(p.getRide().getOrigin() + " → " + p.getRide().getDestination())
                        .amount(p.getAmount())
                        .createdAt(p.getUpdatedAt().format(fmt))
                        .build())
                .toList();

        return WalletResponse.builder()
                .walletId(wallet.getId())
                .balance(wallet.getBalance())
                .recentCredits(txns)
                .build();
    }

    // ─── Cashfree Webhook ────────────────────────────────────────────────────────

    @Transactional
    public void handleWebhook(String rawBody, String signature, String timestamp) {
        if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
            log.warn("Invalid Cashfree webhook signature");
            return;
        }

        // Parse the minimal fields we need
        String cfOrderId = extractJsonField(rawBody, "order_id");
        String cfPaymentId = extractJsonField(rawBody, "cf_payment_id");
        String paymentStatus = extractJsonField(rawBody, "payment_status");

        if (cfOrderId == null || paymentStatus == null) {
            log.warn("Cashfree webhook missing required fields: body={}", rawBody);
            return;
        }

        paymentRepository.findByCfOrderId(cfOrderId).ifPresent(payment -> {
            if (payment.getStatus() == PaymentStatus.SUCCESS) return; // idempotent

            if ("SUCCESS".equalsIgnoreCase(paymentStatus)) {
                payment.setStatus(PaymentStatus.SUCCESS);
                payment.setCfPaymentId(cfPaymentId);
                paymentRepository.save(payment);

                // Credit driver wallet
                Wallet wallet = getOrCreateWallet(payment.getDriver());
                wallet.setBalance(wallet.getBalance().add(payment.getAmount()));
                walletRepository.save(wallet);

                // Notify rider
                notificationService.send(
                        payment.getRider().getId(),
                        NotificationType.PAYMENT_SUCCESS,
                        "Payment Successful",
                        "₹" + payment.getAmount() + " paid for ride to " + payment.getRide().getDestination(),
                        Map.of("rideId", payment.getRide().getId(), "paymentId", payment.getId())
                );
                // Notify driver
                notificationService.send(
                        payment.getDriver().getId(),
                        NotificationType.PAYMENT_RECEIVED,
                        "Payment Received",
                        payment.getRider().getName() + " paid ₹" + payment.getAmount() + ". Your wallet has been credited.",
                        Map.of("rideId", payment.getRide().getId(), "paymentId", payment.getId())
                );

                log.info("Payment SUCCESS: paymentId={}, amount={}, driver={}", payment.getId(), payment.getAmount(), payment.getDriver().getEmail());

            } else if ("FAILED".equalsIgnoreCase(paymentStatus) || "USER_DROPPED".equalsIgnoreCase(paymentStatus)) {
                payment.setStatus(PaymentStatus.FAILED);
                payment.setCfPaymentId(cfPaymentId);
                paymentRepository.save(payment);
                log.info("Payment FAILED: paymentId={}, cfStatus={}", payment.getId(), paymentStatus);
            }
        });
    }

    // ─── Checkout HTML page ─────────────────────────────────────────────────────

    public String buildCheckoutHtml(String paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));

        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            return resultHtml("success", "Payment already completed!");
        }

        String env = cashfree.getBaseUrl().contains("sandbox") ? "sandbox" : "production";
        String sdkUrl = "sandbox".equals(env)
                ? "https://sdk.cashfree.com/js/v3/cashfree.js"
                : "https://sdk.cashfree.com/js/v3/cashfree.js";

        return "<!DOCTYPE html><html><head><meta charset='UTF-8'/>" +
               "<meta name='viewport' content='width=device-width,initial-scale=1'/>" +
               "<title>Pay for Ride</title>" +
               "<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;" +
               "justify-content:center;min-height:100vh;margin:0;background:#f9fafb;}" +
               ".card{background:#fff;border-radius:16px;padding:32px;max-width:400px;width:90%;" +
               "box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center;}" +
               "h2{color:#111827;margin-bottom:8px;}p{color:#6b7280;margin-bottom:24px;}" +
               ".amount{font-size:28px;font-weight:700;color:#16a34a;margin:16px 0;}" +
               ".btn{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:14px 32px;" +
               "font-size:16px;font-weight:600;cursor:pointer;width:100%;}" +
               ".btn:disabled{opacity:0.6;cursor:not-allowed;}" +
               ".spinner{border:3px solid #e5e7eb;border-top:3px solid #2563eb;border-radius:50%;" +
               "width:24px;height:24px;animation:spin 0.8s linear infinite;margin:16px auto;display:none;}" +
               "@keyframes spin{to{transform:rotate(360deg);}}</style>" +
               "<script src='" + sdkUrl + "'></script></head><body>" +
               "<div class='card'>" +
               "<h2>Pay for Ride</h2>" +
               "<p>" + payment.getRide().getOrigin() + " → " + payment.getRide().getDestination() + "</p>" +
               "<div class='amount'>₹" + payment.getAmount() + "</div>" +
               "<p style='font-size:13px;color:#9ca3af;'>Secure payment powered by Cashfree</p>" +
               "<div class='spinner' id='spinner'></div>" +
               "<button class='btn' id='payBtn' onclick='startPayment()'>Pay Now</button>" +
               "</div>" +
               "<script>" +
               "const cashfree = Cashfree({ mode: '" + env + "' });" +
               "async function startPayment() {" +
               "  document.getElementById('payBtn').disabled = true;" +
               "  document.getElementById('spinner').style.display = 'block';" +
               "  try {" +
               "    const result = await cashfree.checkout({" +
               "      paymentSessionId: '" + payment.getPaymentSessionId() + "'," +
               "      returnUrl: window.location.origin + '/api/v1/payments/return?paymentId=" + paymentId + "&status={order_status}'" +
               "    });" +
               "    if (result && result.error) {" +
               "      window.location.href = '/api/v1/payments/return?paymentId=" + paymentId + "&status=FAILED';" +
               "    } else {" +
               "      window.location.href = '/api/v1/payments/return?paymentId=" + paymentId + "&status=SUCCESS';" +
               "    }" +
               "  } catch(e) {" +
               "    window.location.href = '/api/v1/payments/return?paymentId=" + paymentId + "&status=FAILED';" +
               "  }" +
               "}" +
               "</script></body></html>";
    }

    public String buildReturnHtml(String paymentId, String status) {
        boolean success = "PAID".equalsIgnoreCase(status) || "SUCCESS".equalsIgnoreCase(status);
        return resultHtml(success ? "success" : "failed",
                success ? "Payment Successful! Your wallet has been updated." : "Payment Failed. Please try again.");
    }

    private String resultHtml(String type, String message) {
        String icon = "success".equals(type) ? "✅" : "❌";
        String color = "success".equals(type) ? "#16a34a" : "#dc2626";
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'/>" +
               "<meta name='viewport' content='width=device-width,initial-scale=1'/>" +
               "<title>Payment Result</title>" +
               "<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;" +
               "min-height:100vh;margin:0;background:#f9fafb;}" +
               ".card{background:#fff;border-radius:16px;padding:40px;max-width:360px;width:90%;" +
               "box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center;}" +
               ".icon{font-size:56px;margin-bottom:16px;}" +
               "h2{color:" + color + ";margin-bottom:8px;}" +
               "p{color:#6b7280;}</style></head><body>" +
               "<div class='card'><div class='icon'>" + icon + "</div>" +
               "<h2>" + (type.equals("success") ? "Success!" : "Failed") + "</h2>" +
               "<p>" + message + "</p>" +
               "<p style='font-size:12px;color:#9ca3af;margin-top:16px;'>You can close this window.</p>" +
               "</div></body></html>";
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private Wallet getOrCreateWallet(User user) {
        return walletRepository.findByUserId(user.getId())
                .orElseGet(() -> walletRepository.save(
                        Wallet.builder().user(user).balance(BigDecimal.ZERO).build()));
    }

    private Map<String, Object> callCashfreeCreateOrder(Map<String, Object> payload) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-version", cashfree.getApiVersion());
        headers.set("x-client-id", cashfree.getAppId());
        headers.set("x-client-secret", cashfree.getSecretKey());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    cashfree.getBaseUrl() + "/orders", HttpMethod.POST, entity,
                    new org.springframework.core.ParameterizedTypeReference<>() {});
            return response.getBody() != null ? response.getBody() : Map.of();
        } catch (Exception e) {
            log.error("Cashfree create order failed: {}", e.getMessage());
            throw new BadRequestException("Payment gateway unavailable. Please try again.");
        }
    }

    private Map<String, Object> buildCashfreeOrderPayload(String cfOrderId, BigDecimal amount, User rider) {
        Map<String, Object> customer = new LinkedHashMap<>();
        customer.put("customer_id", rider.getId());
        customer.put("customer_name", rider.getName());
        customer.put("customer_email", rider.getEmail());
        customer.put("customer_phone", rider.getPhone() != null ? rider.getPhone() : "9999999999");

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("order_id", cfOrderId);
        payload.put("order_amount", amount);
        payload.put("order_currency", "INR");
        payload.put("customer_details", customer);

        return payload;
    }

    private boolean verifyWebhookSignature(String rawBody, String signature, String timestamp) {
        if (signature == null || timestamp == null) return false;
        try {
            String data = timestamp + rawBody;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(cashfree.getSecretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            String computed = Base64.getEncoder().encodeToString(hash);
            return computed.equals(signature);
        } catch (Exception e) {
            log.error("Webhook signature verification failed", e);
            return false;
        }
    }

    /** Minimal JSON field extractor to avoid pulling in a JSON lib dependency. */
    private String extractJsonField(String json, String field) {
        String key = "\"" + field + "\"";
        int idx = json.indexOf(key);
        if (idx == -1) return null;
        int colon = json.indexOf(':', idx + key.length());
        if (colon == -1) return null;
        int start = json.indexOf('"', colon + 1);
        if (start == -1) return null;
        int end = json.indexOf('"', start + 1);
        if (end == -1) return null;
        return json.substring(start + 1, end);
    }
}
