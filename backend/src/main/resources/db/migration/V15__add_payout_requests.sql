CREATE TABLE payout_requests (
    id              VARCHAR(255) PRIMARY KEY,
    wallet_settlement_id VARCHAR(255) REFERENCES wallet_settlements(id),
    driver_id       VARCHAR(255) NOT NULL REFERENCES users(id),
    amount          DECIMAL(10,2) NOT NULL,
    request_id      VARCHAR(255) UNIQUE NOT NULL,
    status          VARCHAR(50)  NOT NULL,
    cf_transfer_id  VARCHAR(255),
    beneficiary_id  VARCHAR(255),
    retry_count     INTEGER      NOT NULL DEFAULT 0,
    failure_reason  TEXT,
    created_at      TIMESTAMP,
    updated_at      TIMESTAMP
);

CREATE INDEX idx_payout_requests_status ON payout_requests(status);
CREATE INDEX idx_payout_requests_driver ON payout_requests(driver_id);
