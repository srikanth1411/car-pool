package com.carpool.repository;

import com.carpool.model.GroupField;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GroupFieldRepository extends JpaRepository<GroupField, String> {
    List<GroupField> findByGroupIdOrderByDisplayOrderAsc(String groupId);
}
