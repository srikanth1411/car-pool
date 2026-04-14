CREATE TABLE ride_messages (
    id VARCHAR(36) PRIMARY KEY,
    ride_id VARCHAR(36) NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    sender_id VARCHAR(36) NOT NULL REFERENCES users(id),
    content VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ride_message_mentions (
    message_id VARCHAR(36) NOT NULL REFERENCES ride_messages(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id)
);
