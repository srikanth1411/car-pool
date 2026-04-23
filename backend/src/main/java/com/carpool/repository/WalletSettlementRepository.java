package com.carpool.repository;

import com.carpool.model.WalletSettlement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WalletSettlementRepository extends JpaRepository<WalletSettlement, String> {
    List<WalletSettlement> findByDriverIdOrderByCreatedAtDesc(String driverId);
}
