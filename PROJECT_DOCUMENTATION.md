# Stallion Eyewear — Project Documentation

Stallion is a B2B eyewear sales & distribution platform. It gives an eyewear
manufacturer/wholesaler a single system to manage its product catalogue, its
field sales force, its retail parties (shops) and distributors, and the orders
that flow between them — with location‑verified field visits, sales targets,
expenses, offers and analytics.

This document describes the whole system: its architecture, data model, roles,
features, and how it is built and deployed.

---

## 1. Technology Stack

**Backend** (`Backendjs/`)
- **Node.js + Express 5** REST API
- **Sequelize 6** ORM over **PostgreSQL**
- **JWT** (`jsonwebtoken`) auth; **bcrypt** for hashing
- **Multer 2** (file uploads) + **Sharp** (image compression)
- **xlsx / csv-parse** for bulk import
- **Joi** for validation
- Schema is kept in sync with the models automatically on startup
  (`sequelize` alter‑sync via `lib/services/databaseManager.js`) — new columns
  are added without hand‑written migrations.

**Frontend** (`Frontend/`)
- **Next.js 15** (App Router) + **React 19**
- **Tailwind CSS v4** with a CSS‑variable design‑token system
  (`--color-primary`, `--color-surface`, `text-error`, `bg-success-soft`, …)
- **react-icons**, **react-toastify**, **react-international-phone**
- **jsPDF** for client‑side PDF export
- A shared UI kit under `src/components/ui/` (AsidePanel drawer, TableWithControls,
  DropdownSelector, StatusBadge, FileUpload, MatchMeter, DatePicker, …)

**Third‑party services**
- **MSG91** — OTP login (browser widget → access‑token verification)
- **OpenStreetMap Nominatim** — free address → coordinates geocoding (no key)

---

## 2. Architecture & Repository Layout

```
Stallion/
├── Backendjs/                 # Express + Sequelize API
│   └── lib/
│       ├── models/            # Sequelize models (one file per table)
│       ├── controllers/       # request handlers / business logic
│       ├── routes/            # Express routers (mounted in routeManager.js)
│       ├── middleware/        # auth (JWT), role checks
│       ├── constants/         # enums, database connection, multer config
│       ├── services/          # databaseManager (schema sync), helpers
│       └── utils/             # geocode.js, geo.js (geofence), audit, ...
├── Frontend/                  # Next.js app
│   └── src/
│       ├── app/               # App Router entry + catch-all route
│       ├── pages/             # page components (rendered by the router)
│       ├── components/ui/     # shared design-system components
│       ├── services/
│       │   ├── api/           # typed API client modules
│       │   ├── apiService.js  # re-exports every api/* module
│       │   └── authService.js # token/user storage, role helpers
│       ├── utils/rolePermissions.js  # per-role page access
│       └── styles/            # global tokens + component/page CSS
└── PROJECT_DOCUMENTATION.md   # this file
```

### API surface (mounted paths)

`/auth`, `/roles`, `/users`, `/parties`, `/distributors`, `/salesmen`,
`/cities`, `/states`, `/countries`, `/zones`, `/products`, and the catalogue
attribute routes (`/genders`, `/color_codes`, `/frame_colors`, `/frame_types`,
`/lens_materials`, `/lens_colors`, `/shapes`, `/frame_materials`, `/brands`,
`/collections`), plus `/events`, `/orders`, `/salesman_expenses`,
`/salesman_targets`, `/salesman_checkins`, `/offer`.

---

## 3. Roles & Permissions

Access is role‑based. The backend enforces scope on every request; the frontend
mirrors it in `utils/rolePermissions.js` to decide which pages a role can open.
A single user can hold **multiple roles** (see *Office Team*).

| Role | What they can do |
|------|------------------|
| **admin** | Full access to every module. |
| **product_manager** | Product catalogue + settings. |
| **order_manager** | Orders + settings. |
| **reports_manager** | Analytics & reports + settings. |
| **expense_manager** | Expenses + analytics + settings. |
| **party_manager** | Parties + settings. |
| **sales_manager** | Salesmen + expenses + settings. |
| **distributor_manager** | Distributors + settings. |
| **distributor** | Own dashboard, own orders, parties, settings. |
| **party** | Own dashboard, own orders, settings. |
| **salesman** | Dashboard, orders, expenses, analytics, parties, visit reporting, settings. |

End‑user roles (**party / distributor / salesman**) are *self‑scoped*: their list
endpoints (e.g. `/orders/my`, `/parties/my`) return only their own records.

---

## 4. Authentication

Login is **phone + OTP** via MSG91:

1. The browser runs the MSG91 OTP widget, which returns an **access‑token** after
   the user enters the OTP.
2. The frontend sends that token to the backend, which **verifies it with MSG91**
   and, on success, issues a **24‑hour JWT** carrying `userId`, `phone`, `email`,
   `full_name`, and `role`.
