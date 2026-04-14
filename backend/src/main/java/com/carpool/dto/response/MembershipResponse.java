package com.carpool.dto.response;

import com.carpool.enums.MembershipRole;
import com.carpool.enums.MembershipStatus;
import com.carpool.model.GroupMembership;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class MembershipResponse {
    private String id;
    private MembershipStatus status;
    private MembershipRole role;
    private UserResponse user;
    private String groupId;
    private String groupName;
    private LocalDateTime joinedAt;
    private LocalDateTime createdAt;

    public static MembershipResponse from(GroupMembership m) {
        return MembershipResponse.builder()
                .id(m.getId())
                .status(m.getStatus())
                .role(m.getRole())
                .user(UserResponse.from(m.getUser()))
                .groupId(m.getGroup().getId())
                .groupName(m.getGroup().getName())
                .joinedAt(m.getJoinedAt())
                .createdAt(m.getCreatedAt())
                .build();
    }
}
