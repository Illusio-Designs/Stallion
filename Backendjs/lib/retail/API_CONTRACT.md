# Retail (B2C) store API contract

The retail store is a separate public website (folder `Retail/`, its own domain) with its own data. It talks only to the
**public API** below. The Stallion admin (folder `Frontend/`, "Retail" side of the Wholesale / Retail switch) talks to the
**admin API**. All retail tables are prefixed `retail_` and never join to wholesale tables. Wholesale prices (WHP) must
never appear in any public response.

Base: `/api/retail`. JSON in and out. Success: `{ "success": true, "data": ... }` (lists also send `"pagination": { "page", "limit", "total", "totalPages" }`).
Error: `{ "success": false, "message": "readable reason" }` with a proper status (400 bad input, 401/403 auth, 404, 409 conflict, 422 stock problems, 429 rate limit).
Money is a number in rupees (2 decimals max). Dates are ISO strings. IDs are UUID strings. Nothing is ever deleted: use `is_active` / status `archived`.
Time-based reports use India time (UTC+05:30).

## Roles
- `admin` = super admin: sees Wholesale and Retail.
- `retail_manager`: everything in Retail. `retail_editor`: blog, SEO, FAQs, content pages only.
- Any other role = Wholesale only. `GET /api/retail/access` (any logged-in user) returns `{ wholesale: bool, retail: bool }`.
- Admin routes are under `authenticateToken` + `checkRole(RETAIL_CONTENT_ROLES)` (see `routes/index.js`). Routes that only managers may use add `checkRole(RETAIL_ADMIN_ROLES)` (from `routes/roles.js`).

## Models (tables)
Already created: `RetailSetting` (`retail_settings`), `RetailProduct` (`retail_products`). Others are added by the owning agent in `retail/models/` (auto-loaded):
`RetailOrder`, `RetailOrderItem`, `RetailOrderEvent` (status history), `RetailCustomer`, `RetailVisit`, `RetailEvent` (funnel), `RetailMessage` (contact form),
`RetailPage` (SEO per path), `RetailPost` (blog), `RetailFaq`, `RetailContent` (about/privacy/terms/returns/shipping text).

## Settings keys (retail_settings, JSON values)
`store` {name, tagline, logo_url, support_phone, whatsapp, email, address, hours, social{instagram,facebook,youtube}},
`banner` {headline, sub, image, cta_label, cta_url}, `usps` [{title, text}],
`shipping` {free_over, cod_enabled, cod_fee, express_enabled, express_charge, packing_days, zones:[{name, states[], days_min, days_max, charge}], blocked_pincodes[]},
`tracking` {ga_id, meta_pixel_id, cookie_notice(bool)} (public), `tracking_secrets` {meta_capi_token, ga_api_secret} (secret, never public),
`store_enabled` (bool). Admin `GET/PUT /settings` reads and writes these; the public `GET /settings` returns only the public ones.

## PUBLIC API (no login, rate limited) — `/api/retail/public`

Catalogue (owner: backend-catalog)
- `GET /settings` -> store, banner, usps, shipping summary {free_over, cod_enabled, cod_fee, express_enabled, express_charge}, tracking {ga_id, meta_pixel_id, cookie_notice}, store_enabled.
- `GET /home` -> { banner, featured: [Card], shapes: [{name, count, image}], posts: [PostCard] (3) }.
- `GET /products?search&shape&frame_type&frame_material&gender&color&min_price&max_price&sort=popular|new|price_asc|price_desc&page&limit` -> Card[] + pagination. Only `show_on_store && is_active && stock > 0`.
- `GET /products/filters` -> { shapes[], frame_types[], frame_materials[], genders[], colors[], price {min,max} } each with counts.
- `GET /products/:slug` -> Product detail: Card fields + description, images[], specs {shape, frame_type, frame_material, lens, size_mm, gender, brand}, colors[{name, slug, stock}] (sibling frames with the same base model), related[Card] (4), seo {title, description}, stock, low_stock.
- `GET /search/suggest?q=` -> up to 6 {title, slug, image, mrp}.
- Card = { id, slug, model_no, title, image, mrp, stock, low_stock (stock<=5), shape, frame_material, color }.

Content and SEO (owner: backend-catalog)
- `GET /blog?tag&page&limit` -> PostCard[] + pagination. `GET /blog/:slug` -> full post {…, body, tags, related_products[Card], seo}.
  PostCard = { slug, title, summary, cover_image, tags[], published_at, read_minutes }.
