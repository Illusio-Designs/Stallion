-- Upcoming (pre-order) products. The server also adds these columns by itself on start-up.
ALTER TABLE product ADD COLUMN is_upcoming TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE product ADD COLUMN preorder_qty INT NOT NULL DEFAULT 0;
