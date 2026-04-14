package com.carpool.service;

import com.carpool.dto.request.*;
import com.carpool.dto.response.*;
import com.carpool.enums.GroupFieldType;
import com.carpool.enums.MembershipRole;
import com.carpool.enums.MembershipStatus;
import com.carpool.enums.NotificationType;
import com.carpool.exception.BadRequestException;
import com.carpool.exception.ConflictException;
import com.carpool.exception.ForbiddenException;
import com.carpool.exception.ResourceNotFoundException;
import com.carpool.model.*;
import com.carpool.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMembershipRepository membershipRepository;
    private final GroupLocationRepository locationRepository;
    private final GroupFieldRepository fieldRepository;
    private final MembershipFieldValueRepository fieldValueRepository;
    private final MembershipCommentRepository commentRepository;
    private final UserService userService;
    private final NotificationService notificationService;
    private final UploadService uploadService;

    @Transactional
    public GroupResponse createGroup(String userId, CreateGroupRequest req) {
        User owner = userService.findUser(userId);

        Group group = Group.builder()
                .name(req.getName())
                .description(req.getDescription())
                .isPrivate(req.getIsPrivate() != null ? req.getIsPrivate() : true)
                .owner(owner)
                .build();
        groupRepository.save(group);

        GroupMembership membership = GroupMembership.builder()
                .user(owner).group(group)
                .status(MembershipStatus.APPROVED).role(MembershipRole.ADMIN)
                .joinedAt(LocalDateTime.now())
                .build();
        membershipRepository.save(membership);

        if (req.getLocations() != null) {
            req.getLocations().forEach(locReq -> locationRepository.save(
                GroupLocation.builder().name(locReq.getName()).lat(locReq.getLat()).lng(locReq.getLng()).group(group).build()
            ));
        }

        if (req.getFields() != null) {
            for (int i = 0; i < req.getFields().size(); i++) {
                GroupFieldRequest fr = req.getFields().get(i);
                fieldRepository.save(GroupField.builder()
                        .group(group).label(fr.getLabel()).fieldType(fr.getFieldType())
                        .required(fr.getRequired() != null ? fr.getRequired() : false)
                        .displayOrder(fr.getDisplayOrder() != null ? fr.getDisplayOrder() : i)
                        .build());
            }
        }

        log.info("Group created: groupId={} by userId={}", group.getId(), userId);
        List<GroupLocationResponse> locations = locationRepository.findByGroupIdOrderByCreatedAtAsc(group.getId())
                .stream().map(GroupLocationResponse::from).toList();
        List<GroupFieldResponse> fields = fieldRepository.findByGroupIdOrderByDisplayOrderAsc(group.getId())
                .stream().map(GroupFieldResponse::from).toList();
        return GroupResponse.from(group, 1, locations, fields);
    }

    public GroupResponse getGroup(String groupId, String userId) {
        Group group = findGroup(groupId);
        requireApprovedMember(userId, groupId);
        int memberCount = membershipRepository.findByGroupIdAndStatus(groupId, MembershipStatus.APPROVED).size();
        List<GroupLocationResponse> locations = locationRepository.findByGroupIdOrderByCreatedAtAsc(groupId)
                .stream().map(GroupLocationResponse::from).toList();
        List<GroupFieldResponse> fields = fieldRepository.findByGroupIdOrderByDisplayOrderAsc(groupId)
                .stream().map(GroupFieldResponse::from).toList();
        return GroupResponse.from(group, memberCount, locations, fields);
    }

    public GroupResponse getGroupByInviteCode(String inviteCode) {
        Group group = groupRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid invite code"));
        int memberCount = membershipRepository.findByGroupIdAndStatus(group.getId(), MembershipStatus.APPROVED).size();
        List<GroupLocationResponse> locations = locationRepository.findByGroupIdOrderByCreatedAtAsc(group.getId())
                .stream().map(GroupLocationResponse::from).toList();
        List<GroupFieldResponse> fields = fieldRepository.findByGroupIdOrderByDisplayOrderAsc(group.getId())
                .stream().map(GroupFieldResponse::from).toList();
        return GroupResponse.from(group, memberCount, locations, fields);
    }

    public List<MembershipResponse> getMyPendingRequests(String userId) {
        return membershipRepository.findByUserIdAndStatus(userId, MembershipStatus.PENDING)
                .stream().map(MembershipResponse::from).toList();
    }

    public List<MembershipResponse> getAdminPendingRequests(String userId) {
        return membershipRepository.findByStatusInGroupsManagedBy(userId, MembershipRole.ADMIN, MembershipStatus.PENDING)
                .stream()
                .filter(m -> !m.getUser().getId().equals(userId))
                .map(MembershipResponse::from).toList();
    }

    public List<GroupResponse> getMyGroups(String userId) {
        return membershipRepository.findByUserId(userId).stream()
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .map(m -> {
                    String gid = m.getGroup().getId();
                    int count = membershipRepository.findByGroupIdAndStatus(gid, MembershipStatus.APPROVED).size();
                    List<GroupLocationResponse> locations = locationRepository.findByGroupIdOrderByCreatedAtAsc(gid)
                            .stream().map(GroupLocationResponse::from).toList();
                    List<GroupFieldResponse> fields = fieldRepository.findByGroupIdOrderByDisplayOrderAsc(gid)
                            .stream().map(GroupFieldResponse::from).toList();
                    return GroupResponse.from(m.getGroup(), count, locations, fields);
                })
                .toList();
    }

    @Transactional
    public void deleteGroup(String userId, String groupId) {
        Group group = findGroup(groupId);
        if (!group.getOwner().getId().equals(userId)) {
            throw new ForbiddenException("Only the group owner can delete this group");
        }
        groupRepository.delete(group);
        log.info("Group deleted: groupId={} by userId={}", groupId, userId);
    }

    public List<GroupLocationResponse> getLocations(String userId, String groupId) {
        requireApprovedMember(userId, groupId);
        return locationRepository.findByGroupIdOrderByCreatedAtAsc(groupId)
                .stream().map(GroupLocationResponse::from).toList();
    }

    @Transactional
    public GroupLocationResponse addLocation(String adminUserId, String groupId, AddGroupLocationRequest req) {
        requireAdmin(adminUserId, groupId);
        Group group = findGroup(groupId);
        GroupLocation location = GroupLocation.builder()
                .name(req.getName()).lat(req.getLat()).lng(req.getLng()).group(group).build();
        locationRepository.save(location);
        log.info("Location added: groupId={} locationId={} by adminId={}", groupId, location.getId(), adminUserId);
        return GroupLocationResponse.from(location);
    }

    @Transactional
    public void removeLocation(String adminUserId, String groupId, String locationId) {
        requireAdmin(adminUserId, groupId);
        GroupLocation location = locationRepository.findByIdAndGroupId(locationId, groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Location not found"));
        locationRepository.delete(location);
        log.info("Location removed: groupId={} locationId={} by adminId={}", groupId, locationId, adminUserId);
    }

    @Transactional
    public MembershipResponse joinByInviteCode(String userId, JoinGroupRequest req) {
        Group group = groupRepository.findByInviteCode(req.getInviteCode())
                .orElseThrow(() -> new ResourceNotFoundException("Invalid invite code"));

        if (membershipRepository.existsByUserIdAndGroupId(userId, group.getId())) {
            throw new ConflictException("Already a member of this group");
        }

        // Validate required fields
        List<GroupField> requiredFields = fieldRepository.findByGroupIdOrderByDisplayOrderAsc(group.getId())
                .stream().filter(GroupField::getRequired).toList();
        for (GroupField rf : requiredFields) {
            boolean filled = req.getFieldValues().stream()
                    .anyMatch(fv -> rf.getId().equals(fv.getFieldId()) && fv.getValue() != null && !fv.getValue().isBlank());
            if (!filled) throw new BadRequestException("Required field missing: " + rf.getLabel());
        }

        User user = userService.findUser(userId);
        MembershipStatus status = group.getIsPrivate() ? MembershipStatus.PENDING : MembershipStatus.APPROVED;

        GroupMembership membership = GroupMembership.builder()
                .user(user).group(group).status(status).role(MembershipRole.MEMBER)
                .joinedAt(status == MembershipStatus.APPROVED ? LocalDateTime.now() : null)
                .build();
        membershipRepository.save(membership);

        // Save field values
        if (req.getFieldValues() != null) {
            for (MembershipFieldValueRequest fv : req.getFieldValues()) {
                GroupField field = fieldRepository.findById(fv.getFieldId()).orElse(null);
                if (field == null) continue;
                fieldValueRepository.save(MembershipFieldValue.builder()
                        .membership(membership).field(field).value(fv.getValue()).build());
            }
        }

        if (status == MembershipStatus.PENDING) {
            notificationService.send(
                group.getOwner().getId(), NotificationType.JOIN_REQUEST_RECEIVED,
                "New join request",
                user.getName() + " wants to join " + group.getName(),
                Map.of("groupId", group.getId(), "userId", userId, "membershipId", membership.getId())
            );
        }

        log.info("User joined group: userId={} groupId={} status={}", userId, group.getId(), status);
        return MembershipResponse.from(membership);
    }

    @Transactional
    public MembershipResponse approveOrRejectMember(String adminUserId, String groupId, String memberUserId, boolean approve) {
        requireAdmin(adminUserId, groupId);

        GroupMembership membership = membershipRepository.findByUserIdAndGroupId(memberUserId, groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Membership not found"));

        if (membership.getStatus() != MembershipStatus.PENDING) {
            throw new ConflictException("Membership is not in PENDING state");
        }

        membership.setStatus(approve ? MembershipStatus.APPROVED : MembershipStatus.REJECTED);
        if (approve) membership.setJoinedAt(LocalDateTime.now());
        membershipRepository.save(membership);

        Group group = findGroup(groupId);
        NotificationType type = approve ? NotificationType.JOIN_APPROVED : NotificationType.JOIN_REJECTED;
        String msg = approve ? "Your request to join " + group.getName() + " was approved"
                             : "Your request to join " + group.getName() + " was rejected";
        notificationService.send(memberUserId, type, approve ? "Welcome!" : "Request rejected", msg,
                Map.of("groupId", groupId));
        notificationService.markJoinRequestNotificationRead(groupId, memberUserId);

        if (approve) {
            deleteApplicationFiles(membership.getId());
        }

        log.info("Membership {}: userId={} groupId={} by adminId={}", approve ? "approved" : "rejected",
                memberUserId, groupId, adminUserId);
        return MembershipResponse.from(membership);
    }

    public List<MembershipResponse> getPendingRequests(String adminUserId, String groupId) {
        requireAdmin(adminUserId, groupId);
        return membershipRepository.findByGroupIdAndStatus(groupId, MembershipStatus.PENDING)
                .stream().map(MembershipResponse::from).toList();
    }

    public ApplicationResponse getMemberApplication(String adminUserId, String groupId, String memberUserId) {
        requireAdmin(adminUserId, groupId);
        GroupMembership membership = membershipRepository.findByUserIdAndGroupId(memberUserId, groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Membership not found"));

        List<MembershipFieldValue> values = fieldValueRepository.findByMembershipId(membership.getId());
        Map<String, String> valueMap = values.stream().collect(
                Collectors.toMap(v -> v.getField().getId(), MembershipFieldValue::getValue, (v1, v2) -> v1));

        List<GroupField> allFields = fieldRepository.findByGroupIdOrderByDisplayOrderAsc(groupId);
        List<ApplicationResponse.FieldValueResponse> fieldValues = allFields.stream().map(f ->
                ApplicationResponse.FieldValueResponse.builder()
                        .fieldId(f.getId())
                        .fieldLabel(f.getLabel())
                        .fieldType(f.getFieldType().name())
                        .value(valueMap.get(f.getId()))
                        .build()
        ).toList();

        return ApplicationResponse.builder()
                .membershipId(membership.getId())
                .user(UserResponse.from(membership.getUser()))
                .fieldValues(fieldValues)
                .build();
    }

    @Transactional
    public MembershipCommentResponse addComment(String authorId, String groupId, String memberUserId, MembershipCommentRequest req) {
        // Author must be admin OR the member themselves
        GroupMembership authorMem = membershipRepository.findByUserIdAndGroupId(authorId, groupId).orElse(null);
        GroupMembership targetMem = membershipRepository.findByUserIdAndGroupId(memberUserId, groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Membership not found"));

        boolean isAdminAuthor = authorMem != null && authorMem.getRole() == MembershipRole.ADMIN;
        boolean isSelfAuthor = authorId.equals(memberUserId);
        if (!isAdminAuthor && !isSelfAuthor) throw new ForbiddenException("Not allowed to comment on this application");

        if ((req.getContent() == null || req.getContent().isBlank()) && (req.getAttachmentUrl() == null || req.getAttachmentUrl().isBlank())) {
            throw new BadRequestException("Comment must have content or an attachment");
        }

        User author = userService.findUser(authorId);
        MembershipComment parent = null;
        if (req.getParentId() != null) {
            parent = commentRepository.findById(req.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Parent comment not found"));
        }

        MembershipComment comment = MembershipComment.builder()
                .membership(targetMem).author(author)
                .content(req.getContent()).attachmentUrl(req.getAttachmentUrl())
                .parent(parent)
                .build();
        commentRepository.save(comment);
        return MembershipCommentResponse.from(comment);
    }

    public List<MembershipCommentResponse> getComments(String requesterId, String groupId, String memberUserId) {
        GroupMembership requesterMem = membershipRepository.findByUserIdAndGroupId(requesterId, groupId).orElse(null);
        boolean isAdmin = requesterMem != null && requesterMem.getRole() == MembershipRole.ADMIN;
        boolean isSelf = requesterId.equals(memberUserId);
        if (!isAdmin && !isSelf) throw new ForbiddenException("Not allowed to view these comments");

        GroupMembership targetMem = membershipRepository.findByUserIdAndGroupId(memberUserId, groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Membership not found"));

        return commentRepository.findByMembershipIdAndParentIsNullOrderByCreatedAtAsc(targetMem.getId())
                .stream().map(MembershipCommentResponse::from).toList();
    }

    @Transactional
    public void removeMember(String adminUserId, String groupId, String targetUserId) {
        requireAdmin(adminUserId, groupId);
        if (adminUserId.equals(targetUserId)) throw new BadRequestException("Cannot remove yourself from the group");

        GroupMembership membership = membershipRepository.findByUserIdAndGroupId(targetUserId, groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Membership not found"));
        if (membership.getRole() == MembershipRole.ADMIN) throw new ForbiddenException("Cannot remove a group admin");

        membershipRepository.delete(membership);
        Group group = findGroup(groupId);
        notificationService.send(targetUserId, NotificationType.JOIN_REJECTED, "Removed from group",
                "You have been removed from " + group.getName(), Map.of("groupId", groupId));
        log.info("Member removed: targetUserId={} groupId={} by adminId={}", targetUserId, groupId, adminUserId);
    }

    public List<MembershipResponse> getMembers(String userId, String groupId) {
        requireApprovedMember(userId, groupId);
        return membershipRepository.findByGroupIdAndStatus(groupId, MembershipStatus.APPROVED)
                .stream().map(MembershipResponse::from).toList();
    }

    Group findGroup(String groupId) {
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group", groupId));
    }

    private void requireApprovedMember(String userId, String groupId) {
        GroupMembership m = membershipRepository.findByUserIdAndGroupId(userId, groupId)
                .orElseThrow(() -> new ForbiddenException("Not a member of this group"));
        if (m.getStatus() != MembershipStatus.APPROVED) throw new ForbiddenException("Membership not approved");
    }

    private void deleteApplicationFiles(String membershipId) {
        List<MembershipFieldValue> values = fieldValueRepository.findByMembershipId(membershipId);
        values.stream()
                .filter(v -> {
                    GroupFieldType type = v.getField().getFieldType();
                    return type == GroupFieldType.PHOTO
                        || type == GroupFieldType.ID_CARD
                        || type == GroupFieldType.FILE;
                })
                .forEach(v -> uploadService.deleteFile(v.getValue()));
        fieldValueRepository.deleteByMembershipId(membershipId);
        log.info("Deleted application files and field values for membershipId={}", membershipId);
    }

    private void requireAdmin(String userId, String groupId) {
        GroupMembership m = membershipRepository.findByUserIdAndGroupId(userId, groupId)
                .orElseThrow(() -> new ForbiddenException("Not a member of this group"));
        if (m.getRole() != MembershipRole.ADMIN) throw new ForbiddenException("Admin access required");
    }
}
