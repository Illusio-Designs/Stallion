# Offers & Discounts — Design

Status: **Proposal / for review** — no code written yet.

Goal: a **standalone, admin-managed Offers** feature that automatically reduces an
order's price. **Not tied to events** — it is its own entity. Three offer kinds:

1. **Flat rate** — a discount on the whole order (e.g. 10% off, or ₹500 off). Config-driven.
2. **Product-wise** — selected products get their own discount.
3. **Buy X get Y** — e.g. *buy 2 get 1*: the customer actually **buys/ships 3
   units** and is **charged for 2** (the 3rd is the discount). Stock reduces by 3.

Scope is by **selected products** (flat may also be whole-order).

**Roles:**
- **Admin** *creates and manages* offers (the only role that can add/edit/delete).
- **Salesman, distributor, party** *select* an offer in the cart when placing an
  order. They cannot create offers — only choose from the active ones admin made.

**Key rule:** the person placing the order **selects one offer** in the cart; that
single offer applies (no stacking). The backend still validates the chosen offer
is active/valid/applicable and **recomputes** the discount from WHP — the client
never decides the amount.

---

## 1. What the backend does today (the constraint)

- `createOrder` (orderController) **recomputes price on the server** and ignores
  the client's `price`:
  ```js
  const unitPrice = parseFloat(product.whp);   // WHP from the DB
  orderTotal += unitPrice * item.quantity;
  order_items.push({ product_id, quantity, price: unitPrice });
  ```
- Discounts use **WHP** (confirmed).
- Stock is decremented by `item.quantity`. A "get 1 free" unit still **ships**, so
  Buy-2-Get-1 keeps quantity at 3 and reduces stock by 3 — the freebie is a
  *price* discount, never a quantity change.

➡️ **All discount math runs server-side in that loop.** Clients only *preview*.

---

## 2. Data model — standalone, NOT linked to events

A new table `offer` (no `event_id`). Type-specific fields live in a JSON `config`.

```
offer
  offer_id       UUID  PK
  offer_type     ENUM('flat','product','bogo')
  title          STRING            -- e.g. "Diwali 10% off"
  is_active      BOOLEAN  default true   -- admin on/off switch
  priority       INT      default 0       -- ordering in the cart list
  start_date     DATE  null   -- active timeline: offer only works between these
  end_date       DATE  null   -- dates (null start = from now, null end = no expiry)
  config         JSON               -- shape depends on offer_type (below)
  created_at, updated_at
```

`config` by type:

```jsonc
// flat — whole-order discount (always applies to the entire order)
{
  "discount_mode": "percent" | "amount",
  "discount_value": 10,                // 10 (%) or 500 (₹)
  "min_order_amount": 0                // optional threshold (gross subtotal)
}

// product — per-product discounts on selected items
{
  "items": [
    { "product_id": "<uuid>", "discount_mode": "percent", "discount_value": 15 },
    { "product_id": "<uuid>", "discount_mode": "amount",  "discount_value": 100 }
  ]
}

// bogo — buy X get Y on selected products (customer ships buy+get units)
{
  "product_ids": ["<uuid>", ...],
  "buy_qty": 2,
  "get_qty": 1,
  "get_discount_percent": 100          // 100 = the get-units are free
}
```

---

## 3. Which offer applies — user-selected, exactly one

The order-placing role (salesman / distributor / party) **chooses** the offer in
the cart; the order carries that one `offer_id`. The flow:

1. **Cart lists available offers.** `GET /offers/available` returns active offers
   whose date window is current and whose scope **matches at least one item** in
   the current cart (a **flat** offer always matches — it's whole-order;
   **product/bogo** match if their `product_ids` intersect the cart;
   `min_order_amount` respected). Each entry includes the **computed discount for
   this cart** so the user sees the amount before choosing.
2. **User selects one** (or "No offer"). The cart shows the discount line live (§7).
3. **On place**, `createOrder` receives `offer_id`. The server **re-validates**
   (active, in-window, scope matches the order, threshold met) and **recomputes**
   the discount from WHP. If the offer is invalid/expired/not applicable, it's
   rejected (or applied as zero) — never trust the client amount.
4. Apply **only that one offer**. No stacking.

> If the user selects no offer (or none is available), the order prices exactly as today.

---

## 4. Pricing math (the single shared function)

`applyOffer(lines, offer)` where `lines = [{ product_id, qty, unit_price (whp), gross }]`:

- **flat**: applies to the **whole-order** gross subtotal; if
  `subtotal >= min_order_amount`,
  `discount = mode==='percent' ? subtotal*v/100 : min(v, subtotal)` (order-level).
- **product**: for each line whose product is listed,
  `lineDiscount += mode==='percent' ? gross*v/100 : min(v*qty, gross)`.
- **bogo**: for each listed line,
  `freeUnits = floor(qty / (buy_qty+get_qty)) * get_qty`;
  `lineDiscount += freeUnits * unit_price * (get_discount_percent/100)`.

