package com.carpool.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AddGroupLocationRequest {
    @NotBlank
    private String name;
    private Double lat;
    private Double lng;
}
