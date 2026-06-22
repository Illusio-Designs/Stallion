-- Add billing fields to parties (shipping remains in `address`)
ALTER TABLE parties
ADD COLUMN billing_address TEXT NULL AFTER address,
ADD COLUMN billing_same_as_shipping TINYINT(1) NOT NULL DEFAULT 1 AFTER billing_address;

-- Existing rows: billing same as shipping
UPDATE parties
SET
    billing_same_as_shipping = 1
WHERE
    billing_same_as_shipping IS NULL;