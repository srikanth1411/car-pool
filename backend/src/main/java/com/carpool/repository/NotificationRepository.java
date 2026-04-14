package com.carpool.repository;

import com.carpool.enums.NotificationType;
import com.carpool.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, String> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);
    List<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(String userId);
    long countByUserIdAndReadFalse(String userId);

    List<Notification> findByTypeAndReadFalse(NotificationType type);

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.user.id = :userId AND n.read = false")
    void markAllReadByUserId(String userId);
}
