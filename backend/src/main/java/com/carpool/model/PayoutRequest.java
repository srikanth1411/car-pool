package com.carpool.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payout_requests")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PayoutRequest {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_settlement_id")
    private WalletSettlement walletSettlement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id", nullable = false)
    private User driver;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(name = "request_id", unique = true, nullable = false)
    private String requestId;

    @Column(nullable = false)
    private String status; // CREATED | PROCESSING | SUCCESS | FAILED

    @Column(name = "cf_transfer_id")
    private String cfTransferId;

    @Column(name = "beneficiary_id")
    private String beneficiaryId;

    @Column(name = "retry_count", nullable = false)
    @Builder.Default
    private int retryCount = 0;

    @Column(name = "failure_reason")
    private String failureReason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
