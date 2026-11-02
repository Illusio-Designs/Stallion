# Stallion: what changed, July to early November 2026

This list covers the wholesale app (Stallion B2B) from 22 July 2026 (the first saved version) to 2 November 2026.
It is grouped by area so you can find a change quickly. Each line says what changed for the people using the app.

**Not in this list:** the retail store (D2C) and the Tally integration.

**Marked "branch only":** finished and tested, but not yet on the live site (`main`). See section 11.

---

## 1. Sign in and security

- Every number must pass a real OTP. The old bypass is removed, and the OTP proof must belong to the number that is signing in.
- OTP resend is reliable (it sends a fresh code if the first try fails). Send, resend and wrong-attempt limits were added.
- Logout now cancels the old token, so a copied login stops working. A refreshed login lasts 24 hours.
- The whole site needs sign-in. Signed-out visitors land on the login page; only the privacy policy stays public. The sign-in page is the front page (`/`), and people already signed in go straight to the dashboard.
- Login page redone: number and code in one card, specific error messages, OTP autofill, "Change number", return to the page you came from.
- Several security holes closed: role checks on write routes, salesman login takeover, source files that were publicly downloadable, a phone change that only an admin may do, and write routes that needed a login.
- Salesman KYC documents (PAN, Aadhar, cancelled cheque, photo) are private: only an admin or sales manager can open them.
- Party PAN, GSTIN and credit terms are visible and editable only to managers and the party itself.
- A person with several roles now gets the access of all of them, not just the first one.
- Users: an admin and the main superadmin account cannot be deleted by mistake; deleting a user cleans safe links and hands their records to admin.
- Login problems fixed (see also the SQL in `docs/sql/fix_salesman_logins.sql`):
  - A salesman or distributor who is registered but whose login user is missing, switched off, or saved with the number in another form (+91, 91, plain digits) can now sign in.
  - A party's login is created and linked on first sign-in if it was missing.
  - "User not found" no longer shows for unrelated errors; the real reason is shown.
- Creating a party, salesman or distributor no longer leaves a half-made login: the login and the record are saved together or not at all. *(duplicate and login fix, 2 Nov)*
- Roles: `hasRole` accepts one role or a list, which fixed "allowedRoles.map is not a function" for salesman add party, expenses and orders.

## 2. Orders and shipping

- **Order rules:** whole positive quantities only, duplicate lines merged, offers valid until the end of the day, order numbers always unique, plain error messages with the right status.
- **Stock safety:** cancel and delete lock the order so two requests cannot return stock twice; a cancelled order cannot be reopened; tray add/remove changes stock in one transaction.
- **Split shipments:** an order can be sent in parts. Held tray pieces, "Hold by tray" on partly sent orders, trays-returned and complete actions, cancel reason, and a new order panel.
- **Cancel rules:** only the unsent part of a partly shipped order can be cancelled; tray parcels cannot be cancelled while in transit, and received frames go back to the warehouse.
- Orders get the distributor who works in the party's state (visit, event, WhatsApp and party orders).
- A salesman's orders use the logged-in salesman and only his own parties. Event orders can use any party; visit and WhatsApp orders stay in his working states.
- The Orders page: slim numbers row, one-line search and filters, phone cards, no unused Create Order form.
- Order view and PDF show the address on separate lines (address, city, state, country, pincode).
- Offers: the chosen offer is sent with the order; offers with no discount are hidden in the cart; clearer BOGO wording.

## 3. Sample trays

- Tray return tasks: salesman tasks and notifications, in transit and received steps, a bell, and an order panel list.
- A salesman sees only his own trays, read-only. A tray follows its salesman (inactive when empty, back on when he rejoins). Frames can be moved to the warehouse or another tray.
- Tray products are looked up by product id, so rows no longer show N/A.
- The Assign products screen was redesigned. The picker lists only frames that have warehouse stock, so out-of-stock frames no longer show.
- Fixed "Cannot destructure tray_id of req.body".

## 4. Parties

- **Location:** the shop location comes from the Google address you pick. The first visit saves the exact spot. The visit radius is 50 m (150 m the first time, plus a signal allowance). Parties without a location show in a "No location" tab and are fixed through Edit party.
- **Address form:** Google address suggestions while typing; pincode, country, state and city fill in and are added to the lists if missing; the Address box keeps only the street line; the suggestion list is never hidden behind the panel footer.
- **Search:** any word order, part words, no spaces, one wrong letter, ranked results ("rajopti" finds "Raj Optical"). Results show which field matched.
- **Table:** salesman names as pills, city and state names filled, parties without their own salesman show the salesmen of their state, search and filters, phone cards.
- **Working states:** a salesman only sees and adds parties in his working states; any salesman of that state can use the party.
- **Bulk upload:** Download Sample button, matching by GST, then PAN, then phone and email, case-insensitive state and city names, missing city or state created, active by default, bad rows skipped and saved values kept.
- **Never deleted:** a party is made inactive. Delete party is allowed only for a party added by mistake that has no orders and no visits. *(2 Nov)*
- **Duplicates:** a second party with the same phone is refused, and a double tap can no longer create two. *(2 Nov)*

## 5. Salesmen, visits and targets

