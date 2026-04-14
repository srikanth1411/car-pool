package com.carpool.dto.response;

import com.carpool.enums.RequestStatus;
import com.carpool.model.RideRequest;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class RideRequestResponse {
    private String id;
    private RequestStatus status;
    private String message;
    private int seatsRequested;
    private UserResponse rider;
    private String rideId;
    private GroupLocationResponse pickupLocation;
    private GroupLocationResponse dropoffLocation;
    private LocalDateTime createdAt;

    public static RideRequestResponse from(RideRequest rr) {
        return RideRequestResponse.builder()
                .id(rr.getId())
                .status(rr.getStatus())
                .message(rr.getMessage())
                .seatsRequested(rr.getSeatsRequested())
                .rider(UserResponse.from(rr.getRider()))
                .rideId(rr.getRide().getId())
                .pickupLocation(rr.getPickupLocation() != null ? GroupLocationResponse.from(rr.getPickupLocation()) : null)
                .dropoffLocation(rr.getDropoffLocation() != null ? GroupLocationResponse.from(rr.getDropoffLocation()) : null)
                .createdAt(rr.getCreatedAt())
                .build();
    }
}
