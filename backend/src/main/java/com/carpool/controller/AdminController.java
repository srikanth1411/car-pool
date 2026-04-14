package com.carpool.controller;

import com.carpool.dto.response.UserResponse;
import com.carpool.enums.UserRole;
import com.carpool.service.AdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Admin", description = "Admin and super-admin user management")
@SecurityRequirement(name = "bearerAuth")
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/users")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "List all users — accessible to ADMIN and SUPER_ADMIN")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Paginated list of all users"),
        @ApiResponse(responseCode = "403", description = "Caller does not have ADMIN or SUPER_ADMIN role"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token")
    })
    public ResponseEntity<Page<UserResponse>> listUsers(
            @AuthenticationPrincipal UserDetails me,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) Boolean canDrive,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return ResponseEntity.ok(adminService.listUsers(me.getUsername(), search, role, canDrive, pageable));
    }

    @PatchMapping("/users/{userId}/role")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Set a user's role to USER or ADMIN (SUPER_ADMIN only)",
               description = "Assigns USER or ADMIN role to any non-SUPER_ADMIN user. " +
                             "Assigning SUPER_ADMIN is not permitted via API.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Role updated successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid role value or attempted self-role-change"),
        @ApiResponse(responseCode = "403", description = "Caller is not SUPER_ADMIN, or target/new role is SUPER_ADMIN"),
        @ApiResponse(responseCode = "404", description = "Target user not found"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token")
    })
    public ResponseEntity<UserResponse> setRole(
            @AuthenticationPrincipal UserDetails me,
            @PathVariable String userId,
            @RequestBody Map<String, String> body) {

        UserRole newRole;
        try {
            newRole = UserRole.valueOf(body.get("role").toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(adminService.setUserRole(me.getUsername(), userId, newRole));
    }
}
