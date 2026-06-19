# Stallion API — Role-Based Route Reference

Frontend reference for all `/api` endpoints, organized by role. Source of truth: `lib/routes/`.

---

## Overview

| Item        | Value                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- |
| Base path   | `/api`                                                                                    |
| Auth header | `Authorization: Bearer <jwt>`                                                             |
| Login       | `POST /api/auth/login` → returns `{ token, role }` where `role` is the user's `role_name` |
| Roles list  | `GET /api/roles` (public)                                                                 |

### Field roles (mobile apps)

| Role          | Scope key        | Description                            |
| ------------- | ---------------- | -------------------------------------- |
| `admin`       | —                | Full access to all endpoints           |
| `party`       | `party_id`       | Retailer / shop linked to user account |
| `distributor` | `distributor_id` | Distributor linked to user account     |
| `salesman`    | `salesman_id`    | Field salesman linked to user account  |

### Access legend

| Symbol        | Meaning                                               |
| ------------- | ----------------------------------------------------- |
| **Full**      | Unrestricted for that role                            |
| **Scoped**    | Allowed but data is filtered to the user's own entity |
| **Denied**    | Returns 403 (route middleware or controller check)    |
| **Auth only** | Any logged-in role can call; no role guard on route   |
| **Public**    | No token required                                     |

### HTTP status codes

- **401** — Missing, invalid, or expired token
- **403** — Authenticated but role or scope does not permit the action

---

## Public endpoints (no token)

| Method | Path                      | Purpose                           |
| ------ | ------------------------- | --------------------------------- |
| POST   | `/api/auth/login`         | Login with credentials            |
| POST   | `/api/auth/send-otp`      | Send OTP                          |
| POST   | `/api/auth/verify-otp`    | Verify OTP                        |
| POST   | `/api/auth/verify-token`  | Verify access token               |
| POST   | `/api/auth/refresh-token` | Refresh token                     |
| POST   | `/api/auth/logout`        | Logout                            |
| POST   | `/api/auth/check-user`    | Check if user exists              |
| GET    | `/api/roles`              | List all roles                    |
| POST   | `/api/products/featured`  | Featured products (catalog)       |
| GET    | `/api/collections`        | List collections (catalog)        |
| GET    | `/api/docs`               | JSON index of resource base paths |

---

## Shared endpoints (all authenticated roles)

These require a valid token. Any role (`admin`, `party`, `distributor`, `salesman`, or office staff) can call them unless noted.

### Auth & profile

| Method | Path                        | Access    | Notes                                                     |
| ------ | --------------------------- | --------- | --------------------------------------------------------- |
| GET    | `/api/auth/check-token`     | Auth only | Validate current token                                    |
| GET    | `/api/users/me`             | Auth only | Current user profile                                      |
| GET    | `/api/users/role`           | Auth only | Current user's role                                       |
| PUT    | `/api/users`                | Auth only | Update own profile; changing `role_id` requires **admin** |
| POST   | `/api/users/upload-profile` | Auth only | Upload profile image                                      |

### Product catalog (read)

| Method | Path                           | Access    | Notes                |
| ------ | ------------------------------ | --------- | -------------------- |
| POST   | `/api/products`                | Auth only | Search/list products |
| POST   | `/api/products/product-models` | Auth only | List product models  |

### Master data (read + CRUD)

All routes below require auth. Most have **no route-level role guard** — any logged-in user can call them today. Treat as **Auth only** unless building admin-only UI.

| Resource            | Base path              |
| ------------------- | ---------------------- |
| Genders             | `/api/genders`         |
| Color codes         | `/api/color_codes`     |
| Frame colors        | `/api/frame_colors`    |
| Frame types         | `/api/frame_types`     |
| Lens materials      | `/api/lens_materials`  |
| Lens colors         | `/api/lens_colors`     |
| Shapes              | `/api/shapes`          |
| Frame materials     | `/api/frame_materials` |
| Brands              | `/api/brands`          |
| Cities              | `/api/cities`          |
| States              | `/api/states`          |
| Countries           | `/api/countries`       |
| Zones               | `/api/zones`           |
| Events              | `/api/events`          |
| Trays               | `/api/trays`           |
| Tray products       | `/api/tray_products`   |
| Salesmen (CRUD)     | `/api/salesmen`        |
| Distributors (CRUD) | `/api/distributors`    |

