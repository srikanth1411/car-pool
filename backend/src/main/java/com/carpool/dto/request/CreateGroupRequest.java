package com.carpool.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class CreateGroupRequest {
    @NotBlank
    private String name;

    private String description;

    private Boolean isPrivate = true;

    private List<@Valid AddGroupLocationRequest> locations = new ArrayList<>();

    private List<@Valid GroupFieldRequest> fields = new ArrayList<>();
}
