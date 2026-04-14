package com.carpool.dto.response;

import com.carpool.enums.RideStatus;
import com.carpool.model.Ride;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

@Data
@Builder
public class RideResponse {
    private String id;
    private String origin;
    private Double originLat;
    private Double originLng;
    private String destination;
    private Double destinationLat;
    private Double destinationLng;
    private GroupLocationResponse originLocation;
    private List<GroupLocationResponse> intermediateStops;
    private GroupLocationResponse destinationLocation;
    private List<GroupLocationResponse> allStops;
    private LocalDateTime departureTime;
    private Integer totalSeats;
    private Integer availableSeats;
    private String notes;
    private BigDecimal price;
    private RideStatus status;
    private UserResponse driver;
    private String groupId;
    private String groupName;
    private LocalDateTime createdAt;

    private static List<GroupLocationResponse> buildAllStops(Ride ride) {
        List<GroupLocationResponse> stops = new ArrayList<>();
        if (ride.getOriginLocation() != null) stops.add(GroupLocationResponse.from(ride.getOriginLocation()));
        ride.getIntermediateStops().stream().map(GroupLocationResponse::from).forEach(stops::add);
        if (ride.getDestinationLocation() != null) stops.add(GroupLocationResponse.from(ride.getDestinationLocation()));
        return stops;
    }

    public static RideResponse from(Ride ride) {
        return RideResponse.builder()
                .id(ride.getId())
                .origin(ride.getOrigin())
                .originLat(ride.getOriginLat())
                .originLng(ride.getOriginLng())
                .destination(ride.getDestination())
                .destinationLat(ride.getDestinationLat())
                .destinationLng(ride.getDestinationLng())
                .originLocation(ride.getOriginLocation() != null ? GroupLocationResponse.from(ride.getOriginLocation()) : null)
                .intermediateStops(ride.getIntermediateStops().stream().map(GroupLocationResponse::from).toList())
                .destinationLocation(ride.getDestinationLocation() != null ? GroupLocationResponse.from(ride.getDestinationLocation()) : null)
                .allStops(buildAllStops(ride))
                .departureTime(ride.getDepartureTime())
                .totalSeats(ride.getTotalSeats())
                .availableSeats(ride.getAvailableSeats())
                .notes(ride.getNotes())
                .price(ride.getPrice())
                .status(ride.getStatus())
                .driver(UserResponse.from(ride.getDriver()))
                .groupId(ride.getGroup().getId())
                .groupName(ride.getGroup().getName())
                .createdAt(ride.getCreatedAt())
                .build();
    }
}
