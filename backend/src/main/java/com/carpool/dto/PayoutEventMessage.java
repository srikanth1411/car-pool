package com.carpool.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayoutEventMessage {
    private String eventId;           // payout_request.id
    private String requestId;         // idempotency key = transfer_id sent to Cashfree
    private String walletSettlementId;
    private String driverId;
    private String driverEmail;
    private BigDecimal amount;
    private String beneficiaryId;
    private int retryCount;
}
