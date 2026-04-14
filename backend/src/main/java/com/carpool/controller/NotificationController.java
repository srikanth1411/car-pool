package com.carpool.controller;

import com.carpool.dto.response.NotificationResponse;
import com.carpool.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "User notification management")
@SecurityRequirement(name = "bearerAuth")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @Operation(summary = "Get all notifications")
    public ResponseEntity<List<NotificationResponse>> getAll(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(notificationService.getNotifications(user.getUsername()));
    }

    @GetMapping("/unread")
    @Operation(summary = "Get unread notifications")
    public ResponseEntity<List<NotificationResponse>> getUnread(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(notificationService.getUnread(user.getUsername()));
    }

    @GetMapping("/unread/count")
    @Operation(summary = "Get unread notification count")
    public ResponseEntity<Map<String, Long>> countUnread(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(Map.of("count", notificationService.countUnread(user.getUsername())));
    }

    @PatchMapping("/{notificationId}/read")
    @Operation(summary = "Mark a notification as read")
    public ResponseEntity<NotificationResponse> markRead(@AuthenticationPrincipal UserDetails user,
                                                          @PathVariable String notificationId) {
        return ResponseEntity.ok(notificationService.markRead(notificationId, user.getUsername()));
    }

    @PostMapping("/read-all")
    @Operation(summary = "Mark all notifications as read")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal UserDetails user) {
        notificationService.markAllRead(user.getUsername());
        return ResponseEntity.noContent().build();
    }
}
