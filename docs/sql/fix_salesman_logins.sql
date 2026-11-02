-- Fix salesman (and distributor) logins that say "User not found".
-- Run in MySQL 8 against the Stallion database. Read every step; run the STEP 1 queries first.
-- Take a backup (or at least run STEP 1 and keep the output) before STEP 2.
--
-- What it does, for every ACTIVE salesman:
--   a) makes sure a login user exists (creates one when missing) and links salesmen.user_id to it,
--   b) saves the login phone in the one form the app matches: +91XXXXXXXXXX,
--   c) switches the login user on (the salesman record is where people are switched off),
--   d) makes sure the user has the 'salesman' role in user_roles.
-- Nothing is deleted. Salesmen with is_active = 0 are left alone.

-- =====================================================================
-- STEP 1. LOOK FIRST (read only)
-- =====================================================================

-- 1a. Which salesmen have a login problem, and what is the problem?
SELECT s.salesman_id,
       s.employee_code,
       s.full_name,
       s.phone                                                         AS salesman_phone,
       u.user_id                                                        AS user_id,
       u.phone                                                          AS user_phone,
       u.is_active                                                      AS user_active,
       CONCAT('+91', RIGHT(REGEXP_REPLACE(s.phone, '[^0-9]', ''), 10)) AS wanted_phone,
       CASE
         WHEN u.user_id IS NULL                                                       THEN 'no login user'
         WHEN u.is_active = 0                                                         THEN 'login user is inactive'
         WHEN u.phone <> CONCAT('+91', RIGHT(REGEXP_REPLACE(s.phone, '[^0-9]', ''), 10)) THEN 'phone saved in another form'
         WHEN NOT EXISTS (SELECT 1 FROM user_roles ur
                          JOIN roles r ON r.role_id = ur.role_id AND r.role_name = 'salesman'
                          WHERE ur.user_id = u.user_id)                               THEN 'salesman role missing'
         ELSE 'ok'
       END AS problem
FROM salesmen s
LEFT JOIN users u ON u.user_id = s.user_id
WHERE s.is_active = 1
ORDER BY problem, s.employee_code;

-- 1b. Another login user already owns the number? (would clash when we fix the phone)
SELECT s.employee_code, s.full_name, s.phone AS salesman_phone, o.user_id AS other_user_id, o.phone AS other_phone, o.full_name AS other_name
FROM salesmen s
JOIN users o
  ON RIGHT(REGEXP_REPLACE(o.phone, '[^0-9]', ''), 10) = RIGHT(REGEXP_REPLACE(s.phone, '[^0-9]', ''), 10)
 AND o.user_id <> IFNULL(s.user_id, '')
WHERE s.is_active = 1;

-- 1c. The salesman role id (must return one row).
SELECT role_id, role_name FROM roles WHERE role_name = 'salesman';


-- =====================================================================
-- STEP 2. FIX (run all of it together; it is one transaction)
-- =====================================================================
START TRANSACTION;

SET @salesman_role := (SELECT role_id FROM roles WHERE role_name = 'salesman' LIMIT 1);

-- 2a. For salesmen whose login user row does not exist: first try to adopt a user that already
--     has the same number (any format); otherwise create a new one.
DROP TEMPORARY TABLE IF EXISTS tmp_salesman_user;
CREATE TEMPORARY TABLE tmp_salesman_user AS
SELECT s.salesman_id,
       COALESCE(
         (SELECT o.user_id FROM users o
           WHERE RIGHT(REGEXP_REPLACE(o.phone, '[^0-9]', ''), 10) = RIGHT(REGEXP_REPLACE(s.phone, '[^0-9]', ''), 10)
           LIMIT 1),
         UUID()
       ) AS new_user_id,
       EXISTS (SELECT 1 FROM users o
                WHERE RIGHT(REGEXP_REPLACE(o.phone, '[^0-9]', ''), 10) = RIGHT(REGEXP_REPLACE(s.phone, '[^0-9]', ''), 10)) AS user_exists
FROM salesmen s
WHERE s.is_active = 1
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = s.user_id);

-- create the missing users (phone in +91 form, email only when no other user has it)
INSERT INTO users (user_id, phone, email, full_name, address, role_id, is_active, created_at, updated_at)
SELECT t.new_user_id,
       CONCAT('+91', RIGHT(REGEXP_REPLACE(s.phone, '[^0-9]', ''), 10)),
       CASE WHEN s.email IS NOT NULL AND s.email <> ''
                 AND NOT EXISTS (SELECT 1 FROM users e WHERE e.email = s.email) THEN s.email ELSE NULL END,
       s.full_name,
       COALESCE(NULLIF(s.address, ''), 'N/A'),
       @salesman_role,
       1, NOW(), NOW()
FROM tmp_salesman_user t
JOIN salesmen s ON s.salesman_id = t.salesman_id
WHERE t.user_exists = 0;

-- link the salesman rows to their (new or adopted) user
UPDATE salesmen s
JOIN tmp_salesman_user t ON t.salesman_id = s.salesman_id
SET s.user_id = t.new_user_id, s.updated_at = NOW();

-- 2b. Phone in the one form the app matches (+91 and 10 digits), only where no other user has it.
UPDATE users u
JOIN salesmen s ON s.user_id = u.user_id AND s.is_active = 1
SET u.phone = CONCAT('+91', RIGHT(REGEXP_REPLACE(s.phone, '[^0-9]', ''), 10)), u.updated_at = NOW()
WHERE u.phone <> CONCAT('+91', RIGHT(REGEXP_REPLACE(s.phone, '[^0-9]', ''), 10))
  AND NOT EXISTS (SELECT 1 FROM (SELECT user_id, phone FROM users) x
                   WHERE x.phone = CONCAT('+91', RIGHT(REGEXP_REPLACE(s.phone, '[^0-9]', ''), 10))
                     AND x.user_id <> u.user_id);

-- 2c. Switch the login user on for every active salesman.
UPDATE users u
JOIN salesmen s ON s.user_id = u.user_id AND s.is_active = 1
SET u.is_active = 1, u.updated_at = NOW()
WHERE u.is_active = 0;

-- 2d. Make sure the salesman role link exists.
INSERT INTO user_roles (user_role_id, user_id, role_id, assigned_at)
SELECT UUID(), s.user_id, @salesman_role, NOW()
FROM salesmen s
WHERE s.is_active = 1
  AND s.user_id IS NOT NULL
  AND @salesman_role IS NOT NULL
  AND EXISTS (SELECT 1 FROM users u WHERE u.user_id = s.user_id)
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = s.user_id AND ur.role_id = @salesman_role);

-- Check the result before keeping it: every row below should say ok.
SELECT s.employee_code, s.full_name, u.phone AS login_phone, u.is_active AS login_active,
       CASE
         WHEN u.user_id IS NULL THEN 'no login user'
         WHEN u.is_active = 0 THEN 'login user is inactive'
         WHEN u.phone <> CONCAT('+91', RIGHT(REGEXP_REPLACE(s.phone, '[^0-9]', ''), 10)) THEN 'phone saved in another form'
         WHEN NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.user_id AND ur.role_id = @salesman_role) THEN 'salesman role missing'
         ELSE 'ok'
       END AS problem
FROM salesmen s
LEFT JOIN users u ON u.user_id = s.user_id
WHERE s.is_active = 1
ORDER BY problem, s.employee_code;

-- If the table above looks right:   COMMIT;
-- If anything looks wrong:          ROLLBACK;
-- (Leave the transaction open until you run one of the two.)

DROP TEMPORARY TABLE IF EXISTS tmp_salesman_user;
