package com.carpool.service;

import com.carpool.dto.request.LoginRequest;
import com.carpool.dto.request.RegisterRequest;
import com.carpool.dto.response.AuthResponse;
import com.carpool.dto.response.UserResponse;
import com.carpool.exception.ConflictException;
import com.carpool.model.User;
import com.carpool.repository.UserRepository;
import com.carpool.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new ConflictException("Email already registered: " + req.getEmail());
        }

        User user = User.builder()
                .email(req.getEmail())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .name(req.getName())
                .phone(req.getPhone())
                .canDrive(req.getCanDrive() != null ? req.getCanDrive() : false)
                .build();
        userRepository.save(user);

        log.info("New user registered: userId={} email={}", user.getId(), user.getEmail());
        return buildAuthResponse(user);
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            log.warn("Failed login attempt for email={}", req.getEmail());
            throw new BadCredentialsException("Invalid credentials");
        }

        log.info("User logged in: userId={}", user.getId());
        return buildAuthResponse(user);
    }

    public AuthResponse refreshToken(String refreshToken) {
        if (!jwtUtil.validateToken(refreshToken)) {
            throw new BadCredentialsException("Invalid or expired refresh token");
        }
        String userId = jwtUtil.extractUserId(refreshToken);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadCredentialsException("User not found"));
        return buildAuthResponse(user);
    }

    private AuthResponse buildAuthResponse(User user) {
        return AuthResponse.builder()
                .accessToken(jwtUtil.generateAccessToken(user.getId(), user.getEmail()))
                .refreshToken(jwtUtil.generateRefreshToken(user.getId()))
                .user(UserResponse.from(user))
                .build();
    }
}
