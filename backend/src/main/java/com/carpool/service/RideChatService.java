package com.carpool.service;

import com.carpool.dto.request.SendMessageRequest;
import com.carpool.dto.response.RideMessageResponse;
import com.carpool.dto.response.UserResponse;
import com.carpool.enums.NotificationType;
import com.carpool.enums.RequestStatus;
import com.carpool.enums.RideStatus;
import com.carpool.exception.BadRequestException;
import com.carpool.exception.ForbiddenException;
import com.carpool.model.Ride;
import com.carpool.model.RideMessage;
import com.carpool.model.User;
import com.carpool.repository.RideMessageRepository;
import com.carpool.repository.RideRequestRepository;
import com.carpool.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RideChatService {

    private final RideMessageRepository messageRepository;
    private final RideRequestRepository rideRequestRepository;
    private final UserRepository userRepository;
    private final RideService rideService;
    private final NotificationService notificationService;

    @Transactional
    public RideMessageResponse sendMessage(String senderId, String rideId, SendMessageRequest req) {
        Ride ride = rideService.findRideById(rideId);

        if (ride.getStatus() != RideStatus.DEPARTED) {
            throw new BadRequestException("Chat is only available while the ride is in progress");
        }

        boolean isDriver = ride.getDriver().getId().equals(senderId);
        boolean isPassenger = rideRequestRepository.findByRideId(ride.getId()).stream()
                .anyMatch(rr -> rr.getRider().getId().equals(senderId) && rr.getStatus() == RequestStatus.CONFIRMED);
        if (!isDriver && !isPassenger) {
            throw new ForbiddenException("Only the driver and confirmed passengers can send messages");
        }

        User sender = isDriver ? ride.getDriver()
                : rideRequestRepository.findByRideId(ride.getId()).stream()
                        .filter(rr -> rr.getRider().getId().equals(senderId))
                        .findFirst().get().getRider();

        List<User> mentions = req.getMentionedUserIds().isEmpty()
                ? List.of()
                : userRepository.findAllById(req.getMentionedUserIds());

        RideMessage message = RideMessage.builder()
                .ride(ride)
                .sender(sender)
                .content(req.getContent())
                .mentions(mentions)
                .build();

        RideMessage saved = messageRepository.save(message);

        // Notify all other participants
        String preview = saved.getContent().length() > 60
                ? saved.getContent().substring(0, 60) + "…"
                : saved.getContent();
        String title = sender.getName() + " in ride chat";

        // Notify driver if sender is a passenger
        if (!isDriver) {
            notificationService.send(ride.getDriver().getId(), NotificationType.CHAT_MESSAGE,
                    title, preview, Map.of("rideId", ride.getId()));
        }
        // Notify all confirmed passengers except the sender
        rideRequestRepository.findByRideId(ride.getId()).stream()
                .filter(rr -> rr.getStatus() == RequestStatus.CONFIRMED && !rr.getRider().getId().equals(senderId))
                .forEach(rr -> notificationService.send(rr.getRider().getId(), NotificationType.CHAT_MESSAGE,
                        title, preview, Map.of("rideId", ride.getId())));

        return RideMessageResponse.from(saved);
    }

    public List<RideMessageResponse> getMessages(String userId, String rideId) {
        Ride ride = rideService.findRideById(rideId);

        boolean isDriver = ride.getDriver().getId().equals(userId);
        boolean isPassenger = rideRequestRepository.findByRideId(rideId).stream()
                .anyMatch(rr -> rr.getRider().getId().equals(userId) && rr.getStatus() == RequestStatus.CONFIRMED);

        if (!isDriver && !isPassenger) {
            throw new ForbiddenException("Only the driver and confirmed passengers can view the chat");
        }

        return messageRepository.findByRideIdOrderByCreatedAtAsc(rideId)
                .stream().map(RideMessageResponse::from).toList();
    }

    public List<UserResponse> getChatParticipants(String userId, String rideId) {
        Ride ride = rideService.findRideById(rideId);

        boolean isDriver = ride.getDriver().getId().equals(userId);
        boolean isPassenger = rideRequestRepository.findByRideId(rideId).stream()
                .anyMatch(rr -> rr.getRider().getId().equals(userId) && rr.getStatus() == RequestStatus.CONFIRMED);
        if (!isDriver && !isPassenger) {
            throw new ForbiddenException("Not a participant of this ride");
        }

        // Return all participants except the caller (for @mention)
        List<UserResponse> participants = new java.util.ArrayList<>();
        if (!isDriver) participants.add(UserResponse.from(ride.getDriver()));
        rideRequestRepository.findByRideId(rideId).stream()
                .filter(rr -> rr.getStatus() == RequestStatus.CONFIRMED && !rr.getRider().getId().equals(userId))
                .forEach(rr -> participants.add(UserResponse.from(rr.getRider())));
        return participants;
    }

    @Transactional
    public void deleteMessages(String rideId) {
        messageRepository.deleteByRideId(rideId);
    }
}
