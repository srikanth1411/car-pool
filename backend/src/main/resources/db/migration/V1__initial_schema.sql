-- Users table
CREATE TABLE users (
    id          VARCHAR(36) PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    avatar_url  VARCHAR(500),
    phone       VARCHAR(50),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Groups table
CREATE TABLE groups (
    id          VARCHAR(36) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    invite_code VARCHAR(36)  NOT NULL UNIQUE,
    is_private  BOOLEAN      NOT NULL DEFAULT TRUE,
    owner_id    VARCHAR(36)  NOT NULL REFERENCES users(id),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Group memberships
CREATE TABLE group_memberships (
    id         VARCHAR(36) PRIMARY KEY,
    status     VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    role       VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    joined_at  TIMESTAMP,
    created_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    user_id    VARCHAR(36) NOT NULL REFERENCES users(id),
    group_id   VARCHAR(36) NOT NULL REFERENCES groups(id),
    UNIQUE (user_id, group_id)
);

-- Rides table
CREATE TABLE rides (
    id               VARCHAR(36)  PRIMARY KEY,
    origin           VARCHAR(500) NOT NULL,
    origin_lat       DOUBLE PRECISION,
    origin_lng       DOUBLE PRECISION,
    destination      VARCHAR(500) NOT NULL,
    destination_lat  DOUBLE PRECISION,
    destination_lng  DOUBLE PRECISION,
    departure_time   TIMESTAMP    NOT NULL,
    total_seats      INTEGER      NOT NULL,
    available_seats  INTEGER      NOT NULL,
    notes            TEXT,
    status           VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    driver_id        VARCHAR(36)  NOT NULL REFERENCES users(id),
    group_id         VARCHAR(36)  NOT NULL REFERENCES groups(id),
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Ride requests
CREATE TABLE ride_requests (
    id         VARCHAR(36) PRIMARY KEY,
    status     VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    message    TEXT,
    created_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    rider_id   VARCHAR(36) NOT NULL REFERENCES users(id),
    ride_id    VARCHAR(36) NOT NULL REFERENCES rides(id),
    UNIQUE (rider_id, ride_id)
);

-- Notifications
CREATE TABLE notifications (
    id         VARCHAR(36)  PRIMARY KEY,
    type       VARCHAR(50)  NOT NULL,
    title      VARCHAR(255) NOT NULL,
    body       TEXT         NOT NULL,
    read       BOOLEAN      NOT NULL DEFAULT FALSE,
    metadata   JSONB,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    user_id    VARCHAR(36)  NOT NULL REFERENCES users(id)
);

-- Indexes for common queries
CREATE INDEX idx_group_memberships_user_id  ON group_memberships(user_id);
CREATE INDEX idx_group_memberships_group_id ON group_memberships(group_id);
CREATE INDEX idx_rides_group_id             ON rides(group_id);
CREATE INDEX idx_rides_driver_id            ON rides(driver_id);
CREATE INDEX idx_rides_status               ON rides(status);
CREATE INDEX idx_ride_requests_ride_id      ON ride_requests(ride_id);
CREATE INDEX idx_ride_requests_rider_id     ON ride_requests(rider_id);
CREATE INDEX idx_notifications_user_id      ON notifications(user_id);
CREATE INDEX idx_notifications_read         ON notifications(user_id, read);
