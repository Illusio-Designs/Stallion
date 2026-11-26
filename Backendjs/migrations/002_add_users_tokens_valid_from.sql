-- Logout now cancels the old token: tokens issued before this time are rejected.
-- The server also adds this column by itself on start-up if it is missing.
ALTER TABLE users
ADD COLUMN tokens_valid_from DATETIME NULL;
