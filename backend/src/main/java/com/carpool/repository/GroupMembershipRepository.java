package com.carpool.repository;

import com.carpool.enums.MembershipRole;
import com.carpool.enums.MembershipStatus;
import com.carpool.model.GroupMembership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GroupMembershipRepository extends JpaRepository<GroupMembership, String> {
    Optional<GroupMembership> findByUserIdAndGroupId(String userId, String groupId);
    List<GroupMembership> findByGroupIdAndStatus(String groupId, MembershipStatus status);
    List<GroupMembership> findByUserId(String userId);
    List<GroupMembership> findByUserIdAndStatus(String userId, MembershipStatus status);
    boolean existsByUserIdAndGroupId(String userId, String groupId);

    @Query("SELECT m FROM GroupMembership m WHERE m.status = :status AND m.group.id IN " +
           "(SELECT gm.group.id FROM GroupMembership gm WHERE gm.user.id = :userId AND gm.role = :role)")
    List<GroupMembership> findByStatusInGroupsManagedBy(
            @Param("userId") String userId,
            @Param("role") MembershipRole role,
            @Param("status") MembershipStatus status);
}
