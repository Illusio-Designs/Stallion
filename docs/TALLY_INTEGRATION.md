# Tally integration for the wholesale (B2B) app

This document describes how to connect the Stallion wholesale app (parties, products and stock, orders) to **Tally**, so that:

1. **Party data sync**: parties in Stallion and customer ledgers in Tally stay the same.
2. **Inventory sync**: stock items and stock quantities in Tally and Stallion agree.
3. **Order sync**: every order placed in Stallion appears in Tally without re-typing.
4. **Sales invoice**: the invoice raised in Tally comes back to Stallion, is attached to the order, and can be opened or downloaded from the app.

It covers the retail (B2C) store only where noted at the end. The retail store has its own data and is out of scope here.

Everything below is a design to build from. The Tally XML shown in the appendix is written from the published Tally integration format and **must be tested against your Tally version in a sample company before it is relied on** (see section 12).

---

## 1. What Stallion has today (what we map from)

Read from the models in `Backendjs/lib/models`:

| Stallion | Columns that matter for Tally |
|---|---|
| `parties` | `party_id`, `party_name`, `trade_name`, `contact_person`, `phone`, `email`, `address`, `billing_address`, `billing_same_as_shipping`, `state_id`, `city_id`, `pincode`, `gstin`, `pan`, `credit_days`, `is_active`, `salesman_id`, `distributor_id` |
| `products` | `product_id`, `model_no`, `brand_id`, `mrp`, `whp`, `size_mm`, `warehouse_qty`, `tray_qty`, `total_qty`, `status`, `is_active` plus shape, frame, lens and colour lookups |
| `orders` | `order_id`, `order_number`, `order_date`, `order_type`, `party_id`, `salesman_id`, `order_status`, `order_items` (JSON list of lines), `subtotal`, `discount_total`, `applied_offer`, `order_total`, `order_notes`, courier fields, `dispatched_at`, `delivered_at`, `cancelled_at` |
| `order_operation`, `order_shipment` | which quantity came from the warehouse or from trays, and each shipment's courier, tracking number and quantity (partial dispatches) |
| `stock_movements` | stock history lines (`kind`: order, cancel, tray, sheet, manual) |
| `states`, `cities` | names to fill Tally's State and place of supply |

Gaps Tally needs and Stallion does not hold yet: **HSN code, GST rate and unit per product**, a **Tally ledger name and ID per party**, and a place to store the **invoice number, date, amounts and PDF**. Section 5 adds them.

Important: trays are physical sample stock held by salesmen. `tray_qty` is not warehouse stock and must not be sent to Tally as if it were.

---

## 2. How Tally can be reached

- Tally (TallyPrime or Tally.ERP 9) runs on a Windows PC or server. With **Tally's HTTP server on** (Gateway of Tally, F1 Help, Settings, Connectivity, Client/Server configuration), it accepts **XML requests over HTTP** on a port (default **9000**) and returns XML. It can both **import** (create or alter masters and vouchers) and **export** (masters, vouchers, reports).
- Newer TallyPrime releases also describe a JSON interface. XML is the safest assumption and works on every version; check your release notes before choosing JSON.
- Tally processes **one request at a time**, the **company must be open**, and the HTTP server is normally reachable only inside the office network.
- Therefore the Stallion server (in the cloud) **cannot call Tally directly**. The standard answer is a small **connector program** that runs next to Tally and talks outward to Stallion (section 3).

---

## 3. Architecture

```
 Stallion app (browser) ─▶ Stallion API (Backendjs)  ◀── HTTPS, API key ──┐
                               │                                           │
                          tally_outbox (jobs)  ◀────────────────┐          │
                          tally_state (cursors)                  │          │
                          tally_invoices                         │   Tally connector
                                                                 └── (Windows service, same
                                                                      network as Tally)
                                                                       │ XML over HTTP :9000
                                                                       ▼
                                                                    TallyPrime (company open)
```

Rules:

