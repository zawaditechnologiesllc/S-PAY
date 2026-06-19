-- Add S-PAY ID field to users for payroll/marketplace integration
ALTER TABLE users ADD COLUMN spay_id TEXT UNIQUE NOT NULL DEFAULT ('spay_' || substr(gen_random_uuid()::text, 1, 12));

-- Index for payroll worker resolution by S-PAY ID
CREATE INDEX idx_users_spay_id ON users(spay_id);
