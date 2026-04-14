-- Group custom fields defined by admin
CREATE TABLE group_fields (
    id            VARCHAR(36)  PRIMARY KEY,
    group_id      VARCHAR(36)  NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    label         VARCHAR(255) NOT NULL,
    field_type    VARCHAR(30)  NOT NULL,  -- TEXT, EMAIL, PHOTO, FILE, ID_CARD
    required      BOOLEAN      NOT NULL DEFAULT FALSE,
    display_order INTEGER      NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- User's answers when joining
CREATE TABLE membership_field_values (
    id            VARCHAR(36) PRIMARY KEY,
    membership_id VARCHAR(36) NOT NULL REFERENCES group_memberships(id) ON DELETE CASCADE,
    field_id      VARCHAR(36) NOT NULL REFERENCES group_fields(id) ON DELETE CASCADE,
    value         TEXT,
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Comments thread on a membership (admin ↔ user)
CREATE TABLE membership_comments (
    id            VARCHAR(36) PRIMARY KEY,
    membership_id VARCHAR(36) NOT NULL REFERENCES group_memberships(id) ON DELETE CASCADE,
    author_id     VARCHAR(36) NOT NULL REFERENCES users(id),
    content       TEXT,
    attachment_url TEXT,
    parent_id     VARCHAR(36) REFERENCES membership_comments(id) ON DELETE CASCADE,
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_fields_group_id           ON group_fields(group_id);
CREATE INDEX idx_membership_field_values_mem_id  ON membership_field_values(membership_id);
CREATE INDEX idx_membership_comments_mem_id      ON membership_comments(membership_id);
CREATE INDEX idx_membership_comments_parent_id   ON membership_comments(parent_id);
