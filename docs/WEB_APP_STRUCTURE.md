# Stallion web app: layout, theme and flow (for developers)

For the person who maintains the `Frontend/` app (Next.js 15, React 19, Tailwind 4).
It explains how a page is chosen, which frame it sits in, how the light/dark theme works, where styles live, and the rules that keep the app consistent.
The retail store (D2C) pages that also live in this folder are not covered here.

---

## 1. The request flow: from URL to page

```
URL
 └─ app/layout.jsx            fonts, global CSS, ThemeScript, providers (loader, toasts, confirm)
     └─ app/page.jsx          "/"            -> page key 'login'
     └─ app/[...slug]/…       every other URL -> DynamicClient.jsx
          └─ utils/dashboardRoutes.js     URL <-> page key
               └─ pages/App.jsx           login check, role check, which page, which layout
                    └─ layouts/*          the frame (header, menu, bottom bar)
                         └─ pages/*       the screen
```

- There is **one client router**, `pages/App.jsx`. It holds the current *page key* and renders the matching page inside a layout. Next's own routing only supplies the URL.
- `app/[...slug]/page.jsx` is a server component that sets per-page SEO metadata (`utils/pageMeta.js`); `DynamicClient.jsx` turns the pathname into a page key.
- A **page key** is the internal name of a screen (`orders`, `party`, `dashboard-products`). The same keys are used by the router, the side menu, the bottom bar and role permissions. Only the URL slug can differ, and that mapping lives in one file: `utils/dashboardRoutes.js`.

| URL | Page key | Page file |
|---|---|---|
| `/` , `/login` | `login` | `pages/Login.jsx` |
| `/dashboard` | `dashboard` | `pages/Dashboard.jsx` (role-aware home) |
| `/dashboard/products` | `dashboard-products` | `DashboardProducts.jsx` |
| `/dashboard/orders` | `orders` | `DashboardOrders.jsx` |
| `/dashboard/party` | `party` | `DashboardClients.jsx` |
| `/dashboard/salesmen` | `salesmen` | `DashboardSuppliers.jsx` (salesmen and visits) |
| `/dashboard/distributor` | `distributor` | `DashboardDistributor.jsx` |
| `/dashboard/office-team` | `office-team` | `DashboardOfficeTeam.jsx` |
| `/dashboard/tray` | `tray` | `DashboardTray.jsx` (sample trays) |
| `/dashboard/events`, `/offers`, `/expenses`, `/manage`, `/analytics`, `/support`, `/settings` | same names | `DashboardEvents`, `DashboardOffers`, `DashboardExpenses`, `DashboardManage`, `AnalyticsReports`, `DashboardSupport`, `DashboardSettings` |
| `/products` | `products` | `Products.jsx` (the shop) |
| `/product/<model_no>` | `product-detail` | `ProductDetail.jsx` |
| `/cart` | `cart` | `Cart.jsx` |
| `/about`, `/privacy-policy` | same | `About.jsx`, `PrivacyPolicy.jsx` |

Rules in `App.jsx` that every change must keep:
1. **Sign-in is required** for everything except `login` and `privacy-policy` (`PUBLIC_PAGES`). A logged-out visitor goes to `/login?returnUrl=…` and comes back afterwards.
2. **Role check**: for dashboard pages, `hasAnyRolePageAccess(roles, page)` must be true. A member can hold several roles; any role that unlocks the page is enough. If none does, the app redirects to the first page the member may open.
3. **Dashboard pages are lazy-loaded** (`lazy(() => import(...))`), the public/auth pages are imported eagerly so their CSS is there on first paint. The dashboard page CSS files are imported eagerly in `App.jsx` for the same reason (no flash of unstyled content).

## 2. The three layouts (frames)

`getLayoutFromPage` in `App.jsx` picks one:

| Layout | Used for | What it contains |
|---|---|---|
| `AuthLayout` | `login` | Just a full-height surface; the login page draws everything else. |
| `DashboardLayout` | every dashboard page **and the shop (`products`, `product-detail`) and `cart`** | Sidebar, header, page area, footer (desktop only), bottom bar (phones). One frame for the whole signed-in app. |
| `PublicLayout` | `about`, privacy policy and any other public page | Header, breadcrumb, page, footer (desktop), the same bottom bar as the dashboard. |

### DashboardLayout anatomy

```
┌───────────────┬──────────────────────────────────────────────┐
│ DashboardSide │ DashboardHeader  (menu, logo, search,         │
│ bar           │                   notifications, cart, profile)│
│ (ink black,   ├──────────────────────────────────────────────┤
│  both themes) │ OfflineVisitsBanner (only with queued visits) │
│               │ <main class="dashboard-content page-enter">   │
│  240 px wide  │   Suspense -> PageSkeleton while loading      │
│  or 76 px rail├──────────────────────────────────────────────┤
│               │ DashboardFooter (desktop only)                │
└───────────────┴──────────────────────────────────────────────┘
 phones: sidebar becomes an off-canvas drawer; DashboardBottomNav floats at the bottom
```

