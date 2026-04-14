package com.carpool.controller;

import com.carpool.dto.request.SavePreferenceRequest;
import com.carpool.dto.response.RidePreferenceResponse;
import com.carpool.dto.response.RideResponse;
import com.carpool.service.RidePreferenceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/preferences")
@RequiredArgsConstructor
public class RidePreferenceController {

    private final RidePreferenceService preferenceService;

    @PostMapping
    public ResponseEntity<RidePreferenceResponse> save(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody SavePreferenceRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(preferenceService.save(userDetails.getUsername(), req));
    }

    @GetMapping
    public ResponseEntity<List<RidePreferenceResponse>> getMyPreferences(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(preferenceService.getMyPreferences(userDetails.getUsername()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String id) {
        preferenceService.delete(userDetails.getUsername(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/post")
    public ResponseEntity<RideResponse> postFromPreference(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        LocalDateTime departureTime = Instant.parse(body.get("departureTime"))
                .atOffset(ZoneOffset.UTC).toLocalDateTime();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(preferenceService.postFromPreference(userDetails.getUsername(), id, departureTime));
    }
}
