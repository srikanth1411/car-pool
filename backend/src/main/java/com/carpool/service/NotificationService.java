package com.carpool.service;

import com.carpool.dto.response.NotificationResponse;
import com.carpool.enums.NotificationType;
import com.carpool.exception.ResourceNotFoundException;
import com.carpool.model.Notification;
import com.carpool.model.User;
import com.carpool.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserService userService;

    public List<NotificationResponse> getNotifications(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(NotificationResponse::from).toList();
    }

    public List<NotificationResponse> getUnread(String userId) {
        return notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId)
                .stream().map(NotificationResponse::from).toList();
    }

    public long countUnread(String userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    @Transactional
    public NotificationResponse markRead(String notificationId, String userId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", notificationId));
        n.setRead(true);
        return NotificationResponse.from(notificationRepository.save(n));
    }

    @Transactional
    public void markAllRead(String userId) {
        notificationRepository.markAllReadByUserId(userId);
        log.info("Marked all notifications read for userId={}", userId);
    }

    @Transactional
    public void send(String userId, NotificationType type, String title, String body, Map<String, String> metadata) {
        User user = userService.findUser(userId);
        Notification n = Notification.builder()
                .user(user)
                .type(type)
                .title(title)
                .body(body)
                .metadata(metadata)
                .build();
        notificationRepository.save(n);
        log.debug("Notification sent: userId={} type={}", userId, type);
    }
}
