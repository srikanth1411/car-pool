package com.carpool.controller;

import com.carpool.dto.request.CreateRideRequest;
import com.carpool.dto.request.RideRequestRequest;
import com.carpool.dto.response.RideRequestResponse;
import com.carpool.dto.response.RideResponse;
import com.carpool.service.RideService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/rides")
@RequiredArgsConstructor
@Tag(name = "Rides", description = """
        Ride posting and seat request management.

        Permission summary:
        - POST /rides — any approved group member whose canDrive=true (USER or ADMIN)
        - POST /rides/{id}/request — any approved group member (canDrive=true OR false)
        - Driver-only actions (cancel, confirm/decline requests) — ride's driver only
        - All endpoints require a valid JWT (401 if missing)
        - Non-members get 403
        """)
@SecurityRequirement(name = "bearerAuth")
public class RideController {

    private final RideService rideService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Post a new ride",
               description = "Caller must be an approved group member with canDrive=true. " +
                             "Any user role (USER or ADMIN) may post rides as long as they have canDrive=true.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Ride created"),
        @ApiResponse(responseCode = "403", description = "Not an approved group member, or canDrive=false"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token")
    })
    public ResponseEntity<RideResponse> createRide(@AuthenticationPrincipal UserDetails user,
                                                    @Valid @RequestBody CreateRideRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(rideService.createRide(user.getUsername(), req));
    }

    @GetMapping("/groups")
    @Operation(summary = "Get all rides across all my groups (all statuses)")
    public ResponseEntity<List<RideResponse>> getAllGroupRides(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(rideService.getAllGroupRides(user.getUsername()));
    }

    @GetMapping("/available")
    @Operation(summary = "Get all available (OPEN) rides across my groups")
    public ResponseEntity<List<RideResponse>> getAvailableRides(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(rideService.getAvailableRides(user.getUsername()));
    }

    @GetMapping("/booked")
    @Operation(summary = "Get rides I have booked as a passenger")
    public ResponseEntity<List<RideResponse>> getBookedRides(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(rideService.getBookedRides(user.getUsername()));
    }

    @GetMapping("/me")
    @Operation(summary = "Get rides I am driving (canDrive=true users only)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of rides where caller is the driver"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token")
    })
    public ResponseEntity<List<RideResponse>> getMyRides(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(rideService.getMyRides(user.getUsername()));
    }

    @GetMapping("/group/{groupId}")
    @Operation(summary = "Get all rides in a group")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of rides in the group"),
        @ApiResponse(responseCode = "403", description = "Caller is not an approved member of this group"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token")
    })
    public ResponseEntity<List<RideResponse>> getGroupRides(@AuthenticationPrincipal UserDetails user,
                                                             @PathVariable String groupId) {
        return ResponseEntity.ok(rideService.getRidesForGroup(user.getUsername(), groupId));
    }

    @GetMapping("/{rideId}")
    @Operation(summary = "Get ride details")
    public ResponseEntity<RideResponse> getRide(@AuthenticationPrincipal UserDetails user,
                                                 @PathVariable String rideId) {
        return ResponseEntity.ok(rideService.getRide(user.getUsername(), rideId));
    }

    @PostMapping("/{rideId}/complete")
    @Operation(summary = "Complete a ride (driver only)")
    public ResponseEntity<RideResponse> completeRide(@AuthenticationPrincipal UserDetails user,
                                                      @PathVariable String rideId) {
        return ResponseEntity.ok(rideService.completeRide(user.getUsername(), rideId));
    }

    @PostMapping("/{rideId}/start")
    @Operation(summary = "Start a ride (driver only) — notifies all confirmed passengers")
    public ResponseEntity<RideResponse> startRide(@AuthenticationPrincipal UserDetails user,
                                                   @PathVariable String rideId) {
        return ResponseEntity.ok(rideService.startRide(user.getUsername(), rideId));
    }

    @DeleteMapping("/{rideId}")
    @Operation(summary = "Cancel a ride (driver only)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Ride cancelled; confirmed passengers are notified"),
        @ApiResponse(responseCode = "403", description = "Caller is not the ride's driver"),
        @ApiResponse(responseCode = "400", description = "Ride has already departed or completed"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token")
    })
    public ResponseEntity<RideResponse> cancelRide(@AuthenticationPrincipal UserDetails user,
                                                    @PathVariable String rideId) {
        return ResponseEntity.ok(rideService.cancelRide(user.getUsername(), rideId));
    }

    @DeleteMapping("/{rideId}/request")
    @Operation(summary = "Cancel my booking on a ride (rider only)")
    public ResponseEntity<Void> cancelBooking(@AuthenticationPrincipal UserDetails user,
                                               @PathVariable String rideId) {
        rideService.cancelBooking(user.getUsername(), rideId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{rideId}/request")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Request a seat on a ride",
               description = "Any approved group member may request a seat — including canDrive=false (rider-only) users. " +
                             "The driver cannot request their own ride.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Seat request submitted; driver is notified"),
        @ApiResponse(responseCode = "400", description = "Driver requesting own ride, or ride is not OPEN, or not enough seats for seatsRequested"),
        @ApiResponse(responseCode = "403", description = "Caller is not an approved group member"),
        @ApiResponse(responseCode = "409", description = "Already requested this ride"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token")
    })
    public ResponseEntity<RideRequestResponse> requestSeat(@AuthenticationPrincipal UserDetails user,
                                                            @PathVariable String rideId,
                                                            @RequestBody RideRequestRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(rideService.requestSeat(user.getUsername(), rideId, req));
    }

    @GetMapping("/{rideId}/requests")
    @Operation(summary = "List seat requests for my ride (driver only)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "List of seat requests"),
        @ApiResponse(responseCode = "403", description = "Caller is not the ride's driver"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token")
    })
    public ResponseEntity<List<RideRequestResponse>> getRequests(@AuthenticationPrincipal UserDetails user,
                                                                  @PathVariable String rideId) {
        return ResponseEntity.ok(rideService.getRequestsForRide(user.getUsername(), rideId));
    }

    @PostMapping("/requests/{requestId}/confirm")
    @Operation(summary = "Confirm a seat request (driver only)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Request confirmed; availableSeats decremented by seatsRequested"),
        @ApiResponse(responseCode = "400", description = "Not enough seats remaining for this request"),
        @ApiResponse(responseCode = "403", description = "Caller is not the ride's driver"),
        @ApiResponse(responseCode = "409", description = "Request is no longer PENDING"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token")
    })
    public ResponseEntity<RideRequestResponse> confirmRequest(@AuthenticationPrincipal UserDetails user,
                                                               @PathVariable String requestId) {
        return ResponseEntity.ok(rideService.respondToRequest(user.getUsername(), requestId, true));
    }

    @PostMapping("/requests/{requestId}/decline")
    @Operation(summary = "Decline a seat request (driver only)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Request declined; rider is notified"),
        @ApiResponse(responseCode = "403", description = "Caller is not the ride's driver"),
        @ApiResponse(responseCode = "409", description = "Request is no longer PENDING"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token")
    })
    public ResponseEntity<RideRequestResponse> declineRequest(@AuthenticationPrincipal UserDetails user,
                                                               @PathVariable String requestId) {
        return ResponseEntity.ok(rideService.respondToRequest(user.getUsername(), requestId, false));
    }
}
