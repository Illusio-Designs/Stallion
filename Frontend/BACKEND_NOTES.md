# Backend notes (for the API team)

Issues the **frontend cannot fix on its own** — they need a change on
`Backendjs` / the API server. The frontend is aligned to the routes in
`origin/backend` otherwise.

## 1. `GET /orders/my` is unreachable from the browser ⚠️
`orderController.getMyOrders` does `const { role } = req.body` and **requires
`role` in the request body**. A browser `fetch()` **cannot send a body on a
`GET`** (it throws `TypeError: Request with GET/HEAD method cannot have body`).

So role-scoped orders can't be wired on the frontend as-is.

**Fix (one of):**
- Read the role from the token instead of the body: `const role = req.user.role`
  (the user is already authenticated), **or**
- Change the route to `POST /orders/my`.

Once fixed, the frontend can show each end-user role only their own orders
(salesman / distributor / party), the same way parties are already scoped.

## 2. No `GET /products/:id`
There's no single-product route, so the frontend resolves a product by id via
`POST /products` + client-side match (`getProductById`). A `GET /products/:id`
(or `POST /products/by-id`) would be cleaner if you add it.

## 3. API server / openresty (already resolved on your side, recorded here)
The API sits behind **openresty + Imunify360**. Two gotchas the frontend works
around / that were configured on the server:
- **Imunify360 bot-protection** returns `415` for requests with `Accept: */*`
  (fetch's default) and challenges automated IPs. The frontend now always sends
  `Accept: application/json`. Keep `/api/*` excluded from bot-protection so the
  browser's `OPTIONS` preflight and `fetch` aren't blocked.
- **CORS**: the API does not send `Access-Control-Allow-Origin` and 415s the
  `OPTIONS` preflight, so the frontend talks to the API **same-origin via a Next
  rewrite proxy** (`/api/*` → the API). If you'd rather the browser call the API
  directly, add `app.use(require('cors')())` and let the preflight through.

## Role → endpoint map the frontend uses
| Role | Parties | Orders |
|------|---------|--------|
| admin / *_manager | `POST /parties/get` (all) | `GET /orders` (all) |
| salesman | `GET /salesmen/parties` | needs #1 fixed → `GET/POST /orders/my` |
| distributor | `GET /distributors/parties` | needs #1 fixed |
| party | `GET /parties/my` | needs #1 fixed |
