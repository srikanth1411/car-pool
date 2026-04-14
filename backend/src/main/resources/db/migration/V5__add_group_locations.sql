CREATE TABLE group_locations (
    id         VARCHAR(36)  PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    lat        DOUBLE PRECISION,
    lng        DOUBLE PRECISION,
    group_id   VARCHAR(36)  NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_locations_group_id ON group_locations(group_id);
