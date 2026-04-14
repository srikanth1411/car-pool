package com.carpool.service;

import com.carpool.dto.response.UserResponse;
import com.carpool.enums.MembershipStatus;
import com.carpool.enums.UserRole;
import com.carpool.exception.BadRequestException;
import com.carpool.exception.ForbiddenException;
import com.carpool.exception.ResourceNotFoundException;
import com.carpool.model.GroupMembership;
import com.carpool.model.User;
import com.carpool.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;

    public Page<UserResponse> listUsers(String callerId, String search, UserRole role, Boolean canDrive, Pageable pageable) {
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new ResourceNotFoundException("User", callerId));

        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // ADMIN sees only users who share an approved group with them
            if (caller.getRole() == UserRole.ADMIN) {
                // Subquery: group IDs the admin belongs to (approved)
                Subquery<String> adminGroups = query.subquery(String.class);
                var gm1 = adminGroups.from(GroupMembership.class);
                adminGroups.select(gm1.get("group").get("id"))
                        .where(
                            cb.equal(gm1.get("user").get("id"), callerId),
                            cb.equal(gm1.get("status"), MembershipStatus.APPROVED)
                        );

                // Subquery: user IDs who are approved members of those groups
                Subquery<String> groupUserIds = query.subquery(String.class);
                var gm2 = groupUserIds.from(GroupMembership.class);
                groupUserIds.select(gm2.get("user").get("id"))
                        .where(
                            gm2.get("group").get("id").in(adminGroups),
                            cb.equal(gm2.get("status"), MembershipStatus.APPROVED)
                        );

                predicates.add(root.get("id").in(groupUserIds));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                List<Predicate> textOr = new ArrayList<>();
                textOr.add(cb.like(cb.lower(root.get("name")),  pattern));
                textOr.add(cb.like(cb.lower(root.get("email")), pattern));
                textOr.add(cb.and(
                    cb.isNotNull(root.get("phone")),
                    cb.like(cb.lower(root.get("phone")), pattern)
                ));
                predicates.add(cb.or(textOr.toArray(new Predicate[0])));
            }

            if (role != null) {
                predicates.add(cb.equal(root.get("role"), role));
            }

            if (canDrive != null) {
                predicates.add(cb.equal(root.get("canDrive"), canDrive));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return userRepository.findAll(spec, pageable).map(UserResponse::from);
    }

    @Transactional
    public UserResponse setUserRole(String superAdminId, String targetUserId, UserRole newRole) {
        if (superAdminId.equals(targetUserId)) {
            throw new BadRequestException("Cannot change your own role");
        }
        // Only SUPER_ADMIN can assign SUPER_ADMIN
        if (newRole == UserRole.SUPER_ADMIN) {
            throw new ForbiddenException("SUPER_ADMIN role cannot be assigned via API");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", targetUserId));

        if (target.getRole() == UserRole.SUPER_ADMIN) {
            throw new ForbiddenException("Cannot change the role of a SUPER_ADMIN");
        }

        UserRole previous = target.getRole();
        target.setRole(newRole);
        userRepository.save(target);

        log.info("Role changed: targetUserId={} {} → {} by superAdminId={}",
                targetUserId, previous, newRole, superAdminId);
        return UserResponse.from(target);
    }
}
