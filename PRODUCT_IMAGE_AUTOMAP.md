# Product Image Auto-Mapping by Model No.

**Goal:** When a user uploads product images whose **file name matches a product's
`model_no`** (e.g. `RB2140.jpg` → product with `model_no = "RB2140"`), the system
should **automatically attach** each image to the matching product — no manual
"pick a product" step.

---

## ✅ STATUS: IMPLEMENTED

Decisions taken:
- **Backend matching** (DB-side), **integrated into the existing**
  `POST /products/image-upload` route — **no new route**. When the request has
  **no `product_id`**, the backend auto-maps; with a `product_id` it behaves
  exactly as before.
- **Multiple images per product:** a short trailing `-n` / `_n` / `(n)` suffix is
  stripped, so `MAS-MYSTIC-C2.jpg`, `MAS-MYSTIC-C2-1.jpg`, `MAS-MYSTIC-C2_2.png`
  all attach to model_no `MAS-MYSTIC-C2`. Verified the model's own `-C2` is
  **not** stripped (only a separator + 1–2 *pure digits* is treated as a suffix).
- **Duplicate model_no** (same model on several products/colours): the image is
  attached to **all** of them.
- **Unmatched** files are reported back (`unmatched[]`) and remain in the Media
  Gallery; nothing is silently dropped.

Response shape (no `product_id`):
`{ message, data: fileInfos, attached: [{file, model_no, product_ids}], unmatched: [names], summary: {attached, unmatched, productsUpdated} }`

Code:
- Backend (`backend` branch): `productController.uploadProductImage` no-`product_id`
  branch + (no route change).
- Frontend (`main`): `DashboardProducts.handleImageUpload` surfaces the summary
  and refreshes the product list; the Media-Gallery upload (no product picked) is
  the auto-map entry point.

---

## 1. Current behaviour (verified)

### Frontend — `DashboardProducts.jsx`
- Tabs: `Products`, `Media Gallery`, `Unuploaded Media Gallery`.
- `handleImageUpload(e)` uploads the selected files via
  `uploadProductImage(files, targetProductId)`.
- It **requires a chosen product** (`imageTargetProduct`) unless you're in the
  Media Gallery tab (then images are uploaded "orphaned", attached to nothing).
- So today, attaching = manual: pick the product, then upload.

### API — `services/api/productApi.js`
- `uploadProductImage(files, productId)` → `POST /products/image-upload`
  (multipart, field `product_image`, plus `product_id` in the body).
- `getAllUploads()` → `GET /products/images/all` (lists uploaded files).

### Backend — `productController.uploadProductImage` (`origin/backend`)
- Route: `POST /products/image-upload` (auth + `isProductManager`,
  multer middleware `productImageUpload`).
- Behaviour:
  - **With `product_id`** → appends each uploaded file's `path` to that
    product's `image_urls`, flips `status: draft → active`, returns the product.
  - **Without `product_id`** → just stores the files and returns `fileInfos`
    (attached to **nothing**).
  - **No filename / model_no matching exists anywhere.**

### Multer middleware — `constants/multer.js` (`processAndSaveImage('product')`)
- Compresses to webp-ish and **renames** the stored file:
  `RB2140.jpg` → `RB2140-1718900000000.jpg` (original base name **+ timestamp**).
- Builds `req.fileInfos = [{ filename, path, size, mimetype, originalName }]`.
  - **`originalName`** = exactly what the user named the file (`RB2140.jpg`). ✅
    This is the field we match against `model_no`.
  - `path` = absolute server path of the stored (timestamped) file.
  - `filename` = `RB2140-1718900000000.jpg`.

**Conclusion:** the original filename survives on the server as
`fileInfos[].originalName`, so matching is feasible on **either** side.

---

## 2. Matching rules (agreed semantics)

For each uploaded file:
1. `base = filenameWithoutExtension(originalName)` → strip `.jpg/.png/.webp/...`.
2. Normalise: `trim()`, compare **case-insensitively** against `model_no`.
3. **Multiple images per product** (e.g. `RB2140.jpg`, `RB2140-1.jpg`,
   `RB2140_2.png`): strip a trailing `-<n>` / `_<n>` / ` (n)` suffix before
   matching, so all variants map to `RB2140`. (Confirm this rule — see Q1.)
