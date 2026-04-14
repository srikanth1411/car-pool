package com.carpool.dto.response;

import com.carpool.model.Group;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class GroupResponse {
    private String id;
    private String name;
    private String description;
    private String inviteCode;
    private Boolean isPrivate;
    private UserResponse owner;
    private int memberCount;
    private List<GroupLocationResponse> locations;
    private List<GroupFieldResponse> fields;
    private LocalDateTime createdAt;

    public static GroupResponse from(Group group, int memberCount) {
        return from(group, memberCount, List.of(), List.of());
    }

    public static GroupResponse from(Group group, int memberCount, List<GroupLocationResponse> locations) {
        return from(group, memberCount, locations, List.of());
    }

    public static GroupResponse from(Group group, int memberCount, List<GroupLocationResponse> locations, List<GroupFieldResponse> fields) {
        return GroupResponse.builder()
                .id(group.getId())
                .name(group.getName())
                .description(group.getDescription())
                .inviteCode(group.getInviteCode())
                .isPrivate(group.getIsPrivate())
                .owner(UserResponse.from(group.getOwner()))
                .memberCount(memberCount)
                .locations(locations)
                .fields(fields)
                .createdAt(group.getCreatedAt())
                .build();
    }
}
