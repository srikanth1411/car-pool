package com.carpool.repository;

import com.carpool.enums.RequestStatus;
import com.carpool.enums.RideStatus;
import com.carpool.model.RideRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RideRequestRepository extends JpaRepository<RideRequest, String> {
    Optional<RideRequest> findByRiderIdAndRideId(String riderId, String rideId);
    List<RideRequest> findByRideId(String rideId);
    List<RideRequest> findByRiderId(String riderId);
    boolean existsByRiderIdAndRideId(String riderId, String rideId);

    @Query("SELECT COUNT(rr) > 0 FROM RideRequest rr WHERE rr.rider.id = :riderId " +
           "AND rr.status = :status " +
           "AND rr.ride.status NOT IN :excludedStatuses " +
           "AND FUNCTION('DATE', rr.ride.departureTime) = FUNCTION('DATE', :departureTime)")
    boolean existsActiveBookingOnSameDate(@Param("riderId") String riderId,
                                          @Param("status") RequestStatus status,
                                          @Param("excludedStatuses") List<RideStatus> excludedStatuses,
                                          @Param("departureTime") LocalDateTime departureTime);
}
