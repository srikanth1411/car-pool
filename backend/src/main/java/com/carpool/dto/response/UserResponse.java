package com.carpool.dto.response;

import com.carpool.enums.UserRole;
import com.carpool.model.User;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class UserResponse {
    private String id;
    private String email;
    private String name;
    private String avatarUrl;
    private String phone;

    @Schema(description = "Role of the user in the system")
    private UserRole role;

    @Schema(description = "Whether the user can act as a driver and post rides")
    private boolean canDrive;

    private LocalDateTime createdAt;

    public static UserResponse from(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .avatarUrl(user.getAvatarUrl())
                .phone(user.getPhone())
                .role(user.getRole())
                .canDrive(user.isCanDrive())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
