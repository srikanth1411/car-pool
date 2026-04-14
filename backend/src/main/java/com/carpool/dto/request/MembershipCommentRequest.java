package com.carpool.dto.request;

import lombok.Data;

@Data
public class MembershipCommentRequest {
    private String content;
    private String attachmentUrl;
    private String parentId;
}
