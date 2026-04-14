package com.carpool.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ApplicationResponse {
    private String membershipId;
    private UserResponse user;
    private List<FieldValueResponse> fieldValues;

    @Data
    @Builder
    public static class FieldValueResponse {
        private String fieldId;
        private String fieldLabel;
        private String fieldType;
        private String value;
    }
}