1. **Stallion never calls Tally.** It writes jobs into an outbox. The connector polls Stallion every 30 to 60 seconds over HTTPS (outbound only, no open ports at the office), runs each job against Tally, and reports the result.
2. **The connector also reads from Tally** (changed ledgers, stock balances, new sales vouchers) and posts the results to Stallion.
3. Every job and every record carries an **idempotency key** so a retry can never create a duplicate (section 8).
4. Nothing is deleted on either side. Removal means inactive in Stallion and "alter" or a flag in Tally.
5. If Tally is closed or unreachable the jobs simply wait. Stallion shows the queue and the last successful sync (section 7).

Alternative (not recommended): expose Tally to the internet or a VPN and let Stallion call it. This puts an unauthenticated accounting database on a public address and breaks whenever the PC sleeps.

---

## 4. Who owns which data (source of truth)

Decide this once; it avoids every "who overwrote whom" bug.

| Data | Owner | Direction | Notes |
|---|---|---|---|
| Party master (name, address, GSTIN, credit days) | **Stallion creates, Tally keeps accounting truth** | Stallion → Tally on create and edit; Tally → Stallion for GSTIN, credit period and opening balance changes made by accounts | A party added in Stallion becomes a Sundry Debtor ledger. A ledger created only in Tally appears in Stallion as an **unlinked candidate** for review, never auto-created. |
| Product master (model, HSN, GST rate, unit, rate) | **Stallion** | Stallion → Tally | Created as Stock Items. Rate = WHP. |
| Stock quantity (warehouse) | **Tally** | Tally → Stallion | `warehouse_qty` is refreshed from Tally's closing balance. Stallion's own reductions (orders, cancels) are applied locally at once, then corrected by the next Tally snapshot. |
| Tray stock | **Stallion only** | none | Optional: a "Sample trays" godown in Tally fed by stock journals (phase 3). |
| Orders | **Stallion** | Stallion → Tally | Sent as **Sales Order** vouchers. |
| Sales invoice (number, date, tax, totals) | **Tally** | Tally → Stallion | Read only in Stallion. |
| Receipts, ledgers balances | Tally | optional later | Outstanding per party can be shown in Stallion in a later phase. |

---

## 5. Changes in Stallion (additive only, never destructive)

Use `ensureColumn` and new tables, the same way the app already evolves its schema.

New columns:

| Table | Column | Use |
|---|---|---|
| `parties` | `tally_ledger_name` VARCHAR(255), `tally_guid` VARCHAR(64), `tally_synced_at` DATETIME | link to the ledger |
| `products` | `hsn_code` VARCHAR(16), `gst_rate` DECIMAL(5,2), `unit` VARCHAR(10) default `Nos`, `tally_item_name` VARCHAR(255), `tally_guid`, `tally_synced_at` | stock item link and tax data |
| `orders` | `tally_voucher_no`, `tally_voucher_guid`, `tally_sync_status` (not_sent, queued, sent, failed, cancelled), `tally_synced_at`, `tally_invoice_no`, `tally_invoice_date`, `tally_invoice_amount` | order and invoice link |

New tables:

- **`tally_outbox`**: `id`, `entity` (party, product, order), `entity_id`, `action` (create, update, cancel), `payload` JSON, `idempotency_key` UNIQUE, `status` (pending, sent, failed, dead), `attempts`, `last_error`, `remote_ref`, `created_at`, `sent_at`.
- **`tally_state`**: one row per feed (`ledgers`, `stock`, `sales_vouchers`) with the last Tally **alter id** or date already read, so each poll only fetches what changed.
- **`tally_invoices`**: `id`, `order_id` nullable, `tally_guid` UNIQUE, `invoice_no`, `invoice_date`, `party_ledger`, `gstin`, `place_of_supply`, `taxable_amount`, `cgst`, `sgst`, `igst`, `round_off`, `total`, `irn`, `ack_no`, `qr_text` (if e-invoicing is on), `lines` JSON (item, hsn, qty, rate, amount, gst rate), `pdf_path` nullable, `raw_xml` (kept for audit), `created_at`.
- **`tally_link_review`**: ledgers found in Tally that match no Stallion party (ledger name, GSTIN, phone), with a status: new, linked, ignored.

