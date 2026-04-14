package com.carpool.dto.request;

import lombok.Data;

@Data
public class MembershipFieldValueRequest {
    private String fieldId;
    private String value;
}
