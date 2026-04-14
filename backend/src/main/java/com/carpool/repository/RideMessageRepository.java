package com.carpool.repository;

import com.carpool.model.RideMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RideMessageRepository extends JpaRepository<RideMessage, String> {
    List<RideMessage> findByRideIdOrderByCreatedAtAsc(String rideId);
    void deleteByRideId(String rideId);
}
