# Stallion Eyewear — Frontend Production Readiness

> Verdict: **Yes — changes are needed before this is production-grade.** The UI/UX
> is in good shape after the revamp, but there are real gaps in configuration,
> logging, rendering/SEO, security, and resilience. This doc lists them by
> priority with concrete file references. Nothing here is cosmetic.
>
> Priorities: **P0** = blocker, fix before launch · **P1** = important, fix soon ·
> **P2** = hardening / nice-to-have.

---

## ✅ Resolved in this pass
- **P0-1 API host** — `apiService.getBaseURL()` fallback now `https://api.stallioneyewear.in/api`; dead `Home.constructFullUrl` (legacy host) removed.
- **P0-2 Logging** — `next.config.mjs` `compiler.removeConsole` strips `console.*` (keeps `error`/`warn`) in production builds, so verbose request/data logs never ship.
- **P0-3 Error boundary** — `src/components/ErrorBoundary.jsx` wraps the app in `layout.jsx` (recoverable fallback instead of white-screen). Monitor hook (`componentDidCatch`) is ready for Sentry.
- **P1-6 Zoom** — removed `maximumScale/userScalable:false` from the viewport (WCAG).
- **P1-7 (partial)** — API image host allowlisted in `next.config.images.remotePatterns` (full `next/image` migration still pending).
- **P1-4 (SEO)** — catch-all split into a server `page.jsx` (`generateMetadata`) + client `DynamicClient.jsx`; per-route title/description/OG/robots via `utils/pageMeta.js`.
- **P1-9 (tests/CI)** — Vitest + 17 passing tests (route helpers, page metadata, cart); `.github/workflows/ci.yml` runs lint → test → build.
- **P1-8 (split apiService)** — the 4,350-line monolith is now a 13-line barrel re-exporting `services/api/{client,authApi,geoApi,partnersApi,attributesApi,productApi,inventoryApi,salesmanApi}.js`. All 121 exports preserved; existing imports unchanged.
- **Security headers** — baseline headers added in `next.config.headers()` (CSP still to tune).

**Still open:** P1-5 (auth hardening — needs backend cookies), full `next/image` migration, connecting a real Sentry DSN, an enforced CSP, and the P2 items below.

---

## P0 — Blockers

### 1. Hardcoded legacy API host still in the code
- `src/services/apiService.js` → `getBaseURL()` falls back to `https://stallion.nishree.com/api`. The live API is now `https://api.stallioneyewear.in/api` (set in `.env.local`). **Fix the fallback** so a missing env var doesn't silently hit the dead host.
- `src/pages/Home.jsx` → `constructFullUrl()` hardcodes `https://stallion.nishree.com/uploads/products/...` and is **dead code** (the raw `productImage` is passed to `ProductCard`, which now derives the host from env). Delete `constructFullUrl` to avoid confusion/regressions.
- **Action:** one source of truth for the API origin + the uploads base (already in `ProductCard.getUploadBase()`); reuse it everywhere. Confirm `NEXT_PUBLIC_API_URL` is set in the **deploy** environment, not just `.env.local` (which is gitignored).

### 2. Verbose console logging shipping to production
- `apiService.js` logs request bodies, full error payloads, and per-record dumps (`getDistributors`, `getParties` print every row + emoji banners). This leaks data into the browser console and hurts performance.
- **Action:** gate all logging behind the existing `NEXT_PUBLIC_API_DEBUG` flag (or strip via build). Default off in prod. Remove the `console.log` dumps in `getParties`/`getDistributors`.

### 3. No error monitoring or error boundary
- A thrown render error currently white-screens the SPA (everything routes through the `[...slug]` catch-all → `App.jsx`). There is no React error boundary and no Sentry/equivalent.
- **Action:** add a top-level error boundary (fallback UI + "reload") around `App`, and wire an error/Performance monitor (Sentry, Highlight, etc.) reading a `NEXT_PUBLIC_SENTRY_DSN`.

---

## P1 — Important

### 4. The app is a client-only SPA inside Next.js → no SSR/SEO
- Everything is `'use client'`, rendered through one catch-all route (`app/[...slug]/page.jsx` → `pages/App.jsx` giant switch). Next's SSR/SSG/metadata-per-route benefits are unused. Product/collection pages have **no per-page `<title>`/meta/OG tags**, so SEO and social previews are weak for an e‑commerce/B2B site.
- **Action (incremental):** at minimum, generate per-route metadata (product/shop) and pre-render public pages. Longer term, migrate the public storefront (Home, Shop, Product, About) to real Next App-Router pages with server components; keep the dashboard as the client SPA.

