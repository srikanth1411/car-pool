package com.carpool.repository;

import com.carpool.model.RidePreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RidePreferenceRepository extends JpaRepository<RidePreference, String> {
    List<RidePreference> findByUserIdOrderByCreatedAtDesc(String userId);
}