3. The frontend stores the token + a merged user object in `localStorage` and
   refreshes the profile/role from `/users/me` + `/users/role`.

A short allow‑list of internal numbers can bypass live OTP for testing. A
`party` account that is deactivated is blocked at login.

---

## 5. Core Domain & Features

### 5.1 Products & Catalogue
Full eyewear catalogue with rich attributes: **brand, collection, gender,
frame type, frame material, frame colour, lens material, lens colour, shape,
colour code, model number, MRP, WHP (wholesale price)** and stock quantities
(`warehouse_qty`, `total_qty`). Products support image upload (compressed with
Sharp) and bulk import via Excel/CSV. Each attribute has its own managed list
(add/edit/delete) under the *Manage* area.

### 5.2 Parties (retail shops)
A **Party** is a retail customer. Records capture the shop name, trade name,
contact person, phone, and a **required address (address, city, state, pincode)**
so the location can be geocoded. Parties belong to a state/zone and can be linked
to a distributor.

- **Geocoding:** on create/update (and via a bulk **"Update Locations"** action
  on the admin party page) the party address is resolved to latitude/longitude
  through Nominatim, using a **pincode‑first fallback chain** for accuracy
  (full address → pincode + city/state → pincode → city/state → state).
- A party account can be **active/inactive**; inactive parties are blocked.

### 5.3 Distributors
Distributors are wholesale partners mapped to **states** and **zones**
(`DistributorStates`, `DistributorZones`). They have their own dashboard and can
view the orders routed to them.

### 5.4 Salesmen
Field sales reps, each mapped to **states** and **zones** (which determine the
parties they serve).

- **KYC / onboarding:** salesman records require uploaded documents — **PAN card,
  Aadhaar card, cancelled cheque and photo** (images or PDF) — and a full
  address. Uploads use a drag‑and‑drop `FileUpload` component on both the add and
  edit forms.
- **Active/Inactive toggle:** when a salesman leaves, an admin flips their status
  to inactive, which mirrors onto their linked user account and blocks access.
- Salesmen see a tailored dashboard with quick actions (Add Visit, My Orders,
  View Report) and their own targets.

### 5.5 Office Team (multi‑role users)
Internal staff are managed here. A user can be assigned **multiple roles** at once
using the paged multi‑select widget; the backend stores the set in `UserRole` and
returns the combined role list.

### 5.6 Orders
Orders capture a set of line items (`order_items` stored as JSON with per‑item
quantity and price), an `order_total`, optional offer/discount breakdown
(`subtotal`, `discount_total`, `applied_offer`), notes, and courier tracking.

**Order types**
- `party_order` — placed for a retail party
- `distributor_order` — placed for a distributor
- `event_order` — placed at an event
- `visit_order` — placed by a salesman **on‑site at a party** (location‑verified)
- `whatsapp_order` — captured from a WhatsApp enquiry

**Order lifecycle** — `pending → processed → dispatched / partially_dispatched →
completed`, with `cancelled` reachable from the open states. Stock is adjusted as
orders move through the flow, and the cart caps each line to the available
backend stock (out‑of‑stock items are shown as such on the product page).

**Offers** can be applied to an order; the applied offer is snapshotted onto the
order so later edits to the offer don't rewrite history.

### 5.7 Events
Events (with `upcoming / ongoing / past` status) group event‑based orders — e.g.
an exhibition or roadshow where orders are booked against the event.

### 5.8 Salesman Expenses
Salesmen log field expenses, which managers review through the expenses module
and analytics.

### 5.9 Salesman Targets
Admins/managers assign sales targets to a salesman (target amount, start/end
dates, optional order type, description, remarks). The salesman sees their own
targets, and the **Analytics → Target Achievement** report shows target vs
achieved with a progress bar.

### 5.10 Visit Reporting & Geofencing  ⭐
The field‑verification core of the platform.

- A salesman records a **check‑in** (a *Visit*) or places a **visit order** at a
  party. The device GPS is captured with each.
- **Geofence:** the backend geocodes the party's address (on demand if missing)
  and computes the **Haversine distance** between the salesman's GPS and the
  party. If it exceeds the geofence radius (**`GEOFENCE_RADIUS_M`, default 250 m**),
  the visit order is **rejected (HTTP 403)**. This guarantees a recorded visit
  actually happened at the party.
- **Visit Report** (salesman tab + Analytics "View Report") lists every visit and
  visit order with: **Type** (Visit/Order), **Date**, **Party**, **Qty**,
  **Amount**, **Reason**, and **Location**. Visit orders (which live in the
  orders table) are merged in automatically, so both stand‑alone check‑ins and
  on‑site orders appear.
