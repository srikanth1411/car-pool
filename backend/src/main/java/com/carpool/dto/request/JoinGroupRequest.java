package com.carpool.dto.request;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class JoinGroupRequest {
    private String inviteCode;
    private List<MembershipFieldValueRequest> fieldValues = new ArrayList<>();
}
