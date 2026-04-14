package com.carpool.dto.response;

import com.carpool.model.RideMessage;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class RideMessageResponse {
    private String id;
    private String content;
    private UserResponse sender;
    private List<UserResponse> mentions;
    private LocalDateTime createdAt;

    public static RideMessageResponse from(RideMessage m) {
        return RideMessageResponse.builder()
                .id(m.getId())
                .content(m.getContent())
                .sender(UserResponse.from(m.getSender()))
                .mentions(m.getMentions().stream().map(UserResponse::from).toList())
                .createdAt(m.getCreatedAt())
                .build();
    }
}
