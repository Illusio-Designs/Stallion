# Inline Styles → Tailwind Migration Plan

Convert all inline `style={{ … }}` props in the frontend to Tailwind utility
classes, in small, verifiable phases.

**Scope of THIS migration:** inline `style={{}}` props only (~260 across 28
files). The legacy `.css` stylesheets are a **separate** effort and are *not*
touched here. `globals.css` (the `@theme` tokens) and `ui.css` (the shared
component kit) are **off-limits** in every phase.

---

## Golden rules (apply to every file)

1. **Static → Tailwind.** Any inline style with literal values becomes Tailwind
   classes on `className`, and the `style={{}}` prop is removed.
   - `style={{ width: '100%' }}` → `w-full`
   - `style={{ padding: '20px' }}` → `p-5` (20px = Tailwind `5`)
   - `style={{ display:'flex', alignItems:'center', gap:8 }}` → `flex items-center gap-2`
   - `style={{ position:'relative' }}` → `relative`
   - `style={{ borderRadius:'50%' }}` → `rounded-full`
2. **Dynamic stays inline.** Anything computed at runtime **must remain** an
   inline style — Tailwind can't express runtime values reliably.
   - `style={{ width: `${pct}%` }}`, `style={{ top: y }}`, chart bar heights,
     progress bars, transforms driven by state → **leave as-is**.
3. **Use the project tokens**, never hex. Colors map to `@theme`:
   `bg-primary`, `bg-surface`, `text-text`, `text-text-muted`, `text-text-subtle`,
   `border-border`, `border-border-strong`, `rounded-sm/md/lg/xl/pill`,
   `shadow-xs/sm/md/lg/xl`. For one-off token values use arbitrary syntax:
   `bg-[var(--color-grey-50)]`.
4. **Match the spacing scale.** Tailwind spacing = 4px × n. `8px→2`, `12px→3`,
   `16px→4`, `20px→5`, `24px→6`, `28px→7`, `32px→8`. For odd values use
   arbitrary: `mt-[6px]`.
5. **Preserve appearance exactly.** No visual change — this is a pure refactor.
6. **Don't reorder/merge JSX**, just swap styling. Keep semantic class names
   (e.g. `dash-card`) so existing CSS still applies.
7. **One file at a time within a phase** (avoids edit conflicts); files in the
   same phase are independent.

---

## After EVERY phase (verification gate)

1. **Restart the dev server** (`Ctrl+C` → `npm run dev`) — required so Tailwind
   regenerates; HMR alone can serve stale CSS.
2. **Hard-reload** each touched page (`Ctrl+Shift+R`) and eyeball it vs. before.
3. Check the **console** for errors.
4. Only then mark the phase ✅ and move on. **Never start the next phase with an
   unverified previous one.**

---

## Phases

> Ordered low-risk → high-volume. ~30–50 conversions per phase. Check the box
> when the phase is converted **and verified**.

### Phase 0 — Pilot: Cart ✅ (done, pending your visual confirm)
- `pages/Cart.jsx` — already Tailwind-only.

### Phase 1 — Public pages + chrome  ✅
- [x] `pages/Home.jsx` (4) — div→`flex gap-3 mt-4`, Skeleton props→`mr-2`/`mt-4 block`/`mt-3 block`
- [x] `pages/Products.jsx` (2) — swatch `backgroundColor` is dynamic → stays inline
- [x] `pages/ProductDetail.jsx` (1) — color swatch → stays inline
- [x] `components/ProductCard.jsx` (1) — swatch `colorItem.color` → stays inline
- [x] `components/Header.jsx` (3) — removed redundant icon `{width,height}` (size={28} covers)
- [x] `components/DashboardSidebar.jsx` (1) — tooltip `top` is dynamic → stays inline

### Phase 2 — Shared UI components  (~21, several are dynamic → stay)
- [ ] `components/ui/TableWithControls.jsx` (7)
- [ ] `components/ui/DateRangePicker.jsx` (3)
- [ ] `components/ui/DatePicker.jsx` (2)
- [ ] `components/ui/Skeleton.jsx` (1, likely dynamic)
- [ ] `components/charts/SalesRevenueChart.jsx` (3, mostly dynamic SVG → stay)
- [ ] `components/ErrorBoundary.jsx` (5)
> High blast radius (used by many pages) — convert carefully, verify broadly.

### Phase 3 — Dashboard home + Analytics  (~39)
- [ ] `pages/Dashboard.jsx` (33)
- [ ] `pages/AnalyticsReports.jsx` (6)

### Phase 4 — Orders  (~46)
- [ ] `pages/DashboardOrders.jsx` (34)
- [ ] `pages/DistributorOrders.jsx` (12)

### Phase 5 — Tray  (~58)
- [ ] `pages/DashboardTray.jsx` (58)
> Largest single file — do it alone.

### Phase 6 — Party / Distributor  (~38)
- [ ] `pages/DistributorDashboard.jsx` (15)
- [ ] `pages/PartyDashboard.jsx` (14)
- [ ] `pages/DashboardDistributor.jsx` (9)

### Phase 7 — Products / Manage / Suppliers  (~31)
- [ ] `pages/DashboardProducts.jsx` (14)
- [ ] `pages/DashboardManage.jsx` (10)
- [ ] `pages/DashboardSuppliers.jsx` (7)

### Phase 8 — Remaining dashboard pages  (~15)
- [ ] `pages/DashboardEvents.jsx` (8)
- [ ] `pages/DashboardSettings.jsx` (2)
- [ ] `pages/DashboardSupport.jsx` (2)
- [ ] `pages/App.jsx` (2)
- [ ] `pages/DashboardExpenses.jsx` (1)

---

## Totals
- **28 files**, **~260 inline-style usages**.
- A meaningful share (charts, skeletons, progress bars, popovers positioned by
  JS) are **dynamic and will correctly remain inline** — the goal is to remove
  the *static* ones, not to force runtime values into class names.

## Execution note
Each phase can be run as a small parallel batch (one agent per file, since files
are independent), then verified together before the next phase. We do **not**
fan out all 28 files at once — small, verified increments only.