Hook points (small, guarded, never able to block an order): after a party is created or edited, after a product is created or edited, after an order is created, approved or cancelled, call `enqueueTally(entity, id, action)`, which writes an outbox row inside a try/catch.

---

## 6. The four flows

### 6.1 Party sync

**Stallion → Tally**

- Trigger: party created, edited, or made active or inactive.
- The connector imports a **Ledger** under the group **Sundry Debtors**:
  - Name: `party_name` (if that name already exists for a different party, append the city, for example `Raj Optical (Pune)`; Tally ledger names must be unique).
  - Mailing details: address, state (from `states`), pincode, country India.
  - GST: registration type (Regular when `gstin` exists, Unregistered otherwise), `gstin`, party GSTIN, PAN.
  - Credit period: `credit_days`.
  - Phone, email, contact person.
- The connector writes back the ledger name and GUID, and Stallion saves them in `tally_ledger_name` and `tally_guid`.
- Inactive parties: set the ledger's "alter" with a note or leave it active in Tally. Do not delete.

**Tally → Stallion**

- Each poll exports Sundry Debtor ledgers changed since the stored alter id.
- Matching order: `tally_guid`, then `gstin`, then normalised phone, then exact name. A match updates `gstin`, `pan`, `credit_days` and address only if Tally's value is non-empty and the Stallion field is empty or the owner chose "Tally wins" in settings.
- No match: add a row to `tally_link_review`. An admin links it to an existing party or creates a new one from it. Never auto-create (it would flood the party list with ledgers such as cash customers).

### 6.2 Inventory sync

**Stallion → Tally (masters)**

- Each product becomes a **Stock Item**: name `model_no`, unit `Nos`, HSN, GST rate, standard selling rate = `whp`, under a stock group named after the brand (so reports group by brand).
- Created when a product is created or when first synced; later edits update the same item. Name changes keep the GUID so history is kept.

**Tally → Stallion (quantities)**

- Every 5 to 15 minutes (configurable) the connector exports **closing balance by godown** for all stock items.
- Stallion sets `warehouse_qty` from the chosen godown (default `Main Location`; setting: which godown or godowns count as warehouse) and recomputes `total_qty`. `tray_qty` is never touched.
- Each change writes a `stock_movements` line with `kind = 'tally'` and the voucher or snapshot time in `note`, so the history screen explains the change.
- **Race rule**: when Stallion lowers stock for an order, the local number drops at once. The next Tally snapshot may still show the old quantity until the Sales Order or invoice is booked. To avoid a flicker, a snapshot value is ignored for a product that has an open outbox job (an order not yet booked in Tally) and is applied after that job completes.
- Negative or missing items: report them in the sync log, never write a negative `warehouse_qty`.

**Optional, phase 3**: tray movements to a "Sample trays" godown through Stock Journal vouchers so Tally also shows where physical sample stock sits.

### 6.3 Order sync

- Trigger: order created, or moved to the status that means "confirmed" (a setting; default: when the order is created in Stallion).
- The connector imports a **Sales Order** voucher:
  - Voucher number: the Stallion `order_number`. This is also the **reference** and the order number used for tracking against later invoices.
  - Date: `order_date` (India date).
  - Party ledger: `tally_ledger_name`. If the party has no ledger yet, the party job is run first (jobs are ordered by `created_at` and a dependent job waits).
  - Lines from `order_items`: stock item (`tally_item_name`), quantity, rate (`whp` after line discounts), amount, and **order due date** (setting, default 7 days).
  - Discounts: the order's `discount_total` is shown either by reducing the line rates (default, so the totals always match) or as a discount line, per setting. Totals in Tally must equal `order_total` to the rupee; the connector checks this and marks the job failed with a clear message if not.
  - Narration: salesman name, order type, and `order_notes`.
