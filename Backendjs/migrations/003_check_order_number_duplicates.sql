-- Run this first. If it returns no rows, every order number is unique.
-- The server adds the unique rule by itself on start-up when there are no duplicates.
SELECT order_number, COUNT(*) AS orders
FROM `order`
GROUP BY order_number
HAVING COUNT(*) > 1;

-- The rule the server adds (you can also run it by hand once the query above is empty):
-- ALTER TABLE `order` ADD UNIQUE INDEX uq_order_order_number (order_number);