- `GET /pages/:key` (about|privacy|terms|returns|shipping) -> { key, title, body (sanitised HTML), updated_at }.
- `GET /faqs` -> [{ category, items:[{id, question, answer}] }].
- `GET /seo?path=/shop` -> { title, description, og_image, canonical, noindex } (falls back to defaults).
- `GET /sitemap` -> [{ path, lastmod, changefreq, priority }] covering static pages, products, posts.
- `GET /feed/products` -> Google Merchant style JSON items {id, title, description, link, image_link, price "1250.00 INR", availability}.

Checkout and shipping (owner: backend-orders)
- `POST /shipping/check` { pincode, subtotal } -> { serviceable, cod_available, estimate_days_min, estimate_days_max, estimate_date, options:[{id:"standard"|"express", name, days_min, days_max, charge, free:bool}] }.
- `POST /checkout/quote` { items:[{product_id, quantity}], pincode, shipping_option, payment_type:"cod" } -> { items:[{product_id, title, image, price, quantity, line_total, available_stock}], subtotal, shipping_fee, cod_fee, total, issues:[{product_id, code:"out_of_stock"|"limited_stock"|"inactive", message}] }. Prices come from the database only.
- `POST /checkout/orders` { customer:{name, phone, email?}, address:{line1, line2?, city, state, pincode}, items, shipping_option, payment_type:"cod", notes?, session_id?, utm?:{source,medium,campaign,term,content}, consent?:bool } -> 201 { order_number, total, status, track_url_hint }. One transaction: validate, re-price, create order and items, reserve (deduct) stock; side effects only after commit. 422 with `issues` if stock changed.
- `POST /orders/track` { order_number, phone } -> { order_number, status, payment_type, total, created_at, items[], address summary, shipment:{courier, awb, tracking_url}, timeline:[{status, note, at}], expected_delivery }. 404 if the pair does not match.
- `POST /contact` { name, contact, message } -> { ok }.
- Tracking pings (never fail the page): `POST /track/visit` { session_id, landing_page, referrer, utm_* } ; `POST /track/event` { session_id, type: view_item|add_to_cart|begin_checkout|purchase, product_id?, value? }. Bots (user-agent) are ignored.

Order statuses: `pending` -> `confirmed` -> `packed` -> `dispatched` -> `out_for_delivery` -> `delivered`; side: `cancelled`, `returned`. Payment: `cod` (payment_status `pending` until delivered, then `paid`), later `online`.

## ADMIN API (Bearer token) — `/api/retail/admin`
Catalogue / settings (owner: backend-catalog)
- `GET /settings`, `PUT /settings` { key: value, ... } (partial update; secrets are write-only and returned masked).
- `POST /sync` (manager) copies/refreshes frames from the Stallion `products` table into `retail_products` (match on `source_product_id`; new frames start `show_on_store=false`, stock 0; existing frames keep store-owned fields: show_on_store, stock, slug, seo, title/description edits). Returns { created, updated, skipped }.
- `GET /products?search&shown=true|false&page&limit`, `PUT /products/:id` { show_on_store, stock, mrp, title, description, slug, seo_title, seo_description, is_active }, `POST /products/bulk` { ids[], show_on_store }.
- `GET/POST/PUT /posts` (+ `PUT /posts/:id` status draft|published|archived), `GET/POST/PUT /faqs`, `GET/PUT /content/:key`, `GET/PUT /pages` (SEO rows: path, title, description, og_image, canonical, noindex). Editors may use posts, faqs, content and pages only.
Orders / analytics (owner: backend-orders)
- `GET /orders?status&q&from&to&page&limit` (q matches order number, name, phone), `GET /orders/:id` (full, with items and timeline), `PUT /orders/:id/status` { status, note }, `PUT /orders/:id/shipping` { courier, awb, tracking_url }, `GET /orders/summary` { counts by status, revenue today and 30 days }.
  Cancelling returns stock. Every change writes `RetailOrderEvent`.
- `GET /analytics/summary?days=30` -> { visits, add_to_cart, begin_checkout, orders, funnel:[{step, count, pct}], sources:[{source, visits, orders}], top_posts:[{slug, title, visits}], top_products:[{id, title, views, orders}] } (India time days).
- `GET /messages` (contact form), `PUT /messages/:id` { handled:true }.

## Frontend rules shared by all apps
- Black and white identity, rupee symbol, compact UI, sentence-case labels, light/dark/system theme through the same tokens as the wholesale app.
- Retail admin screens live in `Frontend/` behind the Retail side; they never show wholesale prices, parties or trays.
