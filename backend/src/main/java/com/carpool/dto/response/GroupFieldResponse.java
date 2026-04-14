package com.carpool.dto.response;

import com.carpool.enums.GroupFieldType;
import com.carpool.model.GroupField;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GroupFieldResponse {
    private String id;
    private String label;
    private GroupFieldType fieldType;
    private Boolean required;
    private Integer displayOrder;

    public static GroupFieldResponse from(GroupField f) {
        return GroupFieldResponse.builder()
                .id(f.getId())
                .label(f.getLabel())
                .fieldType(f.getFieldType())
                .required(f.getRequired())
                .displayOrder(f.getDisplayOrder())
                .build();
    }
}