4. **Matched** → append the stored `path` to that product's `image_urls`,
   set `status: active` if it was `draft`.
5. **Unmatched** → do **not** silently drop; report the filename back so the user
   can fix the name or attach manually. (Keep the file as an orphan in Media
   Gallery, or delete it — see Q2.)
6. **Duplicate model_no** (same `model_no` on >1 product, e.g. different
   `color_code_id`): ambiguous — attach to all, attach to none, or first match?
   (See Q3.)

---

## 3. Options

### Option A — Frontend-only matching (no backend change)
1. Load **all** `{ product_id, model_no }` (a light all-products fetch).
2. For each selected file, compute the normalised base name and find the product.
3. Group files by matched `product_id`; call
   `uploadProductImage(groupFiles, productId)` per product (existing endpoint).
4. Show a summary: *N attached, M unmatched (list names)*.

- **Pros:** no backend deploy; uses existing endpoints.
- **Cons:** the browser must hold the full product list just for matching (works
  against the new 20/page direction); matching logic lives in the client; more
  requests (one upload call per product).

### Option B — Backend auto-map (recommended)
Add server-side matching where the DB already has every `model_no`.

- **New route** `POST /products/image-upload/auto-map` (or a flag
  `auto_map=true` on the existing `/products/image-upload`).
- For each `fileInfo`:
  - `base = stripSuffix(basename(originalName, ext))`.
  - `product = Product.findOne({ where: model_no = base (case-insensitive) })`.
  - If found → push `path` into `image_urls`, set `status` active, save, audit-log.
  - Collect `{ originalName, matched: bool, model_no, product_id }`.
- **Response:** `{ attached: [...], unmatched: [filenames], summary: {n, m} }`.

- **Pros:** matches against the DB (no need to load all products in the browser);
  single request; scales; original filename already available as `originalName`.
- **Cons:** requires a backend change + deploy (separate `backend` branch).

**Recommendation: Option B.** It's the correct place for the match (DB-side),
keeps the frontend light, and the middleware already preserves `originalName`.

---

## 4. Proposed changes (Option B)

### Backend (`origin/backend`)
1. `constants/multer.js` — no change needed (`originalName` already captured).
2. `productController.js` — add `uploadProductImageAutoMap(req, res)`:
   - Iterate `req.fileInfos`, normalise `originalName`, match `model_no`
     (case-insensitive), append `path` to `image_urls`, set active, audit-log.
   - Return per-file matched/unmatched summary.
3. `routes/product.js` — `POST /products/image-upload/auto-map`
   (`authenticateToken`, `isProductManager`, `productImageUpload`,
   `productController.uploadProductImageAutoMap`).

### Frontend (`Frontend`)
1. `services/api/productApi.js` — `uploadProductImagesAutoMap(files)` →
   `POST /products/image-upload/auto-map` (multipart `product_image[]`, no
   `product_id`). Returns the summary.
2. `DashboardProducts.jsx` — a **"Auto-map by model no."** upload button
   (likely in the *Unuploaded Media Gallery* / Media Gallery tab):
   - multi-file picker (`accept="image/*"`, `multiple`),
   - calls `uploadProductImagesAutoMap`,
   - shows a toast/summary: *“12 images attached, 2 unmatched: X.jpg, Y.png”*,
   - refreshes the product list.

---

## 5. Open questions (need confirmation before coding)

- **Q1.** Multiple images per product — should `RB2140-1.jpg`, `RB2140_2.png`
  all attach to `RB2140`? (Proposed: yes, strip trailing `-<n>`/`_<n>`/`(n)`.)
- **Q2.** Unmatched files — keep them as orphans in Media Gallery, or discard?
- **Q3.** If a `model_no` exists on multiple products (different colours),
  attach to **all**, the **first**, or **none + flag**?
- **Q4.** Should auto-map be a **new button**, or replace the current
  manual-pick upload flow entirely?
- **Q5.** Is matching **exact** (`RB2140`) or also **prefix/contains**? (Proposed:
  exact, case-insensitive, after suffix-strip.)

---

*Once Q1–Q5 are answered (and Option A vs B confirmed), implementation is
straightforward — the backend already exposes the original filename, which is the
only piece that makes this possible.*