- **Location match:** the Location column uses the reusable **`MatchMeter`**
  component — a colour‑graded percentage bar showing how close the recorded GPS
  is to the party's address (100% on‑site, falling to 0% at 2× the geofence
  radius; green ≥ 70%, amber 40–69%, red < 40%), plus the raw distance and a
  "map" link. It's the at‑a‑glance proof of presence.

### 5.11 Analytics & Reports
`Target Achievement` (target vs achieved, with summary cards) and `Visit Report`
(as above). Salesmen see only their own data; admins/managers see everyone's.

### 5.12 Audit Log
Create/update/delete operations on key tables are written to an **AuditLog** with
old/new value snapshots for traceability.

---

## 6. Data Model (primary tables)

- **User / Role / UserRole** — accounts and their (multiple) roles.
- **Party** — retail shops (address + geocoded lat/lng, active flag).
- **Distributor / DistributorStates / DistributorZones** — wholesale partners and
  their territory.
- **Salesman / SalesmanStates / SalesmanZones** — reps and their territory + KYC.
- **Country / State / Cities / Zone** — geography reference data.
- **Product** + catalogue attribute tables (**Brand, Collection, Gender,
  FrameType, FrameMaterial, FrameColor, LensMaterial, LensColor, Shape,
  ColorCode**).
- **Order / OrderOperation** — orders and their stock operations.
- **Offer** — discounts applied to orders.
- **Event** — event grouping for event orders.
- **SalesmanCheckIns** — visits / on‑site orders (with GPS).
- **SalesmanTargets** — assigned sales targets.
- **SalesmanExpense** — field expenses.
- **AuditLog** — change history.

---

## 7. Frontend Pages (by area)

- **Public:** `Home`, `About`, `Products`, `ProductDetail`, `PrivacyPolicy`,
  `Login`, `Register`.
- **Shopping:** `Cart` (stock‑aware quantities, out‑of‑stock display,
  location capture for visit orders).
- **Dashboard (role‑aware):** `Dashboard` (admin & salesman variants),
  `DashboardProducts`, `DashboardOrders`, `DashboardClients` (parties),
  `DashboardSuppliers` (salesmen + Visit Report + Targets),
  `DashboardDistributor`, `DashboardOfficeTeam`, `DashboardEvents`,
  `DashboardExpenses`, `DashboardOffers`, `DashboardManage` (catalogue
  attributes), `AnalyticsReports`, `DashboardSupport`, `DashboardSettings`.
- **Portals:** `PartyDashboard`, `PartyOrders`, `DistributorDashboard`,
  `DistributorOrders`.

Routing is handled by a catch‑all App‑Router page that renders the right page
component and enforces `hasPageAccess(role, page)`.

---

## 8. Deployment & CI

The project uses a **three‑branch** model with **`main` as the single source of
truth**:

- **`main`** — the monorepo (this repository). All development lands here.
- **`frontend`** — the Next.js app at the repo root, deployed to **Vercel**.
- **`backend`** — the Express API (`Backendjs/`), deployed to **cPanel /
  LiteSpeed + Phusion Passenger** over FTP.

A GitHub Actions workflow on `main` (`sync-from-main.yml`) mirrors:
`main/Frontend → frontend` and `main/Backendjs → backend`, then dispatches the
backend FTP deploy. Vercel is configured to build **only** on `main`'s mirror to
`frontend` (`vercel.json` deployment gating). Because the backend syncs models on
startup, schema changes ship automatically on the next backend restart.

**Never commit directly to `frontend` or `backend`** — push to `main` and let the
sync pipeline propagate.

---

## 9. Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `GEOFENCE_RADIUS_M` | Visit geofence radius in metres (default **250**). |
| `GEOFENCE_REQUIRE_COORDS` | If `true`, block a visit when the party has no coordinates (default fail‑open). |
| `GEOCODER_URL` / `GEOCODER_KEY` / `GEOCODER_UA` | Geocoding provider (defaults to OpenStreetMap Nominatim). |
| `MSG91_*` | MSG91 OTP widget / API credentials. |
| Database + `JWT` secret | PostgreSQL connection and token signing. |

---

## 10. Notable Engineering Details

- **Geocoding accuracy:** an Indian pincode pins a locality far better than
  "city, state" (which collapses to a state centroid), so the geocoder tries the
  pincode early in its fallback chain.
- **Image uploads:** capped file counts + Sharp resize/compress + async writes,
  to avoid the memory/CPU spikes that previously produced infra `503`s.
- **AsidePanel drawer:** rendered through a portal and laid out with flexbox
  (no `backdrop-filter` on the scrim) so the fixed panel stays opaque and on top
  on mobile.
- **MatchMeter:** a small, reusable proximity‑percentage component used wherever a
  recorded location needs to be verified against an expected one.

---

*Generated as a living overview — update it as modules evolve.*
