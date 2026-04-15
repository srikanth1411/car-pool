-- Wallets: one per user, tracks driver earnings
CREATE TABLE wallets (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Payments: one per (ride, rider) pair
CREATE TABLE payments (
    id VARCHAR(36) PRIMARY KEY,
    ride_id VARCHAR(36) NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    rider_id VARCHAR(36) NOT NULL REFERENCES users(id),
    driver_id VARCHAR(36) NOT NULL REFERENCES users(id),
    amount NUMERIC(10, 2) NOT NULL,
    seats_paid INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    cf_order_id VARCHAR(200),
    cf_payment_id VARCHAR(200),
    payment_session_id VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ride_id, rider_id)
);

CREATE INDEX idx_payments_ride ON payments(ride_id);
CREATE INDEX idx_payments_rider ON payments(rider_id);
CREATE INDEX idx_payments_driver ON payments(driver_id);
CREATE INDEX idx_payments_cf_order ON payments(cf_order_id);
