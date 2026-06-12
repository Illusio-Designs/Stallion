# Stallion Eyewear — Frontend UI Polish Checklist

> A documentation-only punch list. **Nothing here changes code** — it's the list of
> UI-level work to take the frontend from "works" to "impeccable".
> Graded against the `impeccable` (polish), `taste` (design judgment) and
> `house-style` (consistency) bars.
>
> Scope: `Frontend/src` — every public page, dashboard page, shared UI primitive
> and layout shell. Tick items as they're addressed.

---

## 0. Global / Design system (do these first — they cascade everywhere)

- [ ] **Single token source.** Confirm one place defines color/spacing/radius/shadow
      tokens (`styles/globals.css` + `app/globals.css` should not drift). Audit for
      duplicate or conflicting `--` variables across the two globals files.
- [ ] **Neutral ramp + one accent.** Greyscale 50→900 base, a single accent for
      primary actions + focus. Remove decorative color that doesn't carry meaning.
- [ ] **Type scale ≤ 6 steps** (e.g. 12/13/14/16/20/24), used consistently. Hunt for
      one-off `font-size` values in the page CSS files.
- [ ] **Spacing on a 4/8 rhythm.** Grep the `styles/pages/*.css` for arbitrary
      `13px`/`7px`/`15px` one-offs and snap to the scale.
- [ ] **One radius system** (cards 8–12px, inputs/buttons 6–8px, pills for tags).
      Check `ui.css`, `ProductCard.css`, `dashboard-*.css` agree.
- [ ] **One hairline border color** (`#e5e7eb`-ish), `1px`. No dark/heavy borders;
      prefer spacing + background over lines.
- [ ] **Shadow tokens** — soft, low-opacity, layered. No harsh drop shadows; don't
      stack heavy border + heavy shadow on the same element.
- [ ] **Focus-visible ring** defined once and applied to every interactive element.
      No `outline: none` without a replacement.
- [ ] **Font loading** — verify a single clean sans, no FOUT/FOIT flash (the recent
      FOUC fix should be confirmed visually on a cold load).

---

## 1. Shared UI primitives (`components/ui/`) — fix once, benefit everywhere

### Button (`Button.jsx` / `ui.css`)
- [ ] All states present: default · hover · focus-visible · active · disabled · loading.
- [ ] Visual ranking: primary (filled accent) → secondary (outline) → ghost (text).
- [ ] Disabled is muted **and** non-interactive (`disabled` + no hover, `cursor: not-allowed`).
- [ ] Loading locks the button + shows a spinner; no double-submit.
- [ ] Icon + label vertically centered with a consistent gap; comfortable h-9/h-10.

### Modal (`Modal.jsx`)
- [ ] Focus trap; opens with focus moved in, returns focus to trigger on close.
- [ ] Closes on Esc and on backdrop click; body scroll locked while open.
- [ ] Mobile: full-width / bottom-sheet behaviour, no overflow off-screen.
- [ ] Backdrop is a calm scrim, not pure black; subtle enter/exit motion.

### DropdownSelector (`DropdownSelector.jsx`)
- [ ] Keyboard operable (arrows, Enter, Esc, type-ahead); `aria-expanded`/roles set.
- [ ] Long option text truncates; menu doesn't overflow viewport.
- [ ] Selected, hover, focus and disabled option states all distinct.
- [ ] Empty state ("No options") when the source list is empty.

### Pagination (`Pagination.jsx`)
- [ ] Disabled prev/next at bounds (muted, non-interactive).
- [ ] Current page clearly marked; large page counts collapse with `…`.
- [ ] Doesn't shift layout between pages; keyboard reachable.

### TableWithControls (`TableWithControls.jsx`)
- [ ] **Loading** → skeleton rows matching column layout (not a bare spinner).
- [ ] **Empty** → icon + line + primary action ("No orders yet — create one").
- [ ] **Error** → message + retry.
- [ ] Long cell values truncate/wrap intentionally; numbers use tabular-nums + right align.
- [ ] Sticky header on scroll; sort indicators have hover + active state.
- [ ] Row hover state; row actions reachable by keyboard.
- [ ] Horizontal scroll contained on mobile (no page-level overflow).

### Tabs (`Tabs.jsx`)
- [ ] Active tab obvious (weight/underline/accent), not color alone.
- [ ] Keyboard arrow navigation; `role="tab"`/`aria-selected`.
- [ ] Overflow on mobile scrolls instead of wrapping/breaking.

### StatusBadge (`StatusBadge.jsx`)
- [ ] Semantic colors consistent (same green = same meaning everywhere).
- [ ] Color **plus** text/icon (not color alone); contrast ≥ 4.5:1.
- [ ] Unknown/missing status renders a neutral "—" badge, never "undefined".

### Skeleton (`Skeleton.jsx` / `skeleton.css`)
- [ ] Matches final content dimensions to prevent layout shift.
- [ ] Subtle shimmer, not a jarring pulse; respects `prefers-reduced-motion`.

