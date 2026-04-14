package com.carpool.service;

import com.carpool.dto.request.CreateRideRequest;
import com.carpool.dto.request.RideRequestRequest;
import com.carpool.dto.response.RideRequestResponse;
import com.carpool.dto.response.RideResponse;
import com.carpool.enums.MembershipStatus;
import com.carpool.enums.NotificationType;
import com.carpool.enums.RequestStatus;
import com.carpool.enums.RideStatus;
import com.carpool.exception.BadRequestException;
import com.carpool.exception.ConflictException;
import com.carpool.exception.ForbiddenException;
import com.carpool.exception.ResourceNotFoundException;
import com.carpool.model.Group;
import com.carpool.model.GroupLocation;
import com.carpool.model.Ride;
import com.carpool.model.RideRequest;
import com.carpool.model.User;
import com.carpool.repository.GroupLocationRepository;
import com.carpool.repository.GroupMembershipRepository;
import com.carpool.repository.RideMessageRepository;
import com.carpool.repository.RideRepository;
import com.carpool.repository.RideRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RideService {

    private final RideRepository rideRepository;
    private final RideRequestRepository rideRequestRepository;
    private final RideMessageRepository rideMessageRepository;
    private final GroupMembershipRepository membershipRepository;
    private final GroupLocationRepository locationRepository;
    private final GroupService groupService;
    private final UserService userService;
    private final NotificationService notificationService;

    @Transactional
    public RideResponse createRide(String driverId, CreateRideRequest req) {
        requireApprovedMember(driverId, req.getGroupId());
        User driver = userService.findUser(driverId);
        if (!driver.isCanDrive()) {
            throw new ForbiddenException("You are registered as a rider and cannot give rides.");
        }
        Group group = groupService.findGroup(req.getGroupId());

        java.time.LocalDate departureDate = req.getDepartureTime().toLocalDate();
        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.LocalDate tomorrow = today.plusDays(1);
        if (departureDate.isBefore(today) || departureDate.isAfter(tomorrow)) {
            throw new BadRequestException("You can only post rides for today or tomorrow");
        }

        boolean hasActiveBooking = rideRequestRepository.existsActiveBookingOnSameDate(
                driverId,
                RequestStatus.CONFIRMED,
                List.of(RideStatus.COMPLETED, RideStatus.CANCELLED),
                req.getDepartureTime()
        );
        if (hasActiveBooking) {
            throw new ConflictException("You have a confirmed booking on this date. Cancel or complete that ride before posting a new one.");
        }

        GroupLocation originLocation = locationRepository.findByIdAndGroupId(req.getOriginLocationId(), req.getGroupId())
                .orElseThrow(() -> new BadRequestException("Origin location does not belong to this group"));
        GroupLocation destinationLocation = locationRepository.findByIdAndGroupId(req.getDestinationLocationId(), req.getGroupId())
                .orElseThrow(() -> new BadRequestException("Destination location does not belong to this group"));
        if (originLocation.getId().equals(destinationLocation.getId())) {
            throw new BadRequestException("Origin and destination cannot be the same location");
        }

        List<com.carpool.model.GroupLocation> intermediateStops = new java.util.ArrayList<>();
        for (String locId : req.getIntermediateLocationIds()) {
            if (locId.equals(req.getOriginLocationId()) || locId.equals(req.getDestinationLocationId())) {
                throw new BadRequestException("Intermediate stop cannot be the same as origin or destination");
            }
            intermediateStops.add(
                locationRepository.findByIdAndGroupId(locId, req.getGroupId())
                    .orElseThrow(() -> new BadRequestException("Intermediate stop '" + locId + "' does not belong to this group"))
            );
        }

        Ride ride = Ride.builder()
                .driver(driver)
                .group(group)
                .origin(originLocation.getName())
                .originLat(originLocation.getLat())
                .originLng(originLocation.getLng())
                .destination(destinationLocation.getName())
                .destinationLat(destinationLocation.getLat())
                .destinationLng(destinationLocation.getLng())
                .originLocation(originLocation)
                .destinationLocation(destinationLocation)
                .intermediateStops(intermediateStops)
                .departureTime(req.getDepartureTime())
                .totalSeats(req.getTotalSeats())
                .availableSeats(req.getTotalSeats())
                .notes(req.getNotes())
                .price(req.getPrice())
                .build();
        rideRepository.save(ride);

        // Notify all approved group members
        membershipRepository.findByGroupIdAndStatus(req.getGroupId(), MembershipStatus.APPROVED)
                .stream()
                .filter(m -> !m.getUser().getId().equals(driverId))
                .forEach(m -> notificationService.send(
                        m.getUser().getId(),
                        NotificationType.RIDE_POSTED,
                        "New ride available",
                        driver.getName() + " posted a ride in " + group.getName(),
                        Map.of("rideId", ride.getId(), "groupId", group.getId())
                ));

        log.info("Ride created: rideId={} by driverId={} in groupId={}", ride.getId(), driverId, req.getGroupId());
        return RideResponse.from(ride);
    }

    public List<RideResponse> getRidesForGroup(String userId, String groupId) {
        requireApprovedMember(userId, groupId);
        return rideRepository.findByGroupIdOrderByDepartureTimeAsc(groupId)
                .stream().map(RideResponse::from).toList();
    }

    public RideResponse getRide(String userId, String rideId) {
        Ride ride = findRide(rideId);
        requireApprovedMember(userId, ride.getGroup().getId());
        return RideResponse.from(ride);
    }

    @Transactional
    public RideResponse startRide(String driverId, String rideId) {
        Ride ride = findRide(rideId);
        if (!ride.getDriver().getId().equals(driverId)) {
            throw new ForbiddenException("Only the driver can start this ride");
        }
        if (ride.getStatus() != RideStatus.OPEN && ride.getStatus() != RideStatus.FULL) {
            throw new BadRequestException("Ride cannot be started in its current state");
        }
        ride.setStatus(RideStatus.DEPARTED);
        rideRepository.save(ride);

        // Notify all confirmed passengers
        rideRequestRepository.findByRideId(rideId).stream()
                .filter(rr -> rr.getStatus() == RequestStatus.CONFIRMED)
                .forEach(rr -> notificationService.send(
                        rr.getRider().getId(),
                        NotificationType.RIDE_STARTED,
                        "Your ride has started!",
                        "The ride from " + ride.getOrigin() + " to " + ride.getDestination() + " has started. Your driver " + ride.getDriver().getName() + " is on the way.",
                        Map.of("rideId", rideId)
                ));

        log.info("Ride started: rideId={} by driverId={}", rideId, driverId);
        return RideResponse.from(ride);
    }

    @Transactional
    public void cancelBooking(String riderId, String rideId) {
        Ride ride = findRide(rideId);
        if (ride.getStatus() == RideStatus.DEPARTED || ride.getStatus() == RideStatus.COMPLETED || ride.getStatus() == RideStatus.CANCELLED) {
            throw new BadRequestException("Cannot drop from a ride that has already started, completed, or been cancelled");
        }
        RideRequest request = rideRequestRepository.findByRiderIdAndRideId(riderId, rideId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", rideId));
        if (request.getStatus() != RequestStatus.CONFIRMED) {
            throw new BadRequestException("No active booking to cancel");
        }
        request.setStatus(RequestStatus.CANCELLED);
        rideRequestRepository.save(request);

        ride.setAvailableSeats(ride.getAvailableSeats() + request.getSeatsRequested());
        if (ride.getStatus() == RideStatus.FULL) ride.setStatus(RideStatus.OPEN);
        rideRepository.save(ride);

        log.info("Booking cancelled: rideId={} riderId={}", rideId, riderId);
    }

    @Transactional
    public RideResponse completeRide(String driverId, String rideId) {
        Ride ride = findRide(rideId);
        if (!ride.getDriver().getId().equals(driverId)) {
            throw new ForbiddenException("Only the driver can complete this ride");
        }
        if (ride.getStatus() != RideStatus.DEPARTED) {
            throw new BadRequestException("Only a started ride can be marked as completed");
        }
        ride.setStatus(RideStatus.COMPLETED);
        rideRepository.save(ride);
        rideMessageRepository.deleteByRideId(rideId);
        log.info("Ride completed: rideId={} by driverId={}", rideId, driverId);
        return RideResponse.from(ride);
    }

    @Transactional
    public RideResponse cancelRide(String userId, String rideId) {
        Ride ride = findRide(rideId);
        if (!ride.getDriver().getId().equals(userId)) {
            throw new ForbiddenException("Only the driver can cancel this ride");
        }
        if (ride.getStatus() == RideStatus.DEPARTED || ride.getStatus() == RideStatus.COMPLETED) {
            throw new BadRequestException("Cannot cancel a ride that has already departed or completed");
        }
        ride.setStatus(RideStatus.CANCELLED);
        rideRepository.save(ride);

        // Notify confirmed passengers
        rideRequestRepository.findByRideId(rideId).stream()
                .filter(rr -> rr.getStatus() == RequestStatus.CONFIRMED)
                .forEach(rr -> notificationService.send(
                        rr.getRider().getId(),
                        NotificationType.RIDE_CANCELLED,
                        "Ride cancelled",
                        "The ride from " + ride.getOrigin() + " to " + ride.getDestination() + " was cancelled",
                        Map.of("rideId", rideId)
                ));

        log.info("Ride cancelled: rideId={} by driverId={}", rideId, userId);
        return RideResponse.from(ride);
    }

    @Transactional
    public RideRequestResponse requestSeat(String riderId, String rideId, RideRequestRequest req) {
        Ride ride = findRide(rideId);
        requireApprovedMember(riderId, ride.getGroup().getId());

        if (ride.getDriver().getId().equals(riderId)) {
            throw new BadRequestException("Driver cannot request their own ride");
        }
        if (ride.getStatus() != RideStatus.OPEN) {
            throw new BadRequestException("Ride is not open for requests");
        }
        if (rideRequestRepository.existsByRiderIdAndRideId(riderId, rideId)) {
            throw new ConflictException("Already requested this ride");
        }

        boolean hasRideOnSameDay = rideRequestRepository.existsActiveBookingOnSameDate(
                riderId,
                RequestStatus.CONFIRMED,
                List.of(RideStatus.COMPLETED, RideStatus.CANCELLED),
                ride.getDepartureTime()
        );
        if (hasRideOnSameDay) {
            throw new ConflictException("You already have a confirmed ride on this date. You cannot book another ride until your current ride is completed.");
        }

        int seats = req.getSeatsRequested() <= 0 ? 1 : req.getSeatsRequested();
        if (seats > ride.getAvailableSeats()) {
            throw new BadRequestException(
                "Only " + ride.getAvailableSeats() + " seat(s) available on this ride");
        }

        // Validate pickup and dropoff are among the ride's stops
        List<com.carpool.model.GroupLocation> allStops = new java.util.ArrayList<>();
        if (ride.getOriginLocation() != null) allStops.add(ride.getOriginLocation());
        allStops.addAll(ride.getIntermediateStops());
        if (ride.getDestinationLocation() != null) allStops.add(ride.getDestinationLocation());
        List<String> validStopIds = allStops.stream().map(com.carpool.model.GroupLocation::getId).toList();

        if (!validStopIds.contains(req.getPickupLocationId())) {
            throw new BadRequestException("Pickup location is not a stop on this ride");
        }
        if (!validStopIds.contains(req.getDropoffLocationId())) {
            throw new BadRequestException("Dropoff location is not a stop on this ride");
        }
        if (req.getPickupLocationId().equals(req.getDropoffLocationId())) {
            throw new BadRequestException("Pickup and dropoff cannot be the same stop");
        }
        int pickupIdx  = validStopIds.indexOf(req.getPickupLocationId());
        int dropoffIdx = validStopIds.indexOf(req.getDropoffLocationId());
        if (pickupIdx >= dropoffIdx) {
            throw new BadRequestException("Pickup must come before dropoff on the route");
        }

        com.carpool.model.GroupLocation pickupLoc  = allStops.get(pickupIdx);
        com.carpool.model.GroupLocation dropoffLoc = allStops.get(dropoffIdx);

        User rider = userService.findUser(riderId);
        RideRequest rideRequest = RideRequest.builder()
                .rider(rider)
                .ride(ride)
                .message(req.getMessage())
                .seatsRequested(seats)
                .status(RequestStatus.CONFIRMED)
                .pickupLocation(pickupLoc)
                .dropoffLocation(dropoffLoc)
                .build();
        rideRequestRepository.save(rideRequest);

        ride.setAvailableSeats(ride.getAvailableSeats() - seats);
        if (ride.getAvailableSeats() == 0) ride.setStatus(RideStatus.FULL);
        rideRepository.save(ride);

        notificationService.send(
                riderId,
                NotificationType.RIDE_REQUEST_CONFIRMED,
                "Seat confirmed",
                "Your seat on the ride from " + ride.getOrigin() + " to " + ride.getDestination() + " is confirmed",
                Map.of("rideId", rideId)
        );

        log.info("Seat auto-confirmed: rideId={} riderId={}", rideId, riderId);
        return RideRequestResponse.from(rideRequest);
    }

    @Transactional
    public RideRequestResponse respondToRequest(String driverId, String requestId, boolean confirm) {
        RideRequest rideRequest = rideRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("RideRequest", requestId));

        Ride ride = rideRequest.getRide();
        if (!ride.getDriver().getId().equals(driverId)) {
            throw new ForbiddenException("Only the driver can respond to requests");
        }
        if (rideRequest.getStatus() != RequestStatus.PENDING) {
            throw new ConflictException("Request is no longer pending");
        }

        if (confirm) {
            int needed = rideRequest.getSeatsRequested();
            if (ride.getAvailableSeats() < needed) {
                throw new BadRequestException(
                    "Only " + ride.getAvailableSeats() + " seat(s) available, but " + needed + " were requested");
            }
            rideRequest.setStatus(RequestStatus.CONFIRMED);
            ride.setAvailableSeats(ride.getAvailableSeats() - needed);
            if (ride.getAvailableSeats() == 0) ride.setStatus(RideStatus.FULL);
            rideRepository.save(ride);
        } else {
            rideRequest.setStatus(RequestStatus.DECLINED);
        }
        rideRequestRepository.save(rideRequest);

        NotificationType type = confirm ? NotificationType.RIDE_REQUEST_CONFIRMED : NotificationType.RIDE_REQUEST_DECLINED;
        String msg = confirm ? "Your seat request was confirmed!" : "Your seat request was declined.";
        notificationService.send(rideRequest.getRider().getId(), type, confirm ? "Confirmed!" : "Declined", msg,
                Map.of("rideId", ride.getId()));

        log.info("Ride request {}: requestId={} by driverId={}", confirm ? "confirmed" : "declined", requestId, driverId);
        return RideRequestResponse.from(rideRequest);
    }

    public List<RideRequestResponse> getRequestsForRide(String driverId, String rideId) {
        Ride ride = findRide(rideId);
        if (!ride.getDriver().getId().equals(driverId)) {
            throw new ForbiddenException("Only the driver can view requests");
        }
        return rideRequestRepository.findByRideId(rideId)
                .stream().map(RideRequestResponse::from).toList();
    }

    public List<RideResponse> getMyRides(String userId) {
        return rideRepository.findByDriverIdOrderByDepartureTimeDesc(userId)
                .stream().map(RideResponse::from).toList();
    }

    public List<RideResponse> getAllGroupRides(String userId) {
        return membershipRepository.findByUserId(userId).stream()
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .flatMap(m -> rideRepository.findByGroupIdOrderByDepartureTimeAsc(m.getGroup().getId()).stream())
                .map(RideResponse::from)
                .toList();
    }

    public List<RideResponse> getAvailableRides(String userId) {
        return membershipRepository.findByUserId(userId).stream()
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .flatMap(m -> rideRepository.findByGroupIdAndStatusOrderByDepartureTimeAsc(
                        m.getGroup().getId(), RideStatus.OPEN).stream())
                .map(RideResponse::from)
                .toList();
    }

    public List<RideResponse> getBookedRides(String userId) {
        return rideRequestRepository.findByRiderId(userId).stream()
                .filter(rr -> rr.getStatus() == RequestStatus.CONFIRMED)
                .map(rr -> RideResponse.from(rr.getRide()))
                .toList();
    }

    public Ride findRideById(String rideId) {
        return rideRepository.findById(rideId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride", rideId));
    }

    private Ride findRide(String rideId) {
        return findRideById(rideId);
    }

    private void requireApprovedMember(String userId, String groupId) {
        membershipRepository.findByUserIdAndGroupId(userId, groupId)
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .orElseThrow(() -> new ForbiddenException("Not an approved member of this group"));
    }
}
