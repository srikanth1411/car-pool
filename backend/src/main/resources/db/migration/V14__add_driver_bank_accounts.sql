CREATE TABLE driver_bank_accounts (
    id          VARCHAR(36) PRIMARY KEY,
    driver_id   VARCHAR(255) NOT NULL REFERENCES users(id),
    account_holder_name VARCHAR(255) NOT NULL,
    account_number      VARCHAR(50)  NOT NULL,
    ifsc_code           VARCHAR(20)  NOT NULL,
    bank_name           VARCHAR(100),
    is_verified         BOOLEAN      NOT NULL DEFAULT FALSE,
    cf_beneficiary_id   VARCHAR(100),
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (driver_id)
);

CREATE TABLE wallet_settlements (
    id              VARCHAR(36) PRIMARY KEY,
    driver_id       VARCHAR(255) NOT NULL REFERENCES users(id),
    wallet_id       VARCHAR(36)  NOT NULL REFERENCES wallets(id),
    amount          NUMERIC(10,2) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    cf_transfer_id  VARCHAR(100),
    failure_reason  TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);
