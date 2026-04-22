package com.carpool.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class PaymentStatusResponse {
    private String paymentId;
    private String rideId;
    private String riderId;
    private String riderName;
    private String status;       // PENDING | SUCCESS | FAILED | NOT_PAID | NOT_REQUIRED
    private BigDecimal amount;
    private String cfOrderId;
    private String cfPaymentId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
