package com.carpool.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "cashfree")
@Getter
@Setter
public class CashfreeProperties {
    private String appId;
    private String secretKey;
    private String baseUrl = "https://sandbox.cashfree.com/pg";
    private String apiVersion = "2023-08-01";

    // Cashfree Payouts uses separate credentials (enable Payouts product in dashboard)
    private String payoutsAppId;
    private String payoutsSecretKey;
}
