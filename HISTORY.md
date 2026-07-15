# FortInventory — Build History

Chronological log of everything done on the system. Newest entries at the top.
Each entry: date, phase/module, what was done, and any decisions made.

---

## 2026-07-15 — Phase 10 complete: Settings & Polish — **BUILD COMPLETE** 🎉

**Phase:** 10 — Settings & Polish (final phase)

**Done:**
- `Setting` key/value model + `/api/settings` (GET any signed-in user, PUT `settings.manage`) — migration `settings`
- Settings: pharmacy name, address, phone, logo initials (1–2 chars), default expiry-alert window, default WHT rates for goods/services
- **Wired everywhere:** report PDFs (logo box + name + address/phone tagline), dispense slip header, alerts engine default expiry window, WHT rate defaults in receiving/dispensing/expense forms (`frontend/src/lib/settings.ts` cached fetch + `useSettings` hook)
- **Audit Trail page** (`/audit`, `inventory.view`): every stock movement with type/location/product/date filters and pagination — GRV, dispense, adjustments with reason and performer
- **Rate limiting** (express-rate-limit): 20 login attempts / 15 min, 300 API requests / min
- **Responsive:** sidebar auto-collapses on ≤1024 px screens when no saved preference; all tables scroll horizontally
- Settings page UI (identity + defaults sections)

**Verified:**
- Settings round-trip; branded finance PDF visually inspected ("FP" logo box, "Fort Pharmacy PLC", address · phone tagline) then restored to defaults
- Audit trail returns all 12 movements with performers; rate-limit headers present; `tsc` clean
- **Full sweep: all 17 pages render HTTP 200** (/, login, dashboard, alerts, products, inventory, bincard, procurement, sales, wallet, reports, audit, locations, suppliers, users, roles, settings)

**The system is feature-complete against requirnment.md:** dashboard, alerts (per-product thresholds), locations, users/roles/permissions, products with Excel import/export, bin card, inventory with adjustments, procurement (PO → GRV with WHT), sales & dispensing (editable summary, slip, attachments), wallet (credit ledger + payments), finance & sales PDF reports, settings, audit trail, responsive monochrome UI.

**Login:** admin@fortinventory.local / admin123 (change in production!)
**Run:** `docker compose up -d` → `cd backend && npm run dev` → `cd frontend && npm run dev` → http://localhost:3000

---

## 2026-07-15 — Phase 9 complete: Reports (+ alerts tabs rework)

**Phase:** 9 — Reports

**Done:**
- **Alerts page rework (user request):** alert types are now tabs — All / Expiring / Expired / Low Stock / Over Stock / Adjustments — each with a live count badge; alerts fetched once and filtered client-side so counts stay complete
- Shared PDF layout helper (`backend/src/utils/pdf.js`, pdfkit): monochrome logo block + company header, title/subtitle, period-location-generated meta line, zebra tables with page-break handling, summary rows, **signature block** (prepared by / approved by / date)
- **Finance Report** (`/api/reports/finance` JSON + `/finance.pdf`): Total Sales (gross), withholding on sales, net Revenue, **COGS** (batch cost, product-price fallback), **Gross Profit**, payments received (cash at sale + credit payments), non-sale purchases — filter by date range + location
- **Sales Report** (`/api/reports/sales` JSON + `/sales.pdf`): date-wise table — sales count, gross, cash, credit, net revenue per day, with totals row
- Frontend Reports page: Finance/Sales tabs, date-range + location filters, on-screen preview (statement-style for finance, day table for sales), Download PDF button; added to sidebar (`reports.view`)

**Verified:**
- Finance: 3 sales, total 4,012.50, COGS 957.75, gross profit 3,054.75, payments 4,012.50 (3,240 cash + 772.50 credit) — matches wallet
- Both PDFs download with valid `%PDF` headers; finance PDF visually inspected (logo, sections, bold totals, signature block); fixed a "−0.00" display for zero withholding
- `tsc` clean; /reports and reworked /alerts render (HTTP 200)

**Next:** Phase 10 — Settings & Polish (final phase)

---

## 2026-07-15 — Phase 8 complete: Alerts & Dashboard

**Phase:** 8 — Alerts & Dashboard

