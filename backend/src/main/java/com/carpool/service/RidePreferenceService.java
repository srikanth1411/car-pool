package com.carpool.service;

import com.carpool.dto.request.CreateRideRequest;
import com.carpool.dto.request.SavePreferenceRequest;
import com.carpool.dto.response.RidePreferenceResponse;
import com.carpool.dto.response.RideResponse;
import com.carpool.exception.ForbiddenException;
import com.carpool.exception.ResourceNotFoundException;
import com.carpool.model.GroupLocation;
import com.carpool.model.RidePreference;
import com.carpool.model.User;
import com.carpool.repository.GroupLocationRepository;
import com.carpool.repository.RidePreferenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RidePreferenceService {

    private final RidePreferenceRepository preferenceRepository;
    private final GroupLocationRepository locationRepository;
    private final GroupService groupService;
    private final UserService userService;
    private final RideService rideService;

    @Transactional
    public RidePreferenceResponse save(String userId, SavePreferenceRequest req) {
        User user = userService.findUser(userId);
        var group = groupService.findGroup(req.getGroupId());

        GroupLocation origin = locationRepository.findByIdAndGroupId(req.getOriginLocationId(), req.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("Location", req.getOriginLocationId()));
        GroupLocation destination = locationRepository.findByIdAndGroupId(req.getDestinationLocationId(), req.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("Location", req.getDestinationLocationId()));

        List<GroupLocation> stops = new ArrayList<>();
        for (String locId : req.getIntermediateLocationIds()) {
            stops.add(locationRepository.findByIdAndGroupId(locId, req.getGroupId())
                    .orElseThrow(() -> new ResourceNotFoundException("Location", locId)));
        }

        RidePreference pref = RidePreference.builder()
                .user(user)
                .group(group)
                .tag(req.getTag())
                .originLocation(origin)
                .destinationLocation(destination)
                .intermediateStops(stops)
                .totalSeats(req.getTotalSeats())
                .price(req.getPrice())
                .notes(req.getNotes())
                .build();

        return RidePreferenceResponse.from(preferenceRepository.save(pref));
    }

    public List<RidePreferenceResponse> getMyPreferences(String userId) {
        return preferenceRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(RidePreferenceResponse::from).toList();
    }

    @Transactional
    public void delete(String userId, String preferenceId) {
        RidePreference pref = preferenceRepository.findById(preferenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Preference", preferenceId));
        if (!pref.getUser().getId().equals(userId)) {
            throw new ForbiddenException("Not your preference");
        }
        preferenceRepository.delete(pref);
    }

    @Transactional
    public RideResponse postFromPreference(String userId, String preferenceId, LocalDateTime departureTime) {
        RidePreference pref = preferenceRepository.findById(preferenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Preference", preferenceId));
        if (!pref.getUser().getId().equals(userId)) {
            throw new ForbiddenException("Not your preference");
        }

        CreateRideRequest req = new CreateRideRequest();
        req.setGroupId(pref.getGroup().getId());
        req.setOriginLocationId(pref.getOriginLocation().getId());
        req.setDestinationLocationId(pref.getDestinationLocation().getId());
        req.setIntermediateLocationIds(pref.getIntermediateStops().stream().map(GroupLocation::getId).toList());
        req.setDepartureTime(departureTime);
        req.setTotalSeats(pref.getTotalSeats());
        req.setPrice(pref.getPrice());
        req.setNotes(pref.getNotes());

        return rideService.createRide(userId, req);
    }
}
