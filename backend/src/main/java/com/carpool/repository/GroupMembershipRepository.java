package com.carpool.repository;

import com.carpool.enums.MembershipStatus;
import com.carpool.model.GroupMembership;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupMembershipRepository extends JpaRepository<GroupMembership, String> {
    Optional<GroupMembership> findByUserIdAndGroupId(String userId, String groupId);
    List<GroupMembership> findByGroupIdAndStatus(String groupId, MembershipStatus status);
    List<GroupMembership> findByUserId(String userId);
    List<GroupMembership> findByUserIdAndStatus(String userId, MembershipStatus status);
    boolean existsByUserIdAndGroupId(String userId, String groupId);
}