**Done:**
- **Per-product alert thresholds** (user requirement: thresholds differ per product and unit): `minStock`, `maxStock`, `expiryAlertDays` added to Product — all in that product's dispense unit; editable in the product form with unit hints (migration `product_alert_thresholds`)
- Alerts engine (computed live, no stale alert table):
  - **Expired** — batches past expiry with stock remaining, per location
  - **Expiring soon** — within the product's own window (default 90 days)
  - **Low stock** — product total at a location below its minStock (includes fully out-of-stock products)
  - **Over stock** — above its maxStock
  - **Stock adjustments** — last 30 days of ADJUST movements with reason, movement type, performed by, move date, quantity, expiry, batch no. (full §3.2 detail set)
- `GET /api/alerts?type=&locationId=` returns alerts + per-type counts
- Dashboard API: stock value (batch cost, falling back to product price), units in stock, product count, sales today/7-days, top 5 moving products (30-day dispensed qty), 5 recent sales, alert counts
- Frontend: Alerts page (clickable count cards double as filters, location filter, detail column incl. who/when for adjustments); Dashboard rebuilt with quick links (POs / Dispense / Inventory / Reports, permission-filtered), stock/sales/alert cards, top movers and recent sales tables

**Verified:**
- Paracetamol minStock=1000 → LOW_STOCK "535 Strip on hand — below minimum of 1000 Strip"; expiryAlertDays=400 → EXPIRING for the 349-day batch only
- Amoxicillin maxStock=100 → OVER_STOCK (250 on hand); received CTZ-OLD batch with past expiry → EXPIRED "76 day(s) ago — 50 Strip still in stock"; both ADJUST movements listed with reasons
- Type filter works; dashboard shows stockValue 6,942.25, 7-day sales 4,012.50, top mover Paracetamol ×65; `tsc` clean; both pages HTTP 200

**Next:** Phase 9 — Reports (Finance & Sales PDF)

---

## 2026-07-15 — Phase 7 complete: Wallet / Finance

**Phase:** 7 — Wallet / Finance

**Done:**
- Prisma model `Payment` (amount, method CASH/BANK_TRANSFER/CHEQUE/MOBILE, reference, received by) linked to dispense orders — migration `payments`
- Wallet API (`finance.view` / `finance.manage`):
  - `GET /api/wallet/summary` — total/cash/credit sales, payments received, **outstanding balance**, WHT withheld on sales; filterable by date range & location
  - `GET /api/wallet/credits` — credit-sale ledger with per-order paid/outstanding (open by default, `settled=true` shows all)
  - `POST /api/wallet/payments` — record payment; **rejects overpayment** and payments against cash sales
  - `GET /api/wallet/payments` — payment history
- Frontend Wallet page: six summary cards (Total/Cash/Credit/Payments/Outstanding/WHT) with date-range filter, Outstanding Credits tab (record-payment form prefilled with the outstanding amount, method/reference/notes), Payment History tab. Record button gated by `finance.manage`
- Cash sales are treated as settled at sale time; only credit sales carry balances