### RowActions (`RowActions.jsx`)
- [ ] Icon buttons have `aria-label` + tooltip; ≥ 40px tap targets.
- [ ] Destructive action (delete) confirms before firing.
- [ ] Menu closes on outside click + Esc.

### LoadingSpinner / Loader (`LoadingSpinner.jsx`, `Loader.jsx`, `LoaderProvider.jsx`)
- [ ] One spinner style across the app; size variants consistent.
- [ ] Full-page loader centered, doesn't cause scrollbar flash.

---

## 2. Layout shells

### Public — Header / Footer (`Header.jsx`, `Footer.jsx`)
- [ ] Header: active nav link state; sticky behaviour smooth; mobile hamburger
      with accessible toggle + focus trap in the open menu.
- [ ] Cart icon shows item count badge; updates live; aligned optically.
- [ ] Footer: columns align to grid; links have hover/focus; no orphan single link.
- [ ] Logo has fixed dimensions (no layout shift on load).

### Dashboard — Header / Sidebar / Footer (`DashboardHeader.jsx`, `DashboardSidebar.jsx`, `DashboardFooter.jsx`)
- [ ] Sidebar: active route highlighted; collapsible state remembered; icons + labels aligned.
- [ ] Sidebar scrolls independently of content; no double scrollbar.
- [ ] Mobile: sidebar becomes a drawer with backdrop + Esc close.
- [ ] Header: user menu keyboard accessible; avatar fallback initials when no image.
- [ ] Role-based nav items (`utils/rolePermissions.js`) hide cleanly — no empty gaps.

### Breadcrumb (`Breadcrumb.jsx`)
- [ ] Current page is non-link + muted; separators consistent; truncates long titles.
- [ ] Collapses sensibly on mobile.

---

## 3. Public pages

### Home (`Home.jsx` / `Home.css`)
- [ ] Hero: image has dimensions (no CLS); headline hierarchy clear; one primary CTA.
- [ ] Product/testimonial carousels: loading + empty states; controls keyboard-reachable.
- [ ] Section rhythm consistent (equal vertical spacing); generous whitespace.
- [ ] Responsive at 375 / tablet / desktop / wide — no overflow, no overlap.

### Products listing (`Products.jsx` / `Products.css`, `filter-chips.css`)
- [ ] **Loading** → skeleton card grid (matches `ProductCard` footprint).
- [ ] **Empty** → "No frames match these filters — clear filters" with an action.
- [ ] **Error** → retry.
- [ ] Filter chips: selected/hover/focus states; "clear all"; count of active filters.
- [ ] Grid stays aligned across rows with uneven card content (name length, price).
- [ ] Pagination reuses the shared `Pagination` primitive.

### ProductCard (`ProductCard.jsx` / `ProductCard.css`)
- [ ] Image fixed aspect ratio; placeholder while loading; broken-image fallback.
- [ ] Long product names `line-clamp` to 2 lines without breaking card height.
- [ ] Price formatted (currency + thousands); strike-through for MRP if discounted.
- [ ] Eye/quantity/add-to-cart controls: hover/active/disabled; add-to-cart gives feedback (toast).
- [ ] Out-of-stock state visually distinct + add disabled.
- [ ] Whole card focus-visible + keyboard activatable.

### ProductDetail (`ProductDetail.jsx` / `ProductDetail.css`)
- [ ] Loading skeleton for gallery + details; error + not-found states.
- [ ] Image gallery: thumbnail selection state; zoom/active; keyboard nav.
- [ ] Quantity selector clamps to min/max stock; add-to-cart feedback.
- [ ] Missing optional fields (specs, description) degrade to clean "—", not blanks.
- [ ] Breadcrumb reflects category path.

### Cart (`Cart.jsx` / `Cart.css`)
- [ ] **Empty cart** state: illustration + "Browse frames" CTA.
- [ ] Quantity update + remove give instant feedback; totals recompute live.
- [ ] Line-item + summary numbers formatted + right-aligned (tabular-nums).
- [ ] Remove confirms (or has undo); loading state on checkout button (no double-submit).
- [ ] Mobile: summary sticks or sits clearly; no overflow.

### Login / Register (`Login.jsx`, `Register.jsx` + CSS)
- [ ] Inputs have real labels (not placeholder-as-label); visible focus; error text inline.
- [ ] Phone input (`react-phone-input-2`) styled to match the design system, not default.
- [ ] OTP flow: resend timer, disabled state, clear error on wrong OTP.
- [ ] Submit shows loading + locks; success/failure feedback explicit.
- [ ] Validation messages specific ("Enter a 10-digit number", not "Invalid").
- [ ] Keyboard: Enter submits; logical tab order; autofill works.

### About / PrivacyPolicy (`About.jsx`, `PrivacyPolicy.jsx` + CSS)
- [ ] Constrained line length for readable body text; consistent heading scale.
- [ ] Real copy, sentence case, no Lorem; section spacing consistent.

---

## 4. Dashboard pages (`pages/Dashboard*.jsx` + `styles/pages/dashboard-*.css`)

Apply the **same four-state contract** (loading skeleton · empty · error+retry · partial/"—")
to every data view below, plus shared-primitive reuse for tables, modals, dropdowns, pagination.

