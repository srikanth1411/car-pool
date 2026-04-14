CREATE TABLE ride_preferences (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id VARCHAR(36) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    origin_location_id VARCHAR(36) NOT NULL REFERENCES group_locations(id),
    destination_location_id VARCHAR(36) NOT NULL REFERENCES group_locations(id),
    total_seats INTEGER NOT NULL,
    price NUMERIC(10, 2),
    notes VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ride_preference_stops (
    preference_id VARCHAR(36) NOT NULL REFERENCES ride_preferences(id) ON DELETE CASCADE,
    location_id VARCHAR(36) NOT NULL REFERENCES group_locations(id),
    stop_order INTEGER NOT NULL
);
