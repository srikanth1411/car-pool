ALTER TABLE ride_requests ADD COLUMN pickup_location_id  VARCHAR(36) REFERENCES group_locations(id) ON DELETE SET NULL;
ALTER TABLE ride_requests ADD COLUMN dropoff_location_id VARCHAR(36) REFERENCES group_locations(id) ON DELETE SET NULL;
