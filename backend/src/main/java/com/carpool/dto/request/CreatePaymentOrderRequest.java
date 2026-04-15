package com.carpool.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePaymentOrderRequest {
    @NotBlank
    private String rideId;
}
