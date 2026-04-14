package com.carpool.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
public class SavePreferenceRequest {
    @NotBlank
    private String tag;

    @NotBlank
    private String groupId;

    @NotBlank
    private String originLocationId;

    @NotBlank
    private String destinationLocationId;

    private List<String> intermediateLocationIds = new ArrayList<>();

    @NotNull @Min(1)
    private Integer totalSeats;

    @Min(0)
    private BigDecimal price;

    private String notes;
}