- Result: voucher GUID and number stored in `tally_voucher_guid` and `tally_voucher_no`, `tally_sync_status = sent`.
- **Edit**: while the order is still pending, an edit re-sends with action alter on the same voucher (same idempotency key family, new version number).
- **Cancel**: sends a cancel. For a Sales Order this cancels the voucher in Tally; if an invoice already exists for it, the job fails with "invoice already raised, cancel it in Tally" and the order shows an alert for accounts. Stallion's own cancel still happens.
- **Partial dispatch**: Stallion's shipments are informational. Accounts decide in Tally whether to raise one invoice per shipment or one in the end; the invoice feed (6.4) picks up whatever they raise and attaches all of them to the order.

### 6.4 Sales invoice back to Stallion

Who raises the invoice? Two supported modes (setting):

- **Manual in Tally (default, recommended first)**: accounts convert the Sales Order to a **Sales** voucher in Tally as they always do.
- **Automatic**: when Stallion marks an order dispatched, the connector creates the **Sales** voucher against the order (order tracking number equals the Stallion order number), which fixes the invoice number and tax in Tally. Needs the GST and HSN data to be complete, so enable this after phase 2.

Reading invoices back (both modes):

- Each poll exports **Sales vouchers** changed since the stored alter id, including: GUID, voucher number (the invoice number), date, party ledger, GSTIN, place of supply, inventory lines with HSN, GST ledgers (CGST, SGST, IGST), round off, total, e-invoice IRN, acknowledgement number and QR if present, and the **order reference** (order number).
- Matching to a Stallion order: by order reference equal to `order_number`, otherwise by party and total and date within a window; unmatched invoices are still stored in `tally_invoices` with `order_id` empty so they can be linked by hand.
- Stallion then sets the order's `tally_invoice_no`, `tally_invoice_date`, `tally_invoice_amount`, and stores a `tally_invoices` row. Cancelled vouchers in Tally mark the invoice cancelled in Stallion (the row stays).
- **PDF**: Stallion renders the invoice PDF **from the stored data** with the same PDF tool it already uses for orders (`Frontend/src/utils/orderPdf.js` style), so the layout is ours and no Tally printing is needed. Optional: the connector can also upload Tally's own printed PDF if the company has a print-to-PDF setup (more fragile, so it is an extra, not the base).
- Where users see it: an **Invoice** chip and a **Download invoice** button on the order detail panel and the order row, and the same on the party's order list. Salesmen see only their own parties' invoices (existing scoping rules apply).

---

## 7. Stallion API for the connector

All routes live under `/api/tally`, accept only a **service API key** (header `X-Tally-Key`, stored hashed; not a user JWT) plus an HMAC signature of the body, and are rate limited. Admin screens use the normal login and roles (`admin` and a new `accounts_manager` role).

Connector calls (outbound from the office):

| Method and path | Purpose |
|---|---|
| `GET /api/tally/health` | key check, server time, settings version |
| `GET /api/tally/outbox?limit=20` | next pending jobs in order (locks them for a few minutes) |
| `POST /api/tally/outbox/:id/result` | `{status: sent\|failed, remote_ref, voucher_no, error}` |
| `POST /api/tally/inbound/ledgers` | batch of changed ledgers (6.1) |
| `POST /api/tally/inbound/stock` | stock balances per item and godown (6.2) |
| `POST /api/tally/inbound/invoices` | batch of Sales vouchers (6.4) |
| `GET /api/tally/state` and `PUT /api/tally/state/:feed` | read and save the cursors |

Admin screens (login required):

| Path | Purpose |
|---|---|
| Settings, Integrations, Tally | connection status (last poll, last success per flow), godown choice, due-days default, who wins on conflicts, invoice mode, API key (show once, rotate) |
| Tally queue | list of jobs with status, error text, **Retry**, **Mark dead**, **Sync now** per party, product or order |
| Unlinked ledgers | review list from `tally_link_review` |
| Order detail | Tally status line (queued, sent with voucher no., invoice no.) |

---

## 8. Idempotency, ordering and failure handling

