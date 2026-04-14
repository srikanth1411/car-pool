package com.carpool.config;

import com.carpool.enums.UserRole;
import com.carpool.model.User;
import com.carpool.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.super-admin.email:admin@carpool.com}")
    private String superAdminEmail;

    @Value("${app.super-admin.password:Admin@123}")
    private String superAdminPassword;

    @Override
    public void run(String... args) {
        if (userRepository.existsByEmail(superAdminEmail)) {
            log.info("Super admin already exists: {}", superAdminEmail);
            return;
        }

        User superAdmin = User.builder()
                .email(superAdminEmail)
                .passwordHash(passwordEncoder.encode(superAdminPassword))
                .name("Super Admin")
                .role(UserRole.SUPER_ADMIN)
                .canDrive(false)
                .build();

        userRepository.save(superAdmin);
        log.info("Super admin created: email={}", superAdminEmail);
    }
}
