package com.carpool.dto.response;

import com.carpool.model.RidePreference;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class RidePreferenceResponse {
    private String id;
    private String tag;
    private String groupId;
    private String groupName;
    private GroupLocationResponse originLocation;
    private GroupLocationResponse destinationLocation;
    private List<GroupLocationResponse> intermediateStops;
    private Integer totalSeats;
    private BigDecimal price;
    private String notes;
    private LocalDateTime createdAt;

    public static RidePreferenceResponse from(RidePreference p) {
        return RidePreferenceResponse.builder()
                .id(p.getId())
                .tag(p.getTag())
                .groupId(p.getGroup().getId())
                .groupName(p.getGroup().getName())
                .originLocation(GroupLocationResponse.from(p.getOriginLocation()))
                .destinationLocation(GroupLocationResponse.from(p.getDestinationLocation()))
                .intermediateStops(p.getIntermediateStops().stream().map(GroupLocationResponse::from).toList())
                .totalSeats(p.getTotalSeats())
                .price(p.getPrice())
                .notes(p.getNotes())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
