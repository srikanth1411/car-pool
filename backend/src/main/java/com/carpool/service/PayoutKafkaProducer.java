package com.carpool.service;

import com.carpool.dto.PayoutEventMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutKafkaProducer {

    private final KafkaTemplate<String, PayoutEventMessage> kafkaTemplate;

    public void publishPayoutRequest(PayoutEventMessage msg) {
        kafkaTemplate.send("payout_requests", msg.getRequestId(), msg)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish payout_requests event: requestId={} error={}", msg.getRequestId(), ex.getMessage());
                    } else {
                        log.info("Published payout_requests event: requestId={} offset={}", msg.getRequestId(), result.getRecordMetadata().offset());
                    }
                });
    }

    public void publishRetry(PayoutEventMessage msg) {
        kafkaTemplate.send("payout_retry", msg.getRequestId(), msg)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish payout_retry event: requestId={}", msg.getRequestId());
                    } else {
                        log.info("Published payout_retry event: requestId={} retryCount={}", msg.getRequestId(), msg.getRetryCount());
                    }
                });
    }

    public void publishDlq(PayoutEventMessage msg) {
        kafkaTemplate.send("payout_dlq", msg.getRequestId(), msg)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish payout_dlq event: requestId={}", msg.getRequestId());
                    } else {
                        log.warn("Published payout_dlq event: requestId={}", msg.getRequestId());
                    }
                });
    }
}
