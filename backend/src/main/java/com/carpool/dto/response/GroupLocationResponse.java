package com.carpool.dto.response;

import com.carpool.model.GroupLocation;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GroupLocationResponse {
    private String id;
    private String name;
    private Double lat;
    private Double lng;

    public static GroupLocationResponse from(GroupLocation loc) {
        return GroupLocationResponse.builder()
                .id(loc.getId())
                .name(loc.getName())
                .lat(loc.getLat())
                .lng(loc.getLng())
                .build();
    }
}