Standard CRUD patterns: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` (some use `POST /get` for filtered lists).

---

## Admin (`admin`)

**Full** access to every endpoint. Admin-only routes at the middleware level:

### User management

| Method | Path                 | Access                                     |
| ------ | -------------------- | ------------------------------------------ |
| POST   | `/api/auth/register` | **Full** — create users                    |
| GET    | `/api/users`         | **Full** — list office users               |
| POST   | `/api/users`         | **Full** — create user                     |
| DELETE | `/api/users/:id`     | **Full** — delete user                     |
| PUT    | `/api/users`         | **Full** — can change any user's `role_id` |

### Party management (inherits `isPartyManager`)

| Method | Path                       | Access                      |
| ------ | -------------------------- | --------------------------- |
| POST   | `/api/parties/get`         | **Full** — list all parties |
| POST   | `/api/parties`             | **Full** — create party     |
| DELETE | `/api/parties/:id`         | **Full** — delete party     |
| POST   | `/api/parties/bulk-upload` | **Full** — bulk import      |

### Product management (inherits `isProductManager`)

| Method | Path                              | Access                                    |
| ------ | --------------------------------- | ----------------------------------------- |
| GET    | `/api/products/images/all`        | **Full**                                  |
| POST   | `/api/products/create`            | **Full**                                  |
| PUT    | `/api/products/:id`               | **Full** — all fields including inventory |
| DELETE | `/api/products/:id`               | **Full**                                  |
| DELETE | `/api/products/images/:file_name` | **Full**                                  |
| POST   | `/api/products/image-upload`      | **Full**                                  |
| POST   | `/api/products/bulk-upload`       | **Full**                                  |

### Order management (inherits `canManageOrders`)

| Method | Path              | Access                   |
| ------ | ----------------- | ------------------------ |
| GET    | `/api/orders`     | **Full** — all orders    |
| PUT    | `/api/orders/:id` | **Full** — update status |
| DELETE | `/api/orders/:id` | **Full** — delete order  |

### Expense oversight

| Method | Path                                        | Access                               |
| ------ | ------------------------------------------- | ------------------------------------ |
| GET    | `/api/salesman_expenses/admin/all`          | **Full**                             |
| GET    | `/api/salesman_expenses/admin/:salesman_id` | **Full**                             |
| PUT    | `/api/salesman_expenses/:id`                | **Full** — can update expense status |

### All other resources

Admin has **Full** access to parties, distributors, salesmen, zones, trays, check-ins, targets, collections (write), and all master data CRUD.

---

## Party (`party`)

Scoped to own `party_id` resolved from the logged-in user.

### Parties

| Method | Path                                 | Access     | Notes                                      |
| ------ | ------------------------------------ | ---------- | ------------------------------------------ |
| GET    | `/api/parties`                       | **Scoped** | Own party record (by `user_id`)            |
| GET    | `/api/parties/my`                    | **Scoped** | Own party                                  |
| GET    | `/api/parties/:id`                   | **Scoped** | Only if `:id` matches own `party_id`       |
| PUT    | `/api/parties/:id`                   | **Scoped** | Only own party                             |
| POST   | `/api/parties/byZoneId`              | **Scoped** | Parties in assigned zone                   |
| POST   | `/api/parties/byStateId`             | Auth only  | Filter by state                            |
| POST   | `/api/parties/get`                   | **Denied** | Requires `party_manager` / `sales_manager` |
| POST   | `/api/parties`                       | **Denied** | Create party                               |
| DELETE | `/api/parties/:id`                   | **Denied** | Delete party                               |
| POST   | `/api/parties/bulk-upload`           | **Denied** | Bulk import                                |
| GET    | `/api/parties/salesman/:salesman_id` | **Denied** | Salesman-only scope                        |

### Zones

| Method | Path             | Access     | Notes                |
| ------ | ---------------- | ---------- | -------------------- |
| POST   | `/api/zones/my`  | **Scoped** | Own assigned zone(s) |
| POST   | `/api/zones/get` | Auth only  | Zone lookup          |
| GET    | `/api/zones/:id` | Auth only  | Zone by ID           |

### Orders

| Method | Path              | Access     | Notes                                 |
| ------ | ----------------- | ---------- | ------------------------------------- |
| GET    | `/api/orders/my`  | **Scoped** | Orders where `party_id` = own         |
| POST   | `/api/orders`     | **Scoped** | Cannot set another party's `party_id` |
| GET    | `/api/orders`     | **Denied** | Requires `order_manager`              |
| PUT    | `/api/orders/:id` | **Denied** | Status update                         |
| DELETE | `/api/orders/:id` | **Denied** | Delete order                          |

### Products & catalog

| Method | Path                     | Access                                  |
| ------ | ------------------------ | --------------------------------------- |
| POST   | `/api/products`          | **Scoped** / Auth only — browse catalog |
| POST   | `/api/products/featured` | **Public**                              |
| GET    | `/api/collections`       | **Public**                              |
| POST   | `/api/products/create`   | **Denied**                              |
| DELETE | `/api/products/:id`      | **Denied**                              |

### Not available

- `GET /api/salesman_expenses/*` — salesman only
- `GET /api/distributors` — returns own distributor context only if applicable; primary party flows use `/parties`

---

## Distributor (`distributor`)

Scoped to own `distributor_id`.

### Distributors

| Method | Path                                  | Access     | Notes                                  |
| ------ | ------------------------------------- | ---------- | -------------------------------------- |
| GET    | `/api/distributors`                   | **Scoped** | Own distributor profile + zones/states |
| GET    | `/api/distributors/parties`           | **Scoped** | Parties linked to own distributor      |
| GET    | `/api/distributors/:id`               | **Scoped** | Own record                             |
| GET    | `/api/distributors/by-state/:stateId` | Auth only  | Filter by state                        |
| POST   | `/api/distributors`                   | Auth only  | No role guard on route                 |
| POST   | `/api/distributors/get`               | Auth only  | List distributors                      |
| PUT    | `/api/distributors/:id`               | Auth only  | Update                                 |
| DELETE | `/api/distributors/:id`               | Auth only  | Delete                                 |

### Parties

| Method | Path                    | Access     | Notes                                   |
| ------ | ----------------------- | ---------- | --------------------------------------- |
| GET    | `/api/parties/my`       | **Scoped** | Parties for own distributor             |
| GET    | `/api/parties/:id`      | **Scoped** | If party's `distributor_id` matches own |
| POST   | `/api/parties/byZoneId` | **Scoped** | Parties in distributor's zones          |
| POST   | `/api/parties/get`      | **Denied** | Party manager only                      |
| POST   | `/api/parties`          | **Denied** | Create party                            |
| DELETE | `/api/parties/:id`      | **Denied** | Delete party                            |

### Zones

| Method | Path            | Access                 |
| ------ | --------------- | ---------------------- |
| POST   | `/api/zones/my` | **Scoped** — own zones |

### Orders

| Method | Path              | Access     | Notes                                  |
| ------ | ----------------- | ---------- | -------------------------------------- |
| GET    | `/api/orders/my`  | **Scoped** | Orders where `distributor_id` = own    |
| POST   | `/api/orders`     | **Scoped** | Cannot assign another distributor's ID |
| GET    | `/api/orders`     | **Denied** | Requires `order_manager`               |
| PUT    | `/api/orders/:id` | **Denied** | Status update                          |
| DELETE | `/api/orders/:id` | **Denied** | Delete order                           |

### Not available

- Party manager CRUD (`POST /api/parties`, bulk-upload, etc.)
- `GET /api/salesman_expenses/*` — salesman only
- Order admin endpoints

---

## Salesman (`salesman`)

Scoped to own `salesman_id`.

### Salesmen

| Method | Path                              | Access     | Notes                              |
| ------ | --------------------------------- | ---------- | ---------------------------------- |
| GET    | `/api/salesmen`                   | **Scoped** | Own salesman record (by `user_id`) |
| GET    | `/api/salesmen/:id`               | Auth only  | By ID                              |
| GET    | `/api/salesmen/by-state/:stateId` | Auth only  | Filter by state                    |

### Parties

| Method | Path                                 | Access     | Notes                                |
| ------ | ------------------------------------ | ---------- | ------------------------------------ |
| GET    | `/api/parties/my`                    | **Scoped** | Parties in assigned state(s)         |
| GET    | `/api/parties/salesman/:salesman_id` | **Scoped** | Only if `:salesman_id` is own        |
| GET    | `/api/parties/:id`                   | **Scoped** | If party's `salesman_id` matches own |
| PUT    | `/api/parties/:id`                   | **Scoped** | If party assigned to this salesman   |
| POST   | `/api/parties/byZoneId`              | **Scoped** | Via salesman zone preference         |
| POST   | `/api/parties/get`                   | **Denied** | Party manager only                   |
| POST   | `/api/parties`                       | **Denied** | Create party                         |
| DELETE | `/api/parties/:id`                   | **Denied** | Delete party                         |

### Zones

| Method | Path            | Access                      |
| ------ | --------------- | --------------------------- |
| POST   | `/api/zones/my` | **Scoped** — assigned zones |

### Orders

| Method | Path              | Access     | Notes                                                            |
| ------ | ----------------- | ---------- | ---------------------------------------------------------------- |
| GET    | `/api/orders/my`  | **Scoped** | Own salesman orders                                              |
| POST   | `/api/orders`     | **Scoped** | Auto-resolves salesman from user; cannot use another salesman ID |
| GET    | `/api/orders`     | **Denied** | Requires `order_manager`                                         |
| PUT    | `/api/orders/:id` | **Denied** | Status update                                                    |
| DELETE | `/api/orders/:id` | **Denied** | Delete order                                                     |

### Expenses

| Method | Path                                        | Access     | Notes                             |
| ------ | ------------------------------------------- | ---------- | --------------------------------- |
| GET    | `/api/salesman_expenses`                    | **Scoped** | Own expenses only                 |
| POST   | `/api/salesman_expenses`                    | **Scoped** | Create own expense                |
| PUT    | `/api/salesman_expenses/:id`                | **Scoped** | Own expense; cannot change status |
| DELETE | `/api/salesman_expenses/:id`                | **Scoped** | Own expense                       |
| POST   | `/api/salesman_expenses/upload-images`      | **Scoped** | Bill images for own expenses      |
| GET    | `/api/salesman_expenses/admin/all`          | **Denied** | Office only                       |
| GET    | `/api/salesman_expenses/admin/:salesman_id` | **Denied** | Office only                       |

### Check-ins

| Method | Path                                  | Access    | Notes           |
| ------ | ------------------------------------- | --------- | --------------- |
| POST   | `/api/salesman_checkins`              | Auth only | Create check-in |
| GET    | `/api/salesman_checkins`              | Auth only | List check-ins  |
| GET    | `/api/salesman_checkins/:salesman_id` | Auth only | By salesman     |
| PUT    | `/api/salesman_checkins/:id`          | Auth only | Update          |
| DELETE | `/api/salesman_checkins/:id`          | Auth only | Delete          |

> No ownership check in controller today — any authenticated user can access any check-in record.

### Trays

| Method | Path                         | Access                         |
| ------ | ---------------------------- | ------------------------------ |
| POST   | `/api/salesman_trays`        | Auth only — get assigned trays |
| POST   | `/api/salesman_trays/assign` | Auth only                      |
| DELETE | `/api/salesman_trays/:id`    | Auth only                      |

### Targets

| Method | Path                                 | Access    |
| ------ | ------------------------------------ | --------- |
| GET    | `/api/salesman_targets`              | Auth only |
| GET    | `/api/salesman_targets/:salesman_id` | Auth only |
| POST   | `/api/salesman_targets`              | Auth only |
| PUT    | `/api/salesman_targets/:id`          | Auth only |
| DELETE | `/api/salesman_targets/:id`          | Auth only |

---

## Office staff roles (admin web app)

These are back-office roles (not field apps). `admin` inherits all of them.

| Role                                     | Key endpoints                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `order_manager`                          | `GET /api/orders`, `PUT /api/orders/:id`, `DELETE /api/orders/:id`; `GET /api/orders/my` delegates to full list |
| `party_manager`, `sales_manager`         | `POST /api/parties/get`, `POST /api/parties`, `DELETE /api/parties/:id`, `POST /api/parties/bulk-upload`        |
| `product_manager`                        | `POST /api/products/create`, `DELETE /api/products/:id`, image upload/bulk, `GET /api/products/images/all`      |
| `tray_manager`                           | `PUT /api/products/:id` — inventory quantity fields                                                             |
| `expense_manager`                        | `GET /api/salesman_expenses/admin/*`; approve expenses via `PUT /api/salesman_expenses/:id` status              |
| `distributor_manager`, `reports_manager` | No dedicated route middleware — same as any authenticated office user for most CRUD                             |

### Office role list

`admin`, `sales_manager`, `expense_manager`, `tray_manager`, `order_manager`, `reports_manager`, `product_manager`, `party_manager`, `distributor_manager`

---

## Full route inventory

All paths are prefixed with `/api`. **Middleware** = route-level guard; **Scoping** = additional controller checks.

### Authentication — `/api/auth`

| Method | Path                  | Middleware   | Scoping |
| ------ | --------------------- | ------------ | ------- |
| POST   | `/auth/login`         | Public       | —       |
| POST   | `/auth/send-otp`      | Public       | —       |
| POST   | `/auth/verify-otp`    | Public       | —       |
| POST   | `/auth/verify-token`  | Public       | —       |
| POST   | `/auth/refresh-token` | Public       | —       |
| POST   | `/auth/logout`        | Public       | —       |
| POST   | `/auth/check-user`    | Public       | —       |
| GET    | `/auth/check-token`   | Auth         | —       |
| POST   | `/auth/register`      | Auth + admin | —       |

### Roles — `/api/roles`

| Method | Path     | Middleware | Scoping |
| ------ | -------- | ---------- | ------- |
| GET    | `/roles` | Public     | —       |

### Users — `/api/users`

| Method | Path                    | Middleware   | Scoping                       |
| ------ | ----------------------- | ------------ | ----------------------------- |
| GET    | `/users`                | Auth + admin | Office users only             |
| GET    | `/users/me`             | Auth         | Own profile                   |
| POST   | `/users`                | Auth + admin | —                             |
| PUT    | `/users`                | Auth         | `role_id` change → admin only |
| DELETE | `/users/:id`            | Auth + admin | —                             |
| GET    | `/users/role`           | Auth         | Own role                      |
| POST   | `/users/upload-profile` | Auth         | Own profile                   |

### Parties — `/api/parties`

| Method | Path                             | Middleware             | Scoping                   |
| ------ | -------------------------------- | ---------------------- | ------------------------- |
| GET    | `/parties`                       | Auth                   | Field: own party          |
| GET    | `/parties/my`                    | Auth                   | Scoped by role            |
| GET    | `/parties/salesman/:salesman_id` | Auth                   | Salesman: own ID only     |
| GET    | `/parties/:id`                   | Auth                   | Field: own/linked party   |
| POST   | `/parties/get`                   | Auth + party_manager\* | —                         |
| POST   | `/parties`                       | Auth + party_manager\* | —                         |
| PUT    | `/parties/:id`                   | Auth                   | Field: own/assigned party |
| DELETE | `/parties/:id`                   | Auth + party_manager\* | —                         |
| POST   | `/parties/byZoneId`              | Auth                   | Zone-scoped               |
| POST   | `/parties/byStateId`             | Auth                   | —                         |
| POST   | `/parties/bulk-upload`           | Auth + party_manager\* | —                         |

\* `party_manager` = `admin`, `party_manager`, `sales_manager`

### Distributors — `/api/distributors`

| Method | Path                              | Middleware | Scoping                     |
| ------ | --------------------------------- | ---------- | --------------------------- |
| GET    | `/distributors`                   | Auth       | Distributor: own profile    |
| GET    | `/distributors/parties`           | Auth       | Distributor: linked parties |
| GET    | `/distributors/by-state/:stateId` | Auth       | —                           |
| GET    | `/distributors/:id`               | Auth       | —                           |
| POST   | `/distributors`                   | Auth       | —                           |
| POST   | `/distributors/get`               | Auth       | —                           |
| PUT    | `/distributors/:id`               | Auth       | —                           |
| DELETE | `/distributors/:id`               | Auth       | —                           |

### Salesmen — `/api/salesmen`

| Method | Path                          | Middleware | Scoping              |
| ------ | ----------------------------- | ---------- | -------------------- |
| GET    | `/salesmen`                   | Auth       | Salesman: own record |
| GET    | `/salesmen/by-state/:stateId` | Auth       | —                    |
| GET    | `/salesmen/:id`               | Auth       | —                    |
| POST   | `/salesmen/get`               | Auth       | —                    |
| POST   | `/salesmen`                   | Auth       | —                    |
| PUT    | `/salesmen/:id`               | Auth       | —                    |
| DELETE | `/salesmen/:id`               | Auth       | —                    |

### Geography — `/api/cities`, `/api/states`, `/api/countries`, `/api/zones`

| Resource  | Methods                                                                  | Middleware |
| --------- | ------------------------------------------------------------------------ | ---------- |
| Cities    | GET `/:id`, POST `/get`, POST `/`, PUT `/:id`, DELETE `/:id`             | Auth       |
| States    | GET `/:id`, POST `/get`, POST `/`, PUT `/:id`, DELETE `/:id`             | Auth       |
| Countries | GET `/`, GET `/:id`, POST `/`, PUT `/:id`, DELETE `/:id`                 | Auth       |
| Zones     | GET `/:id`, POST `/get`, POST `/my`, POST `/`, PUT `/:id`, DELETE `/:id` | Auth       |

`POST /zones/my` — field roles only (`party`, `salesman`, `distributor`); returns 400 for others.

### Products — `/api/products`

| Method | Path                          | Middleware                                | Scoping                         |
| ------ | ----------------------------- | ----------------------------------------- | ------------------------------- |
| POST   | `/products`                   | Auth                                      | Catalog search                  |
| POST   | `/products/featured`          | Public                                    | —                               |
| GET    | `/products/images/all`        | Auth + product_manager\*                  | —                               |
| POST   | `/products/create`            | Auth + product_manager\*                  | —                               |
| PUT    | `/products/:id`               | Auth + admin/product_manager/tray_manager | Inventory fields → tray_manager |
| DELETE | `/products/:id`               | Auth + product_manager\*                  | —                               |
| DELETE | `/products/images/:file_name` | Auth + product_manager\*                  | —                               |
| POST   | `/products/image-upload`      | Auth + product_manager\*                  | —                               |
| POST   | `/products/bulk-upload`       | Auth + product_manager\*                  | —                               |
| POST   | `/products/product-models`    | Auth                                      | —                               |

\* `product_manager` = `admin`, `product_manager`

### Product attributes

| Resource        | Base path              | CRUD                             | Middleware |
| --------------- | ---------------------- | -------------------------------- | ---------- |
| Genders         | `/api/genders`         | Full                             | Auth       |
| Color codes     | `/api/color_codes`     | Full                             | Auth       |
| Frame colors    | `/api/frame_colors`    | Full                             | Auth       |
| Frame types     | `/api/frame_types`     | Full                             | Auth       |
| Lens materials  | `/api/lens_materials`  | Full                             | Auth       |
| Lens colors     | `/api/lens_colors`     | Full                             | Auth       |
| Shapes          | `/api/shapes`          | Full                             | Auth       |
| Frame materials | `/api/frame_materials` | Full                             | Auth       |
| Brands          | `/api/brands`          | Full                             | Auth       |
| Collections     | `/api/collections`     | GET public; POST/PUT/DELETE Auth | Auth       |

### Trays — `/api/trays`, `/api/salesman_trays`, `/api/tray_products`

| Resource       | Methods                                      | Middleware |
| -------------- | -------------------------------------------- | ---------- |
| Trays          | GET `/`, POST `/`, PUT `/:id`, DELETE `/:id` | Auth       |
| Salesman trays | POST `/`, POST `/assign`, DELETE `/:id`      | Auth       |
| Tray products  | GET `/:id`, POST `/`, PUT `/`, DELETE `/`    | Auth       |

### Events — `/api/events`

| Method | Path          | Middleware |
| ------ | ------------- | ---------- |
| GET    | `/events`     | Auth       |
| POST   | `/events`     | Auth       |
| PUT    | `/events/:id` | Auth       |
| DELETE | `/events/:id` | Auth       |

### Orders — `/api/orders`

| Method | Path          | Middleware | Scoping                           |
| ------ | ------------- | ---------- | --------------------------------- |
| GET    | `/orders/my`  | Auth       | Field: scoped; order_manager: all |
| GET    | `/orders`     | Auth       | order_manager only                |
| POST   | `/orders`     | Auth       | Field: own entity IDs             |
| PUT    | `/orders/:id` | Auth       | order_manager only                |
| DELETE | `/orders/:id` | Auth       | order_manager only                |

### Salesman expenses — `/api/salesman_expenses`

| Method | Path                                    | Middleware | Scoping                          |
| ------ | --------------------------------------- | ---------- | -------------------------------- |
| GET    | `/salesman_expenses`                    | Auth       | Salesman: own                    |
| GET    | `/salesman_expenses/admin/all`          | Auth       | Office only                      |
| GET    | `/salesman_expenses/admin/:salesman_id` | Auth       | Office only                      |
| POST   | `/salesman_expenses`                    | Auth       | Salesman: own                    |
| PUT    | `/salesman_expenses/:id`                | Auth       | Owner or office; status → office |
| DELETE | `/salesman_expenses/:id`                | Auth       | Owner or office                  |
| POST   | `/salesman_expenses/upload-images`      | Auth       | Salesman: own                    |

### Salesman targets — `/api/salesman_targets`

| Method | Path                             | Middleware |
| ------ | -------------------------------- | ---------- |
| POST   | `/salesman_targets`              | Auth       |
| GET    | `/salesman_targets`              | Auth       |
| GET    | `/salesman_targets/:salesman_id` | Auth       |
| PUT    | `/salesman_targets/:id`          | Auth       |
| DELETE | `/salesman_targets/:id`          | Auth       |

### Salesman check-ins — `/api/salesman_checkins`

| Method | Path                              | Middleware |
| ------ | --------------------------------- | ---------- |
| POST   | `/salesman_checkins`              | Auth       |
| GET    | `/salesman_checkins`              | Auth       |
| GET    | `/salesman_checkins/:salesman_id` | Auth       |
| PUT    | `/salesman_checkins/:id`          | Auth       |
| DELETE | `/salesman_checkins/:id`          | Auth       |

---

## Frontend integration tips

1. **After login** — Store `token` and `role` from `POST /api/auth/login`. Send `Authorization: Bearer <token>` on every protected request.

2. **Profile refresh** — Use `GET /api/users/me` or `GET /api/users/role` to refresh user data and role.

3. **Field apps** — Prefer scoped list endpoints:
    - Orders: `GET /api/orders/my` (not `GET /api/orders`)
    - Parties: `GET /api/parties/my` (not `POST /api/parties/get`)
    - Zones: `POST /api/zones/my` (field roles only)

4. **Catalog without login** — `POST /api/products/featured` and `GET /api/collections` work without a token.

5. **Admin / back-office** — Use `GET /api/orders` for full order list; `POST /api/parties/get` for party search; product create/delete routes require `product_manager` role.

6. **Security note** — Many master-data and inventory routes are auth-gated but not role-gated at the route level. Documented here as current backend behavior; do not assume route-level security for admin-only CRUD when designing UI permissions.

7. **Health check** — `GET /health` (outside `/api`) returns `{ status: 'OK' }`.

---

## Quick reference by app type

| App                | Primary role           | Key endpoints                                                                                           |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Party mobile       | `party`                | `/parties/my`, `/orders/my`, `/products`, `/zones/my`                                                   |
| Distributor mobile | `distributor`          | `/distributors`, `/distributors/parties`, `/parties/my`, `/orders/my`                                   |
| Salesman mobile    | `salesman`             | `/salesmen`, `/parties/my`, `/orders/my`, `/salesman_expenses`, `/salesman_checkins`, `/salesman_trays` |
| Admin web          | `admin` + office roles | `/users`, `/orders`, `/parties/get`, `/products/create`, `/salesman_expenses/admin/*`                   |
