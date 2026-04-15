package com.carpool.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class WalletResponse {
    private String walletId;
    private BigDecimal balance;
    private List<WalletTransactionResponse> recentCredits;

    @Data
    @Builder
    public static class WalletTransactionResponse {
        private String paymentId;
        private String riderName;
        private String rideName;
        private BigDecimal amount;
        private String createdAt;
    }
}
