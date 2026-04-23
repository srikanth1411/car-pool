package com.carpool.repository;

import com.carpool.model.PayoutRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PayoutRequestRepository extends JpaRepository<PayoutRequest, String> {
    Optional<PayoutRequest> findByRequestId(String requestId);
    List<PayoutRequest> findByStatusIn(List<String> statuses);
    boolean existsByRequestId(String requestId);
}
