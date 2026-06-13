# Stallion Eyewear — Design Change List (point-by-point)

> A single, actionable list of design changes, based on a deep review of the
> frontend and graded against the design bars I work to:
> **taste** (restraint + hierarchy), **impeccable** (every state handled),
> **emil-kowalski** (motion), **house-style** (consistency).
>
> Format per point: **what's wrong → the change → why (which principle)**.
> Priority: **P0** = biggest visible win · **P1** = important polish · **P2** = refinement.
> `[ ]` = todo · `[x]` = already done this engagement.

---

## ✅ Already done (for context)
- [x] Brand-preserving UI revamp (tokens, type scale, spacing rhythm, states).
- [x] Accent changed yellow → blue (`#4f46e5`); no yellow anywhere.
- [x] Clean routes: `/dashboard/products`, `/product/<model_no>`.
- [x] Motion layer (`animations.css`) + reduced-motion safety net + custom `Tooltip`.
- [x] Header cart/user/menu icons → crisp inline SVG (dropped the `filter:brightness(0) invert(1)` webp hack).
- [x] **Login phone input → `react-international-phone`** (cool crisp flags, themed dropdown).
- [x] Tailwind v4 migration of JSX (additive — teardown still pending).
- [x] **P0-2 (DONE):** one icon system — header (cart/user/menu/bell), dashboard sidebar (all nav + toggle chevron), and Home B2B (package/pricing/globe) all now crisp `react-icons`/SVG via `currentColor`. No more webp + `filter:brightness(0) invert(1)` icon hack (only the decorative goggles silhouette image keeps the invert, which is correct).
- [x] **P1-5:** color-swatch active ring unified on light surfaces (Products → double ring; ProductDetail keeps its accent ring — correct for its dark surface).
- [x] **P2-15:** `.ui-label` set `display:block` + consistent line-height (prevents field misalignment).
- [x] **P0-1 (DONE):** 16 dashboard pages now render proper loading skeletons / empty `.ui-state` cards / error+retry using their REAL data (no mocks); pages without an `error` var were left unchanged (no logic edits).
- [x] **P2-13:** broken-image affordance — ProductCard/ProductDetail show an "image unavailable" state instead of blank space.
- [x] **P2-11:** reusable `.price` / `.price--mrp` / `.price--accent` classes added to `ui.css`.
- [x] **P1-6:** `.dash-card` + `.ui-card`/`.ui-panel` now carry a consistent `--shadow-sm` resting elevation.
- [x] **P1-9:** spinner keyframes consolidated to one canonical `ui-spin` (in `animations.css`); removed the `ui-btn-spin`/`cart-spin`/`spin` duplicates.
- [x] **P2-12:** `--backdrop-blur` token added; modal backdrops (ui.css, Products mobile filter) use it consistently.
- ⏭️ **P1-7 (type) / P1-8 (breakpoints):** left as advisory — type-scale enforcement is a codebase-wide review, and breakpoint *tokens* aren't possible in plain CSS `@media` (custom properties can't be used in media queries).
- ⏭️ **P2-14 (link semantics) / P2-16 (dropdown motion):** minor; deferred to avoid global-link regressions / low impact.
- ⏸️ **P1-10 (deferred, by design):** dashboard phone pickers NOT migrated — would change the stored phone value format (`919…` → `+919…`) in party/distributor/user create/update payloads; needs backend agreement. Public Login flag is done.
- ⏸️ **P0-4 (your call):** CSS↔Tailwind teardown — destructive + visually unverifiable; do as a QA'd step. CSS edits currently take effect since unlayered CSS wins.

---

## P0 — Biggest visible wins

### 1. Finish dashboard data-states (loading / empty / error)
- **Wrong:** several dashboard pages show a bare spinner or plain "No data" text; `ui.css` already defines a polished `.ui-state` card (icon + title + description + CTA) that isn't used everywhere.
- **Change:** in every dashboard list/table (Orders, Clients, Products, Suppliers, Support, Events, Tray…), render `.ui-state--loading` (skeleton), `.ui-state--empty` ("No orders yet — create one" + button), `.ui-state--error` (message + Retry).
- **Why:** *impeccable* — "every data view needs every data state." Half-baked empty screens read as broken.