Then: `subtotal = Σ gross`; `discount_total = Σ lineDiscount + flatDiscount`
(only one offer contributes, so it's one of these); `order_total = subtotal −
discount_total` (clamp ≥ 0, round 2 dp).

The **same function** backs `createOrder` and the preview endpoint — never
duplicate it on the client.

---

## 5. Order schema additions (record what was charged)

Keep `order_total` = **final payable** (existing readers stay correct). Add:

```
order.subtotal         DECIMAL(10,2)  -- gross, pre-discount
order.discount_total   DECIMAL(10,2)  -- total discount applied
order.applied_offer    JSON           -- snapshot: { offer_id, type, title, amount } | null
```

Enrich each `order_items` entry (JSON, no migration):
`{ product_id, quantity, price, discount, final_price }`.

Snapshot matters: offers can be edited/deleted later, but a placed order must keep
the price it was charged (View, PDF, audits).

---

## 6. APIs

**Offer CRUD** — standalone, **admin-only** (own routes, not under `/events`):
- `GET    /offers`              (admin — management list)
- `POST   /offers`              (admin)
- `PUT    /offers/:offerId`     (admin)
- `DELETE /offers/:offerId`     (admin)

**Available offers for a cart** — readable by **salesman / distributor / party**
(so they can pick one):
- `POST /offers/available` → `{ order_items }` → list of active, in-window offers
  that match the cart, each with `{ offer_id, title, type, discount_amount }`
  computed for this cart.

**Order quote (preview)** so the cart shows the chosen discount before placing:
- `POST /orders/quote` → `{ order_type, order_items, offer_id }` →
  `{ subtotal, discount_total, order_total, applied_offer, lines:[...] }`
  using the **same** pricing function as `createOrder`.

`createOrder` accepts an optional **`offer_id`**, re-validates + recomputes it, and
**returns** `subtotal/discount_total/applied_offer`.

---

## 7. Frontend

- **New "Offers" management screen** (**admin only**) — separate page (its own
  sidebar item, *not* inside Events). List offers; add/edit with a type switch
  (Flat / Product-wise / Buy X get Y), a product multi-select for scope, validity
  dates, active toggle, priority. CRUD against `/offers`.
- **Cart — offer selector** (salesman / distributor / party): a dropdown of the
  available offers for the current cart (from `POST /offers/available`), each
  labelled with its discount amount; the user picks one (or "No offer").
- **Cart** — once an offer is chosen the discount amount is shown **live, as items
  are selected / quantities
  change** (debounced call to `POST /orders/quote`). Display Subtotal, the applied
  offer as a labelled line with its **rupee discount amount** (− ₹X), and the final
  Total. For **Buy 2 Get 1** the line shows the value of the free unit(s), e.g.
  `Buy 2 Get 1  − ₹900` when the freebie's WHP is ₹900. If nothing qualifies yet,
  no discount line shows. The amount always comes from the server quote (never
  computed in the browser), so the cart preview and the placed order match exactly.
- **Order View + PDF** — Subtotal / Discount / Total block (and the applied-offer
  line), sourced from the new order fields.

---

## 8. Edge cases & rules

- **Validity**: only `is_active` offers inside their date window are considered.
- **One offer only**: never stack; §3 picks the single winner.
- **Rounding**: round discounts + total to 2 dp; clamp totals ≥ 0.
- **Per-line cap**: a line discount can't exceed the line gross; a flat amount can't
  exceed the eligible subtotal.
- **BOGO ships the freebie**: qty unchanged (3), stock −3, price discounted.
- **Snapshot on place**: store `applied_offer` + per-line discount so later edits
  don't change historical orders.
- **All order types**: offers are global; they apply to party/distributor/visit/
  event orders alike (subject to product scope). If you want to limit which order
  types are eligible, add an `order_types` array to `config` — easy to add later.

---

## 9. Rollout (phased, each shippable)

1. **Backend**: `offer` table + auto-add columns, offers CRUD endpoints, admin gating.
2. **Pricing**: shared `selectOffer()` + `applyOffer()`; wire into `createOrder` and
   new `POST /orders/quote`; add order fields + per-line discount.
3. **Offers UI**: standalone admin management page (CRUD).
4. **Cart preview**: wire `/orders/quote`, show the breakdown.
5. **View/PDF**: show subtotal/discount/total.

---

## 10. Confirmed decisions

- Discounts off **WHP**. ✔
- **Buy 2 Get 1** = ship/buy **3**, charge for **2**, stock −3 (price model). ✔
- **Exactly one** offer applies per order — **the order-placing user selects it**. ✔
- **Admin** creates/manages offers; **salesman / distributor / party** select one
  in the cart when ordering. ✔
- Offers are **separate from events** (own entity + admin screen). ✔
- Cart shows the **discount amount live on selection** (incl. the Buy-2-Get-1 freebie). ✔
- Applies to **all order types**. ✔
- **Flat = whole-order only**. ✔
- Each offer has an **active timeline** (`start_date` / `end_date`); it only works
  within that window (plus the admin `is_active` switch). ✔

All decisions are settled — the design is ready to build (Phase 1: `offer` table +
admin CRUD + `/offers/available`).
