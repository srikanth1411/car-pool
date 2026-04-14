ALTER TABLE rides ADD COLUMN origin_location_id      VARCHAR(36) REFERENCES group_locations(id) ON DELETE SET NULL;
ALTER TABLE rides ADD COLUMN destination_location_id VARCHAR(36) REFERENCES group_locations(id) ON DELETE SET NULL;

CREATE INDEX idx_rides_origin_location      ON rides(origin_location_id);
CREATE INDEX idx_rides_destination_location ON rides(destination_location_id);
