package com.carpool.controller;

import com.carpool.dto.request.*;
import com.carpool.dto.response.*;
import com.carpool.service.GroupService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/groups")
@RequiredArgsConstructor
@Tag(name = "Groups")
@SecurityRequirement(name = "bearerAuth")
public class GroupController {

    private final GroupService groupService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    @Operation(summary = "Create a new carpool group (ADMIN / SUPER_ADMIN only)")
    public ResponseEntity<GroupResponse> createGroup(@AuthenticationPrincipal UserDetails user,
                                                      @Valid @RequestBody CreateGroupRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(groupService.createGroup(user.getUsername(), req));
    }

    @GetMapping("/me")
    @Operation(summary = "Get all groups I am a member of")
    public ResponseEntity<List<GroupResponse>> getMyGroups(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(groupService.getMyGroups(user.getUsername()));
    }

    @GetMapping("/me/pending")
    @Operation(summary = "Get my pending join requests")
    public ResponseEntity<List<MembershipResponse>> getMyPendingRequests(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(groupService.getMyPendingRequests(user.getUsername()));
    }

    @GetMapping("/me/admin-pending")
    @Operation(summary = "Get all pending join requests in groups I admin (for dashboard)")
    public ResponseEntity<List<MembershipResponse>> getAdminPendingRequests(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(groupService.getAdminPendingRequests(user.getUsername()));
    }

    @GetMapping("/invite/{inviteCode}")
    @Operation(summary = "Get group info and fields by invite code (no auth required)")
    public ResponseEntity<GroupResponse> getGroupByInviteCode(@PathVariable String inviteCode) {
        return ResponseEntity.ok(groupService.getGroupByInviteCode(inviteCode));
    }

    @GetMapping("/{groupId}")
    @Operation(summary = "Get group details")
    public ResponseEntity<GroupResponse> getGroup(@AuthenticationPrincipal UserDetails user,
                                                   @PathVariable String groupId) {
        return ResponseEntity.ok(groupService.getGroup(groupId, user.getUsername()));
    }

    @PostMapping("/join")
    @Operation(summary = "Join a group using an invite code")
    public ResponseEntity<MembershipResponse> joinGroup(@AuthenticationPrincipal UserDetails user,
                                                         @RequestBody JoinGroupRequest req) {
        return ResponseEntity.ok(groupService.joinByInviteCode(user.getUsername(), req));
    }

    @GetMapping("/{groupId}/members")
    @Operation(summary = "List approved members of a group")
    public ResponseEntity<List<MembershipResponse>> getMembers(@AuthenticationPrincipal UserDetails user,
                                                                @PathVariable String groupId) {
        return ResponseEntity.ok(groupService.getMembers(user.getUsername(), groupId));
    }

    @GetMapping("/{groupId}/requests")
    @Operation(summary = "List pending join requests (admin only)")
    public ResponseEntity<List<MembershipResponse>> getPendingRequests(@AuthenticationPrincipal UserDetails user,
                                                                        @PathVariable String groupId) {
        return ResponseEntity.ok(groupService.getPendingRequests(user.getUsername(), groupId));
    }

    @PostMapping("/{groupId}/requests/{memberUserId}/approve")
    @Operation(summary = "Approve a pending join request (admin only)")
    public ResponseEntity<MembershipResponse> approve(@AuthenticationPrincipal UserDetails user,
                                                       @PathVariable String groupId,
                                                       @PathVariable String memberUserId) {
        return ResponseEntity.ok(groupService.approveOrRejectMember(user.getUsername(), groupId, memberUserId, true));
    }

    @PostMapping("/{groupId}/requests/{memberUserId}/reject")
    @Operation(summary = "Reject a pending join request (admin only)")
    public ResponseEntity<MembershipResponse> reject(@AuthenticationPrincipal UserDetails user,
                                                      @PathVariable String groupId,
                                                      @PathVariable String memberUserId) {
        return ResponseEntity.ok(groupService.approveOrRejectMember(user.getUsername(), groupId, memberUserId, false));
    }

    @GetMapping("/{groupId}/requests/{memberUserId}/application")
    @Operation(summary = "Get member's submitted application details (admin only)")
    public ResponseEntity<ApplicationResponse> getApplication(@AuthenticationPrincipal UserDetails user,
                                                               @PathVariable String groupId,
                                                               @PathVariable String memberUserId) {
        return ResponseEntity.ok(groupService.getMemberApplication(user.getUsername(), groupId, memberUserId));
    }

    @GetMapping("/{groupId}/members/{memberUserId}/comments")
    @Operation(summary = "Get comments on a membership application")
    public ResponseEntity<List<MembershipCommentResponse>> getComments(@AuthenticationPrincipal UserDetails user,
                                                                        @PathVariable String groupId,
                                                                        @PathVariable String memberUserId) {
        return ResponseEntity.ok(groupService.getComments(user.getUsername(), groupId, memberUserId));
    }

    @PostMapping("/{groupId}/members/{memberUserId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add a comment on a membership application")
    public ResponseEntity<MembershipCommentResponse> addComment(@AuthenticationPrincipal UserDetails user,
                                                                 @PathVariable String groupId,
                                                                 @PathVariable String memberUserId,
                                                                 @RequestBody MembershipCommentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(groupService.addComment(user.getUsername(), groupId, memberUserId, req));
    }

    @DeleteMapping("/{groupId}")
    @Operation(summary = "Delete a group (owner only)")
    public ResponseEntity<Void> deleteGroup(@AuthenticationPrincipal UserDetails user,
                                             @PathVariable String groupId) {
        groupService.deleteGroup(user.getUsername(), groupId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/locations")
    @Operation(summary = "Get nodal points for a group")
    public ResponseEntity<List<GroupLocationResponse>> getLocations(@AuthenticationPrincipal UserDetails user,
                                                                     @PathVariable String groupId) {
        return ResponseEntity.ok(groupService.getLocations(user.getUsername(), groupId));
    }

    @PostMapping("/{groupId}/locations")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add a nodal point to the group (admin only)")
    public ResponseEntity<GroupLocationResponse> addLocation(@AuthenticationPrincipal UserDetails user,
                                                              @PathVariable String groupId,
                                                              @Valid @RequestBody AddGroupLocationRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(groupService.addLocation(user.getUsername(), groupId, req));
    }

    @DeleteMapping("/{groupId}/locations/{locationId}")
    @Operation(summary = "Remove a nodal point from the group (admin only)")
    public ResponseEntity<Void> removeLocation(@AuthenticationPrincipal UserDetails user,
                                                @PathVariable String groupId,
                                                @PathVariable String locationId) {
        groupService.removeLocation(user.getUsername(), groupId, locationId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{groupId}/members/{memberUserId}")
    @Operation(summary = "Remove an approved member from the group (admin only)")
    public ResponseEntity<Void> removeMember(@AuthenticationPrincipal UserDetails user,
                                              @PathVariable String groupId,
                                              @PathVariable String memberUserId) {
        groupService.removeMember(user.getUsername(), groupId, memberUserId);
        return ResponseEntity.noContent().build();
    }
}
