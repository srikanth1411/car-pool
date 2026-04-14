package com.carpool.repository;

import com.carpool.model.MembershipComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MembershipCommentRepository extends JpaRepository<MembershipComment, String> {
    List<MembershipComment> findByMembershipIdAndParentIsNullOrderByCreatedAtAsc(String membershipId);
}