- A salesman is never deleted; he is made inactive. Atomic creation, empty IDs treated as blank, unique phone/email not rewritten unless changed, uploaded KYC documents shown when editing.
- **Visit report:** order quantity shown correctly, lists capped at 20 rows, check-in party and date cannot be changed after saving, GPS required for salesman check-ins, offline visits saved on the phone and sent later (once only).
- **Visit form:** time checks, next visit date, in/out times removed (the server stamps the time), "Add visit" shortcut on the salesman home and on phones.
- **Salesman home:** target ring (cancelled orders still count), tray tasks only when there are some, recent orders, and a Find a party search with an edit icon.
- **Targets:** count the whole last day and respect the start date.
- **Expenses:** types food, travel (mode), city tour, toll (message), hotel and other; salesman adds, only admin reviews; approved expenses are locked; bill upload fixed.

## 6. Products, shop and offers

- **Product card:** price first, an "N% off MRP" pill, one status badge under the photo (In stock, Only N left, Preorder, Sold out) and "Add · ₹total". Nothing covers the picture.
- **Product details:** colour chips with stock, add to cart beside the quantity, a sticky bar on phones, spec tiles, other frames.
- **Shop:** search, quick chips, a Refine panel, 2/3/4 column cards; lists only frames that are in stock (server filter); shows frames above 10,000.
- **Preorder (was "Upcoming"):** no stock is kept and any quantity can be ordered. The product form has one Status (Draft, Active, Inactive) instead of Status plus Availability.
- **Offers in the shop:** products touched by an active offer get an offer badge, a stronger outline and an "On offer" filter chip. One offer per order still applies (flat, product or BOGO).
- **Stock:** total = warehouse + tray everywhere; every stock change is recorded in a stock history panel.
- **Bulk upload:** total stock recalculated, quantities validated, clearer result message, Download Sample button.
- **Media gallery:** unuploaded images paged from the server, assigned images detected correctly.
- **Active/Inactive** switch for events, trays and products; inactive items are hidden from pickers and the shop. Switching a country, state or city off hides everything under it, after a confirm.

## 7. Dashboard, reports and admin

- Dashboard home for every role: "Needs attention" first for the office, expense and tray alerts, compact numbers, chart beside latest orders.
- **Sales by State** report (period, change against the previous period, rank and share per row); a salesman sees only his own.
- A global search box finds parties, orders and products.
- Analytics reports return names and coordinates in one call.
- Manage page: master-data tabs that wrap on tablets and scroll cleanly on phones.
- Roles: the menu follows the role (sales manager sees Party and Orders).
- Nothing is deleted: delete routes refuse and delete buttons are gone; use inactive instead.
- Server log cleaned: one short line per request, phone numbers masked.

## 8. Look and feel

- **Black-and-white redesign** with Bricolage Grotesque and Figtree fonts, applied to every page: dashboard, orders, parties, salesmen, distributors, office team, trays, events, offers, products, reports, support, settings, storefront and login.
- **Compact density:** smaller controls, text and cards; Hugeicons for all icons; the rupee icon instead of the dollar icon.
- **Phones:** one card per table row; bottom bar (Dashboard, Shop, Cart and more) the same in the shop and the dashboard; form panels follow the visible area above the keyboard so Save stays visible.
- **Tablets:** tablet layout, sidebar toggle with tooltips, cart button with count in the header.
- **Our own controls everywhere:** own calendar and date-time pickers, own dropdowns instead of native ones, gooey search, gooey toasts with a title and description, skeleton loading placeholders.
- **Light, dark and system theme:** a switch with no flash on load, applied to all pages.
- **Install as an app:** home-screen app starts at the dashboard, has an offline page, an iPhone tag and an opaque icon; "Install app" only shows on phones and tablets; the app asks for notification permission after install and shows system alerts for new notifications.

## 9. Speed

- Whole lists are loaded in parallel and identical requests are shared between components.
- The dashboard summary sends the two counts the home screen needs instead of loading every party and tray.
- The Dashboard and Orders pages no longer fetch what is not on screen yet; the toast library loads after the page is up (first load JavaScript 264 kB to 198 kB).
- Backend: two missing database indexes, a week of browser caching for product photos, gzip compression for all responses, product and order lists count without extra joins, order lookups run together.

## 10. Housekeeping

- Fixed searches that were ignored (a filter was dropped on some lists).
- Pagination and sorting helpers; a valid page is kept after filters change.
- Accessibility fixes (labels, contrast, heading order, hit areas) and per-page titles.
- Unknown-column and start-up fixes: `users.tokens_valid_from`, `parties.location_address` created before any party query.
- Deploy pipeline: a few re-triggers after FTP time-outs.

## 11. Branch only (not yet on the live site)

- One shared Add/Edit party form for the Parties page and the Cart.
- The visit form's party dropdown has "+ Add New Party" inside it, and an Edit party button when a party is picked.
- SQL to create missing salesman login users: `docs/sql/fix_salesman_logins.sql`.

## 12. Known limits

- Nothing here was tested on the live MySQL data; checks ran on mock data and an in-memory database.
- Lists still load every page before showing a table on some screens; moving them to page-by-page loading is in progress and is not part of this list yet.
