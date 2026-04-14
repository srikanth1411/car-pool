package com.carpool.repository;

import com.carpool.enums.RideStatus;
import com.carpool.model.Ride;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RideRepository extends JpaRepository<Ride, String> {
    List<Ride> findByGroupIdOrderByDepartureTimeAsc(String groupId);
    List<Ride> findByGroupIdAndStatusOrderByDepartureTimeAsc(String groupId, RideStatus status);
    List<Ride> findByDriverIdOrderByDepartureTimeDesc(String driverId);
}
