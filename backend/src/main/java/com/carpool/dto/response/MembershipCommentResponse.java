package com.carpool.dto.response;

import com.carpool.model.MembershipComment;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class MembershipCommentResponse {
    private String id;
    private UserResponse author;
    private String content;
    private String attachmentUrl;
    private List<MembershipCommentResponse> replies;
    private LocalDateTime createdAt;

    public static MembershipCommentResponse from(MembershipComment c) {
        return MembershipCommentResponse.builder()
                .id(c.getId())
                .author(UserResponse.from(c.getAuthor()))
                .content(c.getContent())
                .attachmentUrl(c.getAttachmentUrl())
                .replies(c.getReplies().stream().map(MembershipCommentResponse::from).toList())
                .createdAt(c.getCreatedAt())
                .build();
    }
}
