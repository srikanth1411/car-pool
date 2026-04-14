package com.carpool.dto.request;

import com.carpool.enums.GroupFieldType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class GroupFieldRequest {
    @NotBlank
    private String label;

    @NotNull
    private GroupFieldType fieldType;

    private Boolean required = false;

    private Integer displayOrder = 0;
}
