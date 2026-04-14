package com.carpool.dto.request;

import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String name;
    private String phone;
    private String avatarUrl;
}
