package com.carpool.repository;

import com.carpool.model.MembershipFieldValue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MembershipFieldValueRepository extends JpaRepository<MembershipFieldValue, String> {
    List<MembershipFieldValue> findByMembershipId(String membershipId);
    void deleteByMembershipId(String membershipId);
}