- **Idempotency key** per job: `entity:id:action:version` (for example `order:<order_id>:create:1`). The outbox key is UNIQUE, so enqueueing twice does nothing. In Tally the connector first checks whether a voucher with that **remote ID** (we put the Stallion id in the voucher's remote ID field) already exists, and treats it as success.
- **Order of jobs**: party before its orders, products before orders that use them. A job whose dependency is not synced yet returns to pending (not failed).
- **Retries**: failed jobs retry with 1, 5, 15 and 60 minutes back-off, then become `dead` and need a person. The error text from Tally (for example "Ledger not found" or "Stock item not found") is shown as is.
- **Tally closed**: the connector's health check fails, no jobs are taken, nothing is lost.
- **Duplicate prevention in reads**: invoice and ledger inbound rows are upserted on the Tally GUID.
- **Clock and time zone**: India time (UTC+05:30) for voucher dates; Tally's date format is `YYYYMMDD`.
- **Financial year**: voucher numbers follow Tally's own series; Stallion never invents invoice numbers.
- **Everything logged**: each job keeps the request and the response (trimmed) for audit.

---

## 9. The connector (what to build)

- A small **Windows service** (Node.js or .NET) installed on the PC that runs Tally, started with Windows and restarted on failure.
- Config file: Stallion API URL, API key, Tally URL (`http://localhost:9000`), company name, poll seconds, godown names.
- Loop:
  1. `GET /health`; check Tally answers (a trivial export). If not, wait.
  2. Fetch jobs, run them **one at a time** against Tally, post each result.
  3. Run the read feeds on their own timers: ledgers (every minute), sales vouchers (every minute), stock (every 5 to 15 minutes), using the saved cursors.
- Errors from Tally come back as XML with `LINEERROR` or an `ERRORS` count; the connector turns them into readable messages.
- Never logs the API key. Updates itself or shows a clear "new version available" message.
- Works if the PC sleeps: it catches up on wake because the cursors and the outbox hold the state.

---

## 10. Settings and rules to confirm with the accounts team

1. Which godown or godowns are the warehouse?
2. Do orders go to Tally as **Sales Order** vouchers (recommended) or straight as **Sales** invoices?
3. Who raises the invoice: accounts manually, or automatic on dispatch?
4. Is **GST e-invoicing** on? If yes the invoice feed carries the IRN, ack number and QR.
5. How are discounts and offers booked: lower rates (default) or a discount ledger?
6. When Tally and Stallion disagree on a party's GSTIN or credit days, who wins?
7. One Tally company or several (one per firm)? The design supports several; the connector then needs one config block per company and Stallion needs a company field on the order.
8. Which Tally product and release (TallyPrime or ERP 9, and the version), and is the licence single or multi user? Single-user licences also have limits on parallel access.

---

## 11. Phases

| Phase | Delivers | Done when |
|---|---|---|
| 1. Foundation | new columns and tables, outbox, `/api/tally` with key auth, admin Integrations and queue screens, connector skeleton with health check, party Stallion → Tally | a new Stallion party shows up as a ledger in the sample company |
| 2. Masters and stock | product masters with HSN and GST data (bulk edit screen), stock items, stock snapshot into Stallion, unlinked ledger review, ledger import | `warehouse_qty` matches Tally within one poll |
| 3. Orders | order to Sales Order, edit and cancel, ordering and retries, totals check | 100 test orders create 100 vouchers, no duplicates after forced retries |
| 4. Invoices | sales voucher feed, matching, invoice chip and PDF in the app, cancelled invoice handling, optional auto-invoice on dispatch | invoice number and PDF show on the order within a minute of raising it in Tally |
| 5. Extras | outstanding per party in Stallion, receipts, tray godown journals, multi-company | agreed after phase 4 |

---

## 12. Testing plan

- Use a **sample company** in Tally with GST turned on, a few ledgers and stock items. Never test against the live company first.
- Contract tests for each XML builder and parser, using saved real responses from your Tally version.
- Failure drills: Tally closed mid-job, duplicate send, name clash, missing ledger, missing stock item, order with 50 lines, order with discount and offer, partial dispatch, cancel after invoice.
- Money checks: Stallion `order_total` equals the Tally voucher total for every test order; invoice GST split equals Tally's.
- Soak test: 24 hours with the PC sleeping and waking, the network dropping, and Tally restarted.
- Take a Tally data backup before the first live run and keep the connector in "log only" mode (reads, no writes) for a day.

---

## 13. Security

- The connector uses a **service key**, scoped to `/api/tally` only, stored hashed in Stallion, rotatable from the admin screen; every call is signed and rate limited.
- Outbound HTTPS only. Tally's HTTP port is never exposed outside the office network.
- The key and company details live in the connector's config file with restricted file permissions.
- All admin changes and every sync job are written to the existing audit log.
- The wholesale prices (WHP) go to Tally only; they never leave to the retail store or any public route.

---

## Appendix A: XML shapes (to verify against your Tally version)

Replace `YourCompany` with the exact company name. Dates are `YYYYMMDD`.

**Create or alter a customer ledger**

```xml
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY><IMPORTDATA>
    <REQUESTDESC>
      <REPORTNAME>All Masters</REPORTNAME>
      <STATICVARIABLES><SVCURRENTCOMPANY>YourCompany</SVCURRENTCOMPANY></STATICVARIABLES>
    </REQUESTDESC>
    <REQUESTDATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="Pratik Optical" ACTION="Create">
          <NAME>Pratik Optical</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          <ADDRESS.LIST><ADDRESS>Narayan Peth</ADDRESS><ADDRESS>Pune</ADDRESS></ADDRESS.LIST>
          <LEDSTATENAME>Maharashtra</LEDSTATENAME>
          <PINCODE>411030</PINCODE>
          <COUNTRYNAME>India</COUNTRYNAME>
          <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
          <PARTYGSTIN>27ABCDE1234F1Z5</PARTYGSTIN>
          <LEDGERPHONE>9876543210</LEDGERPHONE>
          <EMAIL>shop@example.com</EMAIL>
          <BILLCREDITPERIOD>30 Days</BILLCREDITPERIOD>
        </LEDGER>
      </TALLYMESSAGE>
    </REQUESTDATA>
  </IMPORTDATA></BODY>
</ENVELOPE>
```

Use `ACTION="Alter"` for later edits (the connector tries Alter, and Creates when Tally says the ledger does not exist).

**Create a stock item**

```xml
<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <STOCKITEM NAME="STL-BD.IP2401-C6" ACTION="Create">
    <NAME>STL-BD.IP2401-C6</NAME>
    <PARENT>Stallion</PARENT>                 <!-- stock group = brand -->
    <BASEUNITS>Nos</BASEUNITS>
    <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>
    <GSTDETAILS.LIST>
      <HSNCODE>90031900</HSNCODE>
      <TAXABILITY>Taxable</TAXABILITY>
      <STATEWISEDETAILS.LIST>
        <STATENAME>Any</STATENAME>
        <RATEDETAILS.LIST><GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD><GSTRATE>12</GSTRATE></RATEDETAILS.LIST>
      </STATEWISEDETAILS.LIST>
    </GSTDETAILS.LIST>
  </STOCKITEM>
</TALLYMESSAGE>
```

(The group and unit must already exist; the connector creates them first when missing. HSN and rate come from the new product columns.)

**Import a Sales Order**

```xml
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY><IMPORTDATA>
    <REQUESTDESC>
      <REPORTNAME>Vouchers</REPORTNAME>
      <STATICVARIABLES><SVCURRENTCOMPANY>YourCompany</SVCURRENTCOMPANY></STATICVARIABLES>
    </REQUESTDESC>
    <REQUESTDATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales Order" ACTION="Create" REMOTEID="STALLION-ORDER-<order_id>">
          <DATE>20261029</DATE>
          <VOUCHERTYPENAME>Sales Order</VOUCHERTYPENAME>
          <VOUCHERNUMBER>ORD-1040</VOUCHERNUMBER>
          <REFERENCE>ORD-1040</REFERENCE>
          <PARTYLEDGERNAME>Pratik Optical</PARTYLEDGERNAME>
          <NARRATION>Salesman: Rushikesh Patil | visit order</NARRATION>
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>STL-BD.IP2401-C6</STOCKITEMNAME>
            <RATE>1250.00/Nos</RATE>
            <AMOUNT>12500.00</AMOUNT>
            <ACTUALQTY>10 Nos</ACTUALQTY>
            <BILLEDQTY>10 Nos</BILLEDQTY>
            <BATCHALLOCATIONS.LIST>
              <ORDERNO>ORD-1040</ORDERNO>
              <ORDERDUEDATE>20261105</ORDERDUEDATE>
              <ACTUALQTY>10 Nos</ACTUALQTY>
              <BILLEDQTY>10 Nos</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>
    </REQUESTDATA>
  </IMPORTDATA></BODY>
</ENVELOPE>
```

The reply contains counts such as `<CREATED>1</CREATED>` or `<ERRORS>1</ERRORS>` with `<LINEERROR>` text; the connector reads these.

**Export changed customer ledgers (collection request)**

```xml
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>StallionLedgers</ID></HEADER>
  <BODY><DESC>
    <STATICVARIABLES><SVCURRENTCOMPANY>YourCompany</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
    <TDL><TDLMESSAGE>
      <COLLECTION NAME="StallionLedgers" ISMODIFY="No">
        <TYPE>Ledger</TYPE>
        <CHILDOF>Sundry Debtors</CHILDOF>
        <FILTER>ChangedSince</FILTER>
        <FETCH>Name, GUID, AlterID, Parent, Address, LedStateName, PinCode, PartyGSTIN, LedgerPhone, Email, BillCreditPeriod</FETCH>
      </COLLECTION>
      <SYSTEM TYPE="Formulae" NAME="ChangedSince">$AlterID > 12345</SYSTEM>
    </TDLMESSAGE></TDL>
  </DESC></BODY>
</ENVELOPE>
```

(`12345` is the stored cursor; the connector saves the highest `AlterID` it saw.)

**Export changed Sales vouchers (invoices)**

```xml
<COLLECTION NAME="StallionInvoices" ISMODIFY="No">
  <TYPE>Voucher</TYPE>
  <FILTER>IsSales, ChangedSince</FILTER>
  <FETCH>GUID, AlterID, VoucherNumber, Date, PartyLedgerName, PartyGSTIN, PlaceOfSupply, Reference, IsCancelled,
         AllInventoryEntries.StockItemName, AllInventoryEntries.BilledQty, AllInventoryEntries.Rate, AllInventoryEntries.Amount,
         LedgerEntries.LedgerName, LedgerEntries.Amount, IRN, AckNo</FETCH>
</COLLECTION>
<SYSTEM TYPE="Formulae" NAME="IsSales">$$IsSales:$VoucherTypeName</SYSTEM>
```

**Stock balances per godown** use Tally's Stock Summary export report or a Stock Item collection fetching `ClosingBalance` per godown (`$$StockItemClosingBalance` formula).

---

## Appendix B: Field mapping summary

| Stallion | Tally |
|---|---|
| `parties.party_name` | Ledger name |
| `parties.address`, `billing_address`, `pincode`, `state_id` | Ledger address, pincode, state |
| `parties.gstin` | Party GSTIN (registration type Regular when present) |
| `parties.credit_days` | Bill credit period |
| `products.model_no` | Stock item name |
| `products.brand_id` | Stock group |
| `products.whp` | Standard selling rate / order line rate |
| `products.hsn_code`, `gst_rate`, `unit` | HSN, GST rate, base unit |
| `products.warehouse_qty` | Closing balance in the warehouse godown (Tally to Stallion) |
| `orders.order_number` | Voucher number, reference, order number on lines |
| `orders.order_date` | Voucher date |
| `orders.order_items` | Inventory lines |
| `orders.order_notes`, salesman | Narration |
| `tally_invoices.invoice_no`, `invoice_date` | Sales voucher number and date |
| `tally_invoices.cgst`, `sgst`, `igst`, `total` | GST and total ledgers of the Sales voucher |
| `tally_invoices.irn`, `ack_no`, `qr_text` | E-invoice fields |