### 5. Auth hardening
- Token lives in `localStorage` (`apiService`, `authService`) → readable by any XSS. `apiService` sends `credentials: 'include'` **and** a bearer token; pick one model. No refresh-token flow; expiry handling is ad‑hoc (redirect-on-401 with global flags on `window`).
- **Action:** prefer httpOnly cookies for the session if the backend supports it; otherwise document the XSS risk and add a strict CSP. Add token refresh or clear session-expiry UX. Consolidate the "logout on 401" logic (currently duplicated across `apiService`, `useTokenMonitor`).

### 6. Accessibility: zoom is disabled
- `app/layout.jsx` sets `viewport: { maximumScale: 1, userScalable: false }`. This blocks pinch-zoom — a WCAG failure.
- **Action:** remove `maximumScale`/`userScalable` so users can zoom.

### 7. Images aren't optimized
- Product/banner images use raw `<img>` (no `next/image`), no responsive `srcset`, no width/height on every image → layout shift + heavier payloads. `next.config.mjs` has no `images.remotePatterns` for the API host.
- **Action:** adopt `next/image` for product/hero imagery (or at least set explicit dimensions + `loading`/`fetchpriority`), and allowlist the API image host in `next.config`.

### 8. API client size & structure
- `apiService.js` is ~4,350 lines in one file with repeated request/normalize/“not found = []” patterns and heavy inline validation.
- **Action:** split by domain (auth, geo, products, orders, …) over a thin `request()` core; centralize the "treat 404/empty as []" and country-filter logic. Improves tree-shaking and maintainability. (See the `martin-fowler` skill.)

### 9. No automated tests or CI
- No unit/integration tests; lint isn't enforced in CI. Routing (the new `dashboardRoutes`/`productPath` helpers), cart, and price/format logic are exactly the kind of pure logic worth testing.
- **Action:** add a test runner (Vitest + Testing Library), cover the route helpers, cart service, and a couple of key flows; run `lint` + `build` + tests in CI on every PR. (See the `kent-c-dodds` skill.)

---

## P2 — Hardening / polish

- **Security headers / CSP:** add `next.config` headers (CSP, `X-Frame-Options`, `Referrer-Policy`, HSTS at the edge).
- **Env validation:** validate required `NEXT_PUBLIC_*` vars at startup; fail the build if the API URL is missing (no silent fallback).
- **Caching:** `cacheService` is in-memory per session; fine, but document TTLs and add cache-busting on mutations consistently.
- **Loading/empty/error states:** the revamp added the canonical states on public pages + shared CSS; **dashboard page JSX still needs a pass** to use them everywhere (currently mostly CSS-reskinned).
- **Dead code / consistency:** remove `Home.constructFullUrl`; the unused `.header-tooltip` path after the `Tooltip` migration; reconcile duplicate image-URL logic.
- **Analytics & consent:** no analytics/cookie consent wired — add if required for the target markets.
- **Bundle audit:** run `next build` + analyze; `jspdf`, `sharp` (build-only), and the icon set are the big ones to verify are code-split/server-only.
- **Reduced-motion / a11y:** global reduced-motion net is in place (`styles/animations.css`); keep verifying contrast on the dark indigo surfaces.

---

## Quick "is it deployable today?" checklist
- [ ] `NEXT_PUBLIC_API_URL` set in the deploy env (prod points at `https://api.stallioneyewear.in/api`)
- [x] API host fallback fixed; `Home.constructFullUrl` removed
- [x] Verbose logs stripped in prod (`removeConsole`); `NEXT_PUBLIC_API_DEBUG=false` by default
- [x] Error boundary wired (monitoring/Sentry DSN still to connect)
- [ ] `next build` passes clean (run with `next dev` stopped)
- [ ] Per-route metadata for public pages (at least title/description/OG)
- [x] Viewport zoom re-enabled
- [x] Image host allowlisted in `next.config`

---

### Notes
This is an assessment, not a set of applied changes — it documents what's needed.
The P0 items are small and I can apply them on request (API fallback + dead-code
removal + log gating + error boundary are an afternoon's work). The P1 SSR/SEO and
auth items are larger and should be planned deliberately.