- [ ] **Dashboard** (`Dashboard.jsx`, `dashboard.css`) — stat cards align; numbers
      formatted; chart (`charts/SalesRevenueChart.jsx`) has loading + empty states and
      readable axis/legend; cards don't reflow on data load.
- [ ] **Orders** (`DashboardOrders.jsx`, `dashboard-orders.css`) — status badges
      consistent; filters + pagination; row actions confirm destructive ops.
- [ ] **Products** (`DashboardProducts.jsx`, `dashboard-products.css`) — image
      thumbnails fixed size; create/edit modal validates; bulk states handled.
- [ ] **Clients** (`DashboardClients.jsx`, `dashboard-clients.css`) — long names/emails
      truncate; empty state with add action.
- [ ] **Distributor** (`DashboardDistributor.jsx`) — cascading country→state→city→zone
      selects show loading + empty per level; validation messages specific.
- [ ] **Events** (`DashboardEvents.jsx`) — date/time formatted + localized; empty calendar state.
- [ ] **Expenses** (`DashboardExpenses.jsx`, `dashboard-expenses.css`) — currency
      formatting; totals tabular-aligned; category badges consistent.
- [ ] **Manage** (`DashboardManage.jsx`) — geography CRUD (country/state/city/zone)
      modals reuse shared Modal; delete confirms.
- [ ] **Office Team** (`DashboardOfficeTeam.jsx`) — role dropdowns; avatar fallbacks;
      active/inactive badge.
- [ ] **Suppliers** (`DashboardSuppliers.jsx`, `dashboard-suppliers.css`) — same table contract.
- [ ] **Support** (`DashboardSupport.jsx`, `dashboard-support.css`) — ticket status
      badges; empty inbox state.
- [ ] **Tray** (`DashboardTray.jsx`) — selection states; bulk action feedback.
- [ ] **Settings** (`DashboardSettings.jsx`, `dashboard-settings.css`) — form sections
      grouped by spacing not boxes; save shows loading + success toast; image upload
      has preview + progress + error.
- [ ] **Analytics** (`AnalyticsReports.jsx`, `dashboard-analytics.css`) — charts have
      loading/empty; export (jsPDF) shows progress + success/failure; legends readable.

### Role dashboards
- [ ] **DistributorDashboard / DistributorOrders** — scoped data states; empty states
      worded for the distributor role.
- [ ] **PartyDashboard** — same contract; init-error handling (the `apiService` has
      special "before initialization" handling) surfaces a friendly message, not a 500 string.

---

## 5. Cross-cutting passes (run across the whole app at the end)

### Every data state (the `impeccable` data contract)
- [ ] Loading skeletons everywhere content loads async (no bare spinners over layout).
- [ ] Real empty states (icon + line + action), never blank boxes or lone "0 results".
- [ ] Error + retry on every fetch, never silent fail or raw error text.
- [ ] Partial data → clean "—"; never "undefined" / "null" / "NaN" on screen.
- [ ] Overflow tested with realistic long content (names, emails, product titles).

### Toasts / feedback (`ToastContainerProvider.jsx`, `Toast.css`)
- [ ] Success/error/info styles consistent + semantic; auto-dismiss timing sane.
- [ ] Not stacking infinitely; dismissible; readable on mobile.

### Accessibility (baseline, non-negotiable)
- [ ] Semantic elements (`button` not clickable `div`); labels/`aria-label` on all controls.
- [ ] Keyboard: everything reachable + operable; modals trap focus; logical tab order.
- [ ] Color never the only signal; contrast ≥ 4.5:1 on every surface.
- [ ] Images have meaningful `alt` (or `alt=""` if decorative).

### Responsive & resilient
- [ ] 375 / tablet / desktop / wide — no horizontal scroll, no overlap, tap targets ≥ 40px.
- [ ] Long translations / text zoom don't break layouts.
- [ ] Image dimensions reserved (no CLS); the `scripts/convertImages.js` outputs sized assets.

### Motion (pairs with the `emil-kowalski` skill)
- [ ] Transitions are subtle + consistent (hover, modal, drawer, toast, route).
- [ ] Respect `prefers-reduced-motion`.
- [ ] No janky layout-driven animation; transform/opacity only.

### Content & correctness
- [ ] Currency, thousands separators, dates localized consistently.
- [ ] Singular/plural correct ("1 item" / "2 items").
- [ ] Microcopy specific and human, sentence case, no Lorem anywhere.

---

## 6. Final pass — read it like a user
Before calling any page done: click every button, tab through with the keyboard, shrink the
window to 375, feed it empty + huge + weird data, and reload mid-load. If anything feels
rough, it isn't impeccable yet.

---

### Notes
- API base URL is configured via `NEXT_PUBLIC_API_URL` in `.env.local`
  (set to `https://api.stallioneyewear.in/api`). `apiService.js#getBaseURL()` appends
  `/api` only if missing — the value above already includes it.
- This file is intentionally **non-code**: it documents the polish work; it does not
  perform it.