**Verified:**
- Summary: 3,900 total = 3,240 cash (DSP-00002, user's own browser test sale) + 660 credit (DSP-00001), outstanding 660
- Payment 300 (bank transfer, ref TT-4471) → outstanding 360; overpay 9,999 rejected (400); payment 360 → settled, outstanding 0, paymentsReceived 660, open credits list empty
- `tsc --noEmit` clean; /wallet renders (HTTP 200)

**Next:** Phase 8 — Alerts & Dashboard

---

## 2026-07-15 — Phase 6 complete: Sales & Dispensing

**Phase:** 6 — Sales & Dispensing

**Done:**
- Prisma models: `DispenseOrder` (auto `DSP-00001…`, location, CASH/CREDIT payment, subtotal, optional withholding, total), `DispenseItem` (batch-level, keeps both **list price** and the **adjusted sale price** for this sale), `Attachment` — migration `sales_dispensing`
- Sales API: create dispense order (validates every batch, blocks over-dispensing, writes `DISPENSE` stock-out movements via the shared stock service — all atomic), paginated history with search/filters, order detail, attachment upload (multer disk storage in `backend/uploads/`, gitignored) and authenticated download
- Frontend Sales & Dispensing page:
  - **New Dispense** — pick location → live-search available stock (shows batch, expiry, available qty, price) → add to cart → **Dispense Summary with editable quantities and per-sale price adjustment** (as requested: review/adjust before confirming) → payment type + optional WHT → Confirm
  - **Dispense Slip** — printable slip (header, DSP number, items with batch/expiry, totals, signature lines); Print button (browser print-to-PDF); shell hidden in print view
  - **Sales History** — orders with payment badge (credit highlighted), expandable line items showing list vs sold-at price, per-order attachments (upload + download)

**Verified:**
- DSP-00001: 20× Paracetamol @13.00 (list 12.50, per-sale override) + 50× Amoxicillin @8.00 = 660.00 CREDIT — stock fell 200→180 and 300→250; Amoxicillin bin card shows `DISPENSE / out 50 / DSP-00001`
- Over-dispensing 99,999 rejected (400); attachment uploaded and downloaded back byte-identical; `tsc --noEmit` clean; /sales renders (HTTP 200)

**Decisions:**
- Payment type (cash/credit) recorded now so Phase 7 (Wallet) can compute outstanding balances without schema changes
- Sales can carry optional withholding tax like purchases (per requirement NB)

**Next:** Phase 7 — Wallet / Finance

---

## 2026-07-15 — Phase 5 complete: Procurement / GRV

**Phase:** 5 — Procurement Module

**Done:**
- Prisma models: `PurchaseOrder` (auto `PO-00001…`, supplier, receiving location, status OPEN/RECEIVED/CANCELLED), `PurchaseOrderItem` (qty, unit cost, optional batch/expiry pre-fill), `GoodsReceipt` (auto `GRV-00001…`, subtotal, withholding type/rate/amount, net payable), `GRVItem`, and `ExpensePurchase` for non-sale purchases — migration `procurement`
- Procurement API: list/create/cancel POs; **receive** endpoint that atomically upserts batches, writes GRV stock-in movements via the shared stock service, creates the receipt, and flips the PO to RECEIVED; GRV history; expense list/create
- Optional **withholding tax** on receiving and on expenses: type NONE/GOODS/SERVICES with editable rate (UI defaults 2%) — net payable = subtotal − WHT
- Frontend Procurement page with three tabs:
  - **Purchase Orders** — new-PO form (product search picker, line items with qty/cost/batch/expiry, live subtotal), receive flow (prefilled lines, batch No. required, WHT selector with live net-payable), cancel, status badges, linked GRV numbers
  - **GRV History** — receipts with expandable line items, subtotal/WHT/net columns
  - **Other Purchases** — record office supplies etc. with category, supplier, WHT
- Hardened PO item validation (non-numeric productId now returns 400 instead of 500)

**Verified:**
- PO-00001 (200× Paracetamol @9.75 + 300× Amoxicillin @6.50) received as GRV-00001 with 2% goods WHT: subtotal 3,900.00 → WHT 78.00 → net 3,822.00
- Inventory gained batches BN-2026-002 (qty 200) and AMX-101 (qty 300); Amoxicillin bin card shows the GRV movement (`GRV-00001 (PO-00001)`)
- Receiving a non-open PO rejected (400); expense with 2% services WHT → net 1,470.00; GRV history returns items; `tsc --noEmit` clean; /procurement renders (HTTP 200)
- User created PO-00002 through the browser UI while testing — the flow works live

**Notes:**
- Docker Desktop and both dev servers had been stopped between sessions — restarted (`docker compose up -d`, `npm run dev` in backend/ and frontend/)

**Next:** Phase 6 — Sales & Dispensing

---

## 2026-07-15 — Phase 4 complete: Inventory & Stock

**Phase:** 4 — Inventory Management

**Done:**
- `Stock` table (batch × location, unique pair, current quantity) — migration `stock_table`; existing test movements backfilled via a rebuild routine
- **Stock service** (`backend/src/utils/stock.service.js`): `applyMovement(tx, …)` is now the single gate for all stock changes — upserts the Stock row, blocks negative stock, writes the StockMovement, all in one transaction. GRV (Phase 5) and Dispensing (Phase 6) will reuse it. Also exports `rebuildStock()` for maintenance
- Inventory API: paginated stock-on-hand list (product info + qty + batch + expiry + supplier + location) with search/location filters, Excel export, `POST /api/inventory/adjust` (INCREASE/DECREASE, reason mandatory) → records `ADJUST_*` movements that the Alerts module (Phase 8) will surface
- Frontend Inventory page: search + location filter, quantities with dispense unit, expiry badges (red "Expired" / amber "Nd left" within 90 days), Adjust form (only visible with `inventory.adjust` permission), Export button, pagination

**Verified:**
- Inventory shows Paracetamol qty 370 → increase 30 → 400; over-decrease of 99,999 rejected with 400 "Not enough stock: only 400 available…"
- Adjustment immediately appears on the bin card (row 4, `ADJUST_INCREASE`, remark preserved, closing 400)
- Excel export downloads; `tsc --noEmit` clean; /inventory renders (HTTP 200)

**Decisions:**
- Chose a materialized `Stock` table over computing quantities from movements each time — faster inventory queries and a hard guarantee against negative stock at the database boundary
- Zero-quantity rows are hidden by default (`includeZero=true` shows them)

**Next:** Phase 5 — Procurement (Purchase Orders, GRV)

---

## 2026-07-15 — Phase 3 complete: Product Management + Bin Card

**Phase:** 3 — Product Management (+ Bin Card pulled forward from Phase 4 per user request)

**Done:**
- Prisma models: `Product` (all §3.5 fields, auto-generated code `P-00001…`, supplier link, decimal unit price), `Lookup` (seeded dose forms ×15, routes ×11, dose units ×8, order/dispense units ×10), plus **`Batch` and `StockMovement`** pulled forward so the Bin Card works now — migration `products_lookups_movements`
- Products API: paginated list with search + type/supplier/active filters, create, update/deactivate
- Excel (exceljs + multer): template download (with sample row + notes sheet), filtered export, bulk import with per-row validation (bad rows reported with reasons, good rows still imported)
- Bin Card API `GET /api/reports/bincard?productId&locationId&from&to`: opening balance before range + chronological rows (Date | Batch | Expiry | Supplier | In | Out | Balance | Performed By | Remark)
- Frontend Products page: table with code/name/brand/type/class/form/strength/price/supplier/status, debounced search, type filter, pagination, full add/edit form (lookup-driven selects), Template / Import / Export buttons with import result summary
- Frontend Bin Card page: product search-select, location + date range, ledger table with opening/closing balances, **Print / Save as PDF** (app shell hidden via print CSS)
- `api.ts` gained FormData upload support and an authenticated `apiDownload` helper

**Verified:**
- Created P-00001 Paracetamol & P-00002 Amoxicillin via API; search + lookups OK
- Template (7.9 KB) and export (7.1 KB) download; import file with 1 valid + 1 invalid row → `created: 1`, row 3 rejected with 4 precise reasons
- Seeded 3 test movements → bin card shows running balance 500 → 380 → 370 with batch, supplier and performer
- `tsc --noEmit` clean; /products and /bincard render (HTTP 200)

**Decisions:**
- Batch/StockMovement created early; Phase 4+ write real movements (GRV in, dispense out) and the bin card picks them up automatically
- Bin card printing uses the browser's print-to-PDF for now; branded PDF generation (logo + signature) comes with Phase 9 reports
- Import matches suppliers by exact name (case-insensitive); unknown suppliers reject the row rather than auto-creating

**Next:** Phase 4 — Inventory & Stock (stock levels view, adjustments)

---

## 2026-07-15 — Phase 2 complete: Locations & Suppliers + UI restyle

**Phase:** 2 — Locations & Suppliers (plus UI overhaul per user feedback)

**Done:**
- Prisma models `Location` (name, type Retail/Warehouse/Dispensary/Other, address, contact person, active flag) and `Supplier` (name, TIN, phone, email, address, bank accounts as JSON, active flag) — migration `locations_suppliers`
- CRUD APIs for both: list with search (`?q=`), create, update, deactivate, delete (delete returns 409 with a friendly message once FK references exist). Any signed-in user can **list** (dispensing/product forms need them); mutations require `locations.manage` / `suppliers.manage`
- Frontend Locations page: search-as-you-type, add/edit form, type badge, activate/deactivate
- Frontend Suppliers page: search, add/edit form with dynamic bank-account rows, activate/deactivate
- **UI restyle (user request):** monochrome professional theme — white surfaces, slate-900 text/buttons, gray borders; color only in small status badges (green Active / red Inactive). New **collapsible sidebar** (icon-only at 4rem ⇄ full 15rem, state saved in localStorage), top header bar with page title, user identity and sign-out. Inline SVG icon set at `frontend/src/components/icons.tsx`

**Verified:**
- Created "Main Warehouse" location and "MedSupply PLC" supplier (with bank account) via API; search returns them
- Sales user can list locations but gets **403** creating one; `tsc --noEmit` clean; both pages render (HTTP 200)

**Notes:**
- Windows quirk: `prisma generate` fails with EPERM while the backend dev server runs (query-engine DLL is locked) — stop the server before regenerating, then restart

**Next:** Phase 3 — Product Management

---

## 2026-07-15 — Phase 1 complete: Auth, Users & Roles

**Phase:** 1 — Auth, Users & Roles

**Done:**
- Prisma models `User`, `Role`, `Permission`, `RolePermission` — migration `init_auth`
- Seed: 18 permissions across 10 modules, 4 roles (Admin, Accountant, Operations, Sales), default admin user
- Auth API: `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me` — JWT access (15 m) + refresh (7 d), bcrypt password hashing
- RBAC middleware: `requireAuth` (loads user + role permissions), `requirePermission(key)`
- Users API: list / create / update (rename, email, role change, activate/deactivate, password reset) — guarded by `users.manage`; self-deactivation blocked
- Roles API: list roles, list permissions, replace a role's permission set — guarded by `roles.manage`; Admin role is locked (`isSystem`)
- Frontend: login page, `AuthProvider` context (token storage + auto-refresh on 401), protected `(app)` layout with permission-filtered sidebar, Dashboard placeholder, Users page (table + add/edit/deactivate), Roles & Permissions page (checkbox grid grouped by module)

**Verified:**
- Admin login → 18 permissions; `/api/auth/me`, users list, roles list all OK
- Created a Sales user via API → login OK → `GET /api/users` correctly returns **403**
- No token → **401**; all four frontend pages render (HTTP 200); `tsc --noEmit` clean

**Decisions / issues hit:**
- **Port conflict:** native PostgreSQL 17 service occupies host port 5432 and `wslrelay` holds 5433 — Docker DB now maps to **host port 5434** (`DATABASE_URL` updated)
- Refresh tokens are stateless JWTs (no DB session table); logout = client discards tokens
- Admin role is non-editable (`isSystem`) to prevent permission lockout
- Default login: `admin@fortinventory.local` / `admin123` (change in production); test user `seller@fortinventory.local` / `seller123` (Sales role)

**Next:** Phase 2 — Locations & Suppliers

---

## 2026-07-15 — Phase 0 complete: Infrastructure & scaffolding

**Phase:** 0 — Project Setup & Infrastructure

**Done:**
- Git repository initialized (`main` branch) + `.gitignore`
- `docker-compose.yml`: PostgreSQL 16 (alpine) with volume + healthcheck — container `fortinventory-db` running healthy on port 5432
- `backend/`: Express 5 app with helmet, cors, morgan, JSON error middleware, `/health` endpoint; Prisma 6 + empty schema; `.env` with DB/JWT config
- `frontend/`: Next.js 15 (App Router, TypeScript) + Tailwind CSS v4, manually scaffolded; landing page; `/api/*` rewrites proxy to backend port 4000

**Verified:**
- `docker compose ps` → db healthy
- `GET http://localhost:4000/health` → `{ status: "ok" }`
- `http://localhost:3000` → renders FortInventory landing page (HTTP 200)

**Decisions:**
- Pinned **Prisma 6** (Prisma 7 requires Node ≥ 20.19; machine runs Node 20.9)
- Skipped `create-next-app` in favor of manual scaffold (deterministic, no prompts)
- DB credentials for dev: `fort` / `fortpass` / db `fortinventory` (change for production)

**How to run:**
```
docker compose up -d          # database
cd backend && npm run dev     # API on :4000
cd frontend && npm run dev    # UI on :3000
```

**Next:** Phase 1 — Auth, Users & Roles

---

## 2026-07-15 — Project kickoff

**Phase:** Planning

**Done:**
- Reviewed requirements ([requirnment.md](requirnment.md))
- Created [BUILD_PLAN.md](BUILD_PLAN.md) — 11 phases (0–10), module by module
- Created this history file

**Decisions:**
- Tech stack per requirements: Node.js backend, Next.js frontend, PostgreSQL in Docker
- Backend framework: Express + Prisma ORM
- Build order: infrastructure → auth/roles → master data (locations, suppliers, products) → inventory core → procurement → dispensing → finance → alerts/dashboard → reports → settings

**Next:** Phase 0 — Docker Compose + backend/frontend scaffolding