### 2. One icon system (kill the webp + filter hack)
- **Wrong:** icons are a mix of `.webp` images recolored with `filter: brightness(0) invert(1)` (thin/faint, can't tint or hover), inline SVG, and react-icons. Files: `DashboardSidebar.css`, `Home.css`, others.
- **Change:** standardize on inline SVG / react-icons that inherit `currentColor` (already done for the public header). Convert sidebar, Home B2B icons, dashboard footer.
- **Why:** *house-style* + *taste* — one consistent, crisp, tintable icon language.

### 3. Standardize interactive states
- **Wrong:** disabled opacity drifts (`0.55` vs `0.6` vs color-shift); inputs/quantity-steppers have inconsistent hover/focus/error rings (e.g. cart qty buttons lack `:hover`).
- **Change:** one shared rule set in `ui.css` for default · hover · focus-visible · active · disabled across all buttons/inputs/steppers. Pick `opacity: 0.55` for disabled, one focus ring (`--focus-ring`), one error ring (`--focus-ring-error`).
- **Why:** *impeccable* — "every interactive element needs every state," consistently.

### 4. Resolve the CSS ↔ Tailwind hybrid
- **Wrong:** Tailwind utilities were added on top of the existing CSS, but unlayered CSS wins the cascade — so the Tailwind classes are currently inert clutter.
- **Change:** either run the **CSS teardown** (strip stylesheets to un-expressible residuals so Tailwind drives styling) **or** revert to plain CSS. Don't ship the dual system long-term.
- **Why:** *house-style* — one source of truth; the hybrid is a maintenance trap.

---

## P1 — Important polish

### 5. Standardize the color-swatch active ring
- **Wrong:** three different rings — `ProductCard.css`, `Products.css`, `ProductDetail.css` each style the *same* element differently.
- **Change:** one ring everywhere: `box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-primary)`.
- **Why:** *house-style* — identical components must look identical.

### 6. One shadow-depth scale
- **Wrong:** `.dash-card` has no shadow; product cards use `sm`→`lg` on hover; `.main-product-image` is `lg` at rest. Inconsistent elevation.
- **Change:** surfaces = `--shadow-sm`; interactive-card hover = `--shadow-md`; overlays/modals/dropdowns = `--shadow-lg`. Apply uniformly.
- **Why:** *taste* — depth should mean one thing; soft, layered, consistent.

### 7. Consistent typography hierarchy
- **Wrong:** body copy mixes 14/16px; card labels mix `--text-sm`/`--text-base` with no pattern.
- **Change:** lock a scale — H1 `--text-2xl`, H2 `--text-xl`, card title `--text-lg`/semibold, overline `--text-xs` uppercase + `--tracking-label`, body `--text-base`, meta `--text-sm` muted. Document it in `globals.css`.
- **Why:** *taste* — "limited type scale, used consistently"; hierarchy obvious in a half-second squint.

### 8. Unify breakpoints
- **Wrong:** `1023 / 1024 / 768 / 480 / 426 / 384px` all appear across files.
- **Change:** one set — `480 / 768 / 1024 / 1440`. Replace one-off values.
- **Why:** *house-style* — predictable responsive behavior, fewer surprises.

### 9. Motion consistency
- **Wrong:** three duplicate spin keyframes (`ui-btn-spin`, `spin`, `cart-spin`); some component transitions don't honor reduced-motion individually (only the global net catches them).
- **Change:** one `@keyframes ui-spin` in `animations.css`; durations ≤300ms; exits faster than enters; transform/opacity only.
- **Why:** *emil-kowalski* — motion is invisible, consistent, interruptible, reduced-motion safe.

### 10. Phone pickers in dashboards
- **Wrong:** 5 dashboard pages (Clients, Suppliers, Distributor, OfficeTeam, Settings) still use the old `react-phone-input-2` (dated flags) — inconsistent with the new Login picker.
- **Change:** migrate them to `react-international-phone` too (same theme), then drop `react-phone-input-2`.
- **Why:** *house-style* — one phone component, one flag style, one dependency.

---

## P2 — Refinement

### 11. Reusable `.price` style
- **Change:** one class — `tabular-nums` + semibold; `--struck` (line-through, subtle) and `--accent` modifiers. Use in card, PDP, cart.
- **Why:** *house-style* — numbers align and read the same everywhere.

### 12. Modal backdrop token
- **Wrong:** `blur(3px)` vs `blur(2px)` across modals.
- **Change:** `--backdrop-blur: 3px` token; one scrim color (not pure black).
- **Why:** *taste* — calm, consistent overlays.

### 13. Broken-image affordance
- **Change:** when a product image fails, show a small "image unavailable" state (icon + line) instead of blank space (ProductCard already has the fallback hook).
- **Why:** *impeccable* — handle the unhappy path.

### 14. Link color semantics
- **Change:** light surfaces → `--color-primary`; dark surfaces (nav/breadcrumb) → white `0.82`→`1` on hover. One rule, not per-page overrides.
- **Why:** *house-style* + *taste* — color carries meaning, applied consistently.

### 15. Form-label alignment
- **Change:** `.ui-label` gets a fixed `min-height` so fields don't shift vertically when a label wraps.
- **Why:** *impeccable* — no accidental layout shift.

### 16. Dropdown/menu motion
- **Change:** dropdowns scale+fade from their trigger edge (`transform-origin`), ~200ms ease-out enter / faster exit.
- **Why:** *emil-kowalski* — origin-aware, things animate from where they come from.

---

## Suggested order of execution
1. **P0-1** (dashboard states) and **P0-2** (icons) — most visible "finished" feeling.
2. **P0-4** (decide the Tailwind teardown) — unblocks everything styling-wise.
3. **P1-5/6/7** (swatch ring, shadows, type) — quick consistency wins.
4. **P1-10** (dashboard phone pickers) — finishes the flag work app-wide.
5. **P2** — refinement pass.

> The foundation (tokens, focus rings, reduced-motion, routing) is strong — this list
> is the remaining ~30% that takes it to a Linear / Stripe / Vercel bar: **consistency,
> finished states, one icon system, and resolving the CSS/Tailwind split.**
