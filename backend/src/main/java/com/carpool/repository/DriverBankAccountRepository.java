package com.carpool.repository;

import com.carpool.model.DriverBankAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DriverBankAccountRepository extends JpaRepository<DriverBankAccount, String> {
    Optional<DriverBankAccount> findByDriverId(String driverId);
}
