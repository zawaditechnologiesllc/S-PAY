-- Backfill S-PAY IDs for existing users who don't have one
UPDATE users
SET spay_id = 'spay_' || substr(gen_random_uuid()::text, 1, 12)
WHERE spay_id IS NULL;
