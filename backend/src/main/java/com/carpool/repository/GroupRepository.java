package com.carpool.repository;

import com.carpool.model.Group;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupRepository extends JpaRepository<Group, String> {
    Optional<Group> findByInviteCode(String inviteCode);
}
