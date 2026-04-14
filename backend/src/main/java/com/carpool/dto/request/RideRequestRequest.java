package com.carpool.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RideRequestRequest {
    private String message;

    @Min(value = 1, message = "Must request at least 1 seat")
    private int seatsRequested = 1;

    @NotBlank(message = "Pickup location is required")
    private String pickupLocationId;

    @NotBlank(message = "Dropoff location is required")
    private String dropoffLocationId;
}
