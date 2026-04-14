package com.carpool.controller;

import com.carpool.dto.request.LoginRequest;
import com.carpool.dto.request.RegisterRequest;
import com.carpool.dto.response.AuthResponse;
import com.carpool.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Register, login, and refresh tokens")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register a new user",
               responses = {
                   @ApiResponse(responseCode = "201", description = "User created",
                       content = @Content(schema = @Schema(implementation = AuthResponse.class))),
                   @ApiResponse(responseCode = "409", description = "Email already registered")
               })
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        log.info("Register request: email={}", req.getEmail());
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(req));
    }

    @PostMapping("/login")
    @Operation(summary = "Login with email and password",
               responses = {
                   @ApiResponse(responseCode = "200", description = "Login successful",
                       content = @Content(schema = @Schema(implementation = AuthResponse.class))),
                   @ApiResponse(responseCode = "401", description = "Invalid credentials")
               })
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        log.info("Login request: email={}", req.getEmail());
        return ResponseEntity.ok(authService.login(req));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token using refresh token")
    public ResponseEntity<AuthResponse> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        return ResponseEntity.ok(authService.refreshToken(refreshToken));
    }
}