- **Breakpoints** (use exactly these, they are shared with Tailwind's `md:`):
  - phone: `< 768px` (`max-width: 767.98px`)
  - tablet: `768px – 1100px`, sidebar starts as the 76 px icon rail
  - desktop: `> 1100px`, sidebar open (240 px) or collapsed (saved in `localStorage` key `dashboardSidebarCollapsed`)
- One value, `effectiveCollapsed`, drives the sidebar width, the header offset and the page margin, so they can never disagree.
- Page content is capped at `max-width: 1440px`. On phones the page keeps `84px + safe-area` of bottom space so the floating bottom bar never covers content.
- The `<main>` has `key={currentPage}` and the `page-enter` class: every page change remounts it and plays the enter animation. **Warning:** `page-enter` keeps a CSS `transform`, which makes `position: fixed` children position against it instead of the screen. Menus and popovers inside a page must render with `createPortal(..., document.body)` (the party row menu does).
- Hooks mounted by the layout: `useTokenMonitor` (logs out if the token disappears) and `useOfflineSync` (sends visits saved while offline).

### Menus: where to add a page

The menu items are defined in **two** places and must stay in the same order and naming:
- `components/DashboardSidebar.jsx` (`ALL_ITEMS`) – the full list, text such as "Sample trays", "Reports".
- `components/DashboardBottomNav.jsx` (`ALL_ITEMS`) – the phone bar. It shows Dashboard first, then Shop, then the next role-allowed items, then Cart in the last slot (Orders and Salesmen are reached from the Menu button). Icons come from the `ICONS` map; short labels from `SHORT`.

Both filter by the member's roles through `utils/rolePermissions.js`.

### Adding a new dashboard page (checklist)
1. Create `pages/DashboardXxx.jsx` (default export, no layout inside it).
2. `utils/dashboardRoutes.js`: add the key to `DASHBOARD_PAGE_KEYS` (and `KEY_TO_SLUG` if the URL differs from the key).
3. `pages/App.jsx`: lazy import, add the key to the local `dashboardPages` list in `renderPage`, add a `case`.
4. `utils/rolePermissions.js`: add to `ALL_PAGES` and to every role that may open it (`admin` has all).
5. Menu: add to `ALL_ITEMS` in the sidebar and bottom bar, and an icon in both `ICONS` maps.
6. `utils/pageMeta.js`: add the page title/description.
7. Styles: a `redesign-p-xxx.css` imported by the page (see section 4), plus a dark-mode rule set only if it uses a colour that is not a token.
8. Make sure the backend route enforces the same roles; the menu only hides things.

## 3. Theme: light, dark and system

**How it works**
- The visitor's choice is `light`, `dark` or `system`, saved in `localStorage` key `stl-theme` (`utils/theme.js`). Default is `system`.
- `components/ThemeScript.jsx` is an inline script in `<head>`. It runs **before first paint**, resolves the choice and sets `data-theme="light|dark"` and `color-scheme` on `<html>`. This is why dark mode never flashes white. Do not remove it or turn it into a `useEffect`.
- `components/ThemeSwitch.jsx` is the three-way switch (segmented in the header menu, cards on the Settings page). It calls `setThemeChoice`, which saves, applies, and dispatches the `stl-theme-change` event.
- `layout.jsx` sets `viewport.themeColor` for both schemes (`#ffffff`, `#0b0b0c`) and `color-scheme: light dark`.

**Tokens (one source of truth) – `styles/theme.css`**

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--t-ink` | main text, icons, outlines | `#0a0a0a` | `#f2f2f2` |
| `--t-mute` / `--t-faint` | secondary / tertiary text | `#595959` / `#8c8c8c` | `#a3a3a8` / `#85858a` |
| `--t-on-ink` | text on an ink surface | `#ffffff` | `#0a0a0a` |
| `--b-page` | page background | `#ffffff` | `#0b0b0c` |
| `--b-card` | cards, panels, inputs | `#ffffff` | `#151516` |
| `--b-soft`, `--b-soft2` | subtle fills | `#f4f4f4`, `#ececec` | `#1e1e20`, `#28282b` |
| `--b-ink` | primary buttons, active chips | `#0a0a0a` | `#f2f2f2` |
| `--l-line` | hairlines, borders | `#e1e1e1` | `#2b2b2e` |
| `--c-ok`, `--c-bad` (+ `-soft`) | success / error | green / red | lighter green / red |
| `--b-side`, `--t-side`, `--b-side-on` | sidebar | stays dark in both themes | |
| `--scrim` | modal backdrop | 45 % black | 65 % black |

`theme.css` also remaps the Tailwind/component tokens from `app/globals.css` (`--color-primary`, `--color-bg`, `--color-surface`, `--color-border`, `--color-text…`, `--color-grey-50…900`, shadows, focus ring) for dark. So both families work: use `--t-*`, `--b-*`, `--l-*` in new CSS; `bg-surface`, `text-text-muted`, `border-border` etc. in Tailwind classes.

**Rules for new UI**
1. **Never write a hex colour** for text, backgrounds or borders. Use tokens, and the dark theme comes free. This was the cause of the "labels invisible in dark mode" bugs: a hard-coded `#0a0a0a` label on a dark panel.
2. Brand is monochrome (ink black and white). The only colours are the status ones (`--c-ok`, `--c-bad`, warning) and they have `-soft` backgrounds.
3. If a design truly needs a colour that has no token (stripes, hatch patterns, track colours), add a rule to the matching `dark-*.css` file: `:root[data-theme="dark"] .your-class { … }`.
4. Test every new screen in light **and** dark, on a phone width and a desktop width.

## 4. Styles: where things live and in what order

```
app/globals.css            @import "tailwindcss" + animations + theme + phone-input; design tokens
                           (--color-*, --space-*, --text-*, --header-height 80px …)
styles/theme.css           light/dark tokens (section 3), theme switch, notification card
styles/globals.css         resets in @layer base (so Tailwind utilities still win), headings, .page
styles/components/*.css    one file per shared component (ui.css = buttons, inputs, dropdown, panel…)
styles/pages/*.css         the older per-page files (dashboard-layout.css is the frame)
styles/redesign*.css       the black-and-white redesign, layered on top (see below)
styles/dark-*.css          dark-mode fixes for colours that are not tokens
```

**Load order matters** (`app/layout.jsx`): `globals.css` → `redesign.css` → `redesign-public.css` → `redesign-a … m` → `redesign-n-touch / polish / app` → `dark-public / shell / tables / ops`. Later files win at equal specificity, so dark files come last on purpose. Page-specific `redesign-p-*.css` files are imported by the page that needs them (for example `DashboardOrders.jsx` imports `redesign-p-orders.css`).

**Naming**
- `redesign-p-<page>.css`: the current look of one page (orders, party, products, salesmen, cart, shop, forms, …). Edit these first when changing a page.
- `redesign-n-*.css`: cross-cutting polish and touch rules. `redesign-a … m`: the first redesign passes (shell, tables, storefront, auth, forms).
- `dark-shell.css` (header, sidebar, shared UI), `dark-tables.css` (Orders, Parties, Salesmen, Distributors, Office team, Manage), `dark-ops.css` (expenses, events, offers, trays, products, reports), `dark-public.css` (storefront and login).
- Rules in the `redesign-p-*` files are prefixed with `:root` (`:root .orp-kpi { … }`) to win over older rules without `!important`. Keep that pattern.
- Class prefixes are per page (`orp-` orders, `pp-` parties, `sx-` salesmen, `ordn-` order panel, `pf-` forms, `pc-` product card, `mng-` manage). Reuse a prefix when you extend a page.

**Tailwind v4 note:** element resets are in `@layer base`, so a Tailwind class like `p-4` beats them. Component classes are *unlayered* and beat both. Do not add unlayered global element rules (`button { … }`); they override every Tailwind utility.

## 5. The shared building blocks (`components/ui`)

Use these instead of native controls or one-off markup:

| Need | Use | Notes |
|---|---|---|
| Button | `Button` | primary / secondary / ghost / danger, loading state |
| Dropdown | `DropdownSelector` (and `PagedMultiSelect`) | **Never a native `<select>`** |
| Date, date range, date + time | `DatePicker`, `DateRangePicker`, `DateTimePicker` | **Never a native date input**; the calendar opens above or below so it is never covered |
| Add / edit form | `AsidePanel` | right-side slide-over with `title`, `footer`, `width` `'sm'|'md'|'lg'`; handles Escape, backdrop, scroll lock, focus; follows the visible area above the phone keyboard so Save stays visible |
| Table | `TableWithControls` | title, search, row count, sort, `Pagination`; becomes one card per row on phones |
| Pagination | `Pagination` | `page`, `pageCount`, `onPageChange` |
| Row "…" menu | `RowActions` | |
| Tabs / chips | `Tabs`, `styles/components/filter-chips.css` | |
| Status pill | `StatusBadge` | |
| Confirm | `ConfirmDialog` / `ConfirmProvider` (`useConfirm`) | not `window.confirm` in new code |
| Loading | `PageSkeleton`, `Skeleton`, `LoadingSpinner`, `Loader` | grey placeholders; the frame stays visible |
| Search | `GooeySearch` | round icon that opens into a field |
| Address | `AddressAutocomplete` | Google suggestions, fills pincode/state/city |
| File | `FileUpload` | dashed drop area |
| Toasts | `ToastContainerProvider` + `services/toastQueue.js` | gooey toasts with title and description |

Icons: **Hugeicons** only. Import them through `components/icons/hugeicons.jsx` (the sidebar and bottom bar do), and use the rupee icon (`components/icons/RupeeIcon.jsx`, ₹), never a dollar icon. Do not add new `react-icons` usage.

**Look** (the "compact black-and-white" rules): small controls, 44 px minimum tap targets on phones, sentence-case titles, one heading level per step (no skipped levels), fonts Bricolage Grotesque (headings) and Figtree (text) loaded from Google Fonts in `layout.jsx`, body fallback `Spoof Trial`.

## 6. How a list/table page is built

1. State: `page`, `search` (debounced ~300 ms), tab, filters, `rows`, `loading`.
2. Load data through a function in `services/api/*` (never `fetch` inside a page).
3. Render `TableWithControls` (desktop) / the card list (phone), `Pagination`, tabs with counts.
4. Add / edit in an `AsidePanel`. After a save, refetch.
5. Role-aware: show buttons only to roles the server allows (`canXxx` helpers or `getUserRoles()`); the server is the real guard.
6. Nothing is deleted: use an Active/Inactive switch. (Delete party exists only for a party with no orders or visits.)

**Known state:** several of these pages (Parties, Orders, Distributors, Salesmen, Visits) still load every page of data and page it in the browser. Moving them to real server paging (`getXxxPage` helpers, `fetchPage`) is in progress; the Products page already works that way and is the reference.

## 7. Data layer (`services/`)

- `services/api/client.js` is the only HTTP entry: `apiRequest` adds the base URL, the token, JSON handling and error messages; `fetchPage` (one page → `{ data, pagination }`), `fetchAllPages` (all pages, 6 at a time in parallel), `sharedRead` (reads shared and cached by key), `TTL_*` cache times, `LIST_LIMIT`/`PAGE_SIZE`.
- API calls are grouped by area: `authApi`, `partnersApi` (parties, distributors, salesmen), `inventoryApi` (orders, trays), `productApi`, `salesmanApi` (visits, targets), `offerApi`, `geoApi`, `attributesApi`, `dashboardApi`, `notificationsApi`. `services/apiService.js` re-exports them.
- `services/requestShare.js`: identical requests made at the same time (or within 10 s) by several components are sent once.
- Things to know: the server clamps list `limit` to 100. `apiRequest` turns a GET to a path containing `/products` into a POST, so avoid that substring in new GET paths. Express 5 gives `{}` as the body of every request.
- Auth: `services/authService.js` (token, roles). `hooks/useTokenMonitor.js` logs out when the token is removed.
- Offline: `services/offlineQueue.js` + `hooks/useOfflineSync.js` keep visits made without signal and send them later once.
- Cart: `services/cartService.js` (local, with change listeners that update the header and bottom-bar count).

## 8. App behaviour (install, notifications, offline)

- Add to Home Screen: `public/manifest.webmanifest`, apple tags in `layout.jsx` metadata, opaque home-screen icon; `RegisterServiceWorker` registers a small service worker that serves the offline page. In standalone mode the app starts at the dashboard.
- `InstallAppButton` shows only on phones and tablets (not in a computer's browser).
- `NotificationPermissionPrompt` asks for notification permission after install (card above the bottom bar, `.notify-ask` in `theme.css`); `utils/systemNotify.js` shows system alerts for new notifications.
- `OfflineVisitsBanner` appears in the layout when visits are queued.
- `useTokenMonitor` and the 24 h token: the logout cancels the old token on the server.

## 9. Do / Don't summary

Do
- Use tokens for colour, the `ui` components for controls, `createPortal` for menus inside pages.
- Add the page to every list in the checklist (section 2) or it will exist but not be reachable.
- Keep names identical between router key, menu id and role permission.
- Test light + dark, phone (`< 768`), tablet and desktop, and keyboard focus.
- Keep tap targets at least 44 px on phones; keep heading levels in order.

Don't
- Don't use native `select`, date inputs or `window.confirm` in new code.
- Don't hard-code hex colours for text, surface or borders.
- Don't call `fetch` directly from a page, or fetch all pages for a table.
- Don't remove `ThemeScript` or move theme setting into an effect.
- Don't run `next build` while `next dev` is running (it corrupts `.next`; remove `.next` and restart if it happens).
- Don't delete records; use inactive.

## 10. Commands

```
cd Frontend
npm run dev        # next dev (runs convert-images first)
npm run build      # next build
npm run lint       # eslint
npm test           # vitest run (utils, services; jsdom)
```
