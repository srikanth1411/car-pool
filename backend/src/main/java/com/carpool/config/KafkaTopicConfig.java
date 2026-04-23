package com.carpool.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class KafkaTopicConfig {

    @Bean
    public NewTopic payoutRequestsTopic() {
        return TopicBuilder.name("payout_requests").partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic payoutRetryTopic() {
        return TopicBuilder.name("payout_retry").partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic payoutDlqTopic() {
        return TopicBuilder.name("payout_dlq").partitions(1).replicas(1).build();
    }
}
