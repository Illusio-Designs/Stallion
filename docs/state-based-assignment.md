# State-Based Party Assignment & Multi-State Coverage

Status: **Planned / In progress**
Owner: Stallion Eyewear
Branches affected: `backend` (Backendjs), `frontend` + `main` (Frontend)

---

## 1. Goal

Move party → distributor/salesman assignment from **zones** to **states**, and let
each salesman and distributor cover **multiple states**.

- `city` and `zone` on a party become **optional**.
- `state` on a party becomes **required** (assignment is derived from it).
- A salesman or distributor has a list of **working states**.
- When a party is created in a state, its **distributor** and **salesman** are
  **auto-suggested** from whoever covers that state (admin can override).

## 2. Decisions (confirmed)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Multiple distributors/salesmen cover one state | **Auto-suggest, manual override allowed** |
| 2 | Zones vs states | **Keep zones (optional), add states on top** — no zone logic removed/dropped |
| 3 | Is `state` required on a party | **Yes, required** |
| 4 | Backfill existing zone coverage → states | **No** — admins re-enter working states |

## 3. Data model

Existing `Party` columns (unchanged, but nullability adjusted):

```
party_id, user_id, country_id, state_id, city_id, zone_id,
salesman_id, distributor_id, ...
```

- `state_id`  → **required**
- `city_id`   → **optional** (`allowNull: true`)
- `zone_id`   → **optional** (`allowNull: true`)

### New join tables (auto-created by `sequelize.sync({ alter: true })`)

Mirror the existing `SalesmanZones` / `DistributorZones` pattern.

```
SalesmanStates    { salesman_id (FK salesmen), state_id (FK states) }
DistributorStates { distributor_id (FK distributors), state_id (FK states) }
```

Associations:
- `Salesman` belongsToMany `State` through `SalesmanStates`
- `Distributor` belongsToMany `State` through `DistributorStates`
- (`State` hasMany the join rows)

> No migration files exist — the backend syncs models with
> `sync({ alter: true })` ([databaseManager.js](../Backendjs/lib/services/databaseManager.js)),
> so the two new tables are created automatically on deploy. Zone tables/columns
> are **kept intact**.

## 4. Backend changes (`Backendjs/`)

**New**
- `lib/models/SalesmanStates.js`
- `lib/models/DistributorStates.js`
- Register both in the model loader + define associations.

**Edit**
- `lib/controllers/salesmanController.js`
  - create/update accept `state_ids: []` → write join rows
  - include `states` when returning a salesman
  - helper: salesmen covering a given `state_id`
- `lib/controllers/distributorController.js` — same as salesman, for distributors.
- `lib/controllers/partyController.js`
  - `state_id` **required**; `zone_id`/`city_id` optional
  - on create: auto-suggest `distributor_id`/`salesman_id` from
    `DistributorStates`/`SalesmanStates` for the party's state (override allowed)
  - add `POST /parties/byStateId`
- `lib/controllers/orderController.js`
  - derive distributor by **state** (keep existing zone path as fallback)
- `lib/routes/salesman.js`, `lib/routes/distributor.js`, `lib/routes/party.js`
  - wire the new endpoints
- `lib/models/Party.js` — confirm `zone_id` / `city_id` `allowNull: true`

### API summary

| Method | Path | Purpose |
|--------|------|---------|
| POST/PUT | `/salesmen` `/salesmen/:id` | accept `state_ids: []` |
| POST/PUT | `/distributors` `/distributors/:id` | accept `state_ids: []` |
| POST | `/parties/byStateId` | parties in a state |
| POST/PUT | `/parties` | `state_id` required; auto-assign by state |

## 5. Frontend changes (`Frontend/`)

- **Salesman & Distributor forms** → multi-select **"Working States"**.
- **Party form** → state required; zone & city optional; auto-fill
  distributor/salesman from the chosen state (override allowed).
- **Order create** (DashboardOrders) → salesman party filter by **state**
  instead of zone.
- API service (`services/api/`): `getPartiesByState`, salesman/distributor
  update with `state_ids`.

## 6. Order of work

1. Backend models + associations
2. Salesman/Distributor state endpoints (read/write `state_ids`)
3. Party assign-by-state + validation (`state` required)
4. Order flow (state-based distributor derivation)
5. Frontend forms (multi-state, party auto-assign)
6. Test end-to-end

## 7. Rollout / risk

- `sync({ alter: true })` runs against the **production DB** on backend deploy.
  Adding the two tables and relaxing nullability is **non-destructive**.
- **No zone tables/columns are dropped** — zones remain as an optional layer.
- Existing salesmen/distributors have **no states yet** → they must set working
  states (no auto-backfill, per decision #4). Existing parties keep their
  current `salesman_id`/`distributor_id`.

## 8. Open / future

- Optional later: a UI to bulk-reassign existing parties by state.
- Optional later: enforce "one distributor + one salesman per state" if the
  business wants strict 1:1 coverage (currently many-to-many + manual pick).
