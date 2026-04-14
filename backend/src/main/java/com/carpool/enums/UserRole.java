package com.carpool.enums;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Role assigned to a user in the system",
        allowableValues = {"USER", "ADMIN", "SUPER_ADMIN"})
public enum UserRole {
    @Schema(description = "Default role — can request rides and join groups")
    USER,
    @Schema(description = "Can create groups and view the admin user list")
    ADMIN,
    @Schema(description = "Full admin — can also change other users' roles")
    SUPER_ADMIN
}
