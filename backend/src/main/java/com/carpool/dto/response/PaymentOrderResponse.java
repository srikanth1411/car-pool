package com.carpool.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class PaymentOrderResponse {
    private String paymentId;
    private String cfOrderId;
    private String paymentSessionId;
    private String checkoutUrl;   // backend-hosted HTML checkout page
    private BigDecimal amount;
    private String status;
}
