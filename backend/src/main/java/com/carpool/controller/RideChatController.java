package com.carpool.controller;

import com.carpool.dto.request.SendMessageRequest;
import com.carpool.dto.response.RideMessageResponse;
import com.carpool.dto.response.UserResponse;
import com.carpool.service.RideChatService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rides/{rideId}/chat")
@RequiredArgsConstructor
@Tag(name = "Ride Chat")
@SecurityRequirement(name = "bearerAuth")
public class RideChatController {

    private final RideChatService chatService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<RideMessageResponse> sendMessage(@AuthenticationPrincipal UserDetails user,
                                                           @PathVariable String rideId,
                                                           @Valid @RequestBody SendMessageRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(chatService.sendMessage(user.getUsername(), rideId, req));
    }

    @GetMapping
    public ResponseEntity<List<RideMessageResponse>> getMessages(@AuthenticationPrincipal UserDetails user,
                                                                  @PathVariable String rideId) {
        return ResponseEntity.ok(chatService.getMessages(user.getUsername(), rideId));
    }

    @GetMapping("/participants")
    public ResponseEntity<List<UserResponse>> getParticipants(@AuthenticationPrincipal UserDetails user,
                                                               @PathVariable String rideId) {
        return ResponseEntity.ok(chatService.getChatParticipants(user.getUsername(), rideId));
    }
}
