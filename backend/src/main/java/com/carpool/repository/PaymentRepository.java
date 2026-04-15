package com.carpool.repository;

import com.carpool.enums.PaymentStatus;
import com.carpool.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, String> {
    Optional<Payment> findByRideIdAndRiderId(String rideId, String riderId);
    Optional<Payment> findByCfOrderId(String cfOrderId);
    List<Payment> findByRideId(String rideId);
    List<Payment> findByRiderIdOrderByCreatedAtDesc(String riderId);
    List<Payment> findByDriverIdOrderByCreatedAtDesc(String driverId);
    boolean existsByRideIdAndRiderIdAndStatus(String rideId, String riderId, PaymentStatus status);
}
