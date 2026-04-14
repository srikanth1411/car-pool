package com.carpool.repository;

import com.carpool.model.GroupLocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupLocationRepository extends JpaRepository<GroupLocation, String> {
    List<GroupLocation> findByGroupIdOrderByCreatedAtAsc(String groupId);
    Optional<GroupLocation> findByIdAndGroupId(String id, String groupId);
}
