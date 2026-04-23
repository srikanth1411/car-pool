package com.carpool.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class SettlementResponse {
    private String settlementId;
    private String status;           // PENDING | SUCCESS | FAILED
    private BigDecimal amount;
    private String cfTransferId;
    private String failureReason;
    private LocalDateTime createdAt;

    // Bank account info
    private String accountHolderName;
    private String accountNumber;    // masked: ****1234
    private String ifscCode;
    private String bankName;
}
