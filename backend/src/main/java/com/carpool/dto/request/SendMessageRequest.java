package com.carpool.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class SendMessageRequest {
    @NotBlank
    private String content;
    private List<String> mentionedUserIds = new ArrayList<>();
}
