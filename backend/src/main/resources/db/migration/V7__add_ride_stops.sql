CREATE TABLE ride_stops (
    ride_id    VARCHAR(36) NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    location_id VARCHAR(36) NOT NULL REFERENCES group_locations(id) ON DELETE CASCADE,
    stop_order INT         NOT NULL,
    PRIMARY KEY (ride_id, stop_order)
);

CREATE INDEX idx_ride_stops_ride_id ON ride_stops(ride_id);
