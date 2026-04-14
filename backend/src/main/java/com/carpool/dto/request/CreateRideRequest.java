package com.carpool.dto.request;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class CreateRideRequest {
    @NotBlank
    private String groupId;

    @NotBlank
    private String originLocationId;

    @NotBlank
    private String destinationLocationId;

    @NotNull
    private LocalDateTime departureTime;

    @NotNull @Min(1)
    private Integer totalSeats;

    private String notes;

    @Min(0)
    private BigDecimal price;

    private List<String> intermediateLocationIds = new ArrayList<>();
}
