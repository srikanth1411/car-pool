package com.carpool.service;

import com.carpool.dto.request.UpdateProfileRequest;
import com.carpool.dto.response.UserResponse;
import com.carpool.exception.ResourceNotFoundException;
import com.carpool.model.User;
import com.carpool.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public UserResponse getProfile(String userId) {
        return UserResponse.from(findUser(userId));
    }

    @Transactional
    public UserResponse updateProfile(String userId, UpdateProfileRequest req) {
        User user = findUser(userId);
        if (req.getName() != null)      user.setName(req.getName());
        if (req.getPhone() != null)     user.setPhone(req.getPhone());
        if (req.getAvatarUrl() != null) user.setAvatarUrl(req.getAvatarUrl());
        userRepository.save(user);
        log.info("Profile updated: userId={}", userId);
        return UserResponse.from(user);
    }

    User findUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
    }
}
