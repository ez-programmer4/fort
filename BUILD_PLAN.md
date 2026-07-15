# FortInventory — Build Plan

Pharmacy Inventory Management System, built step by step in module phases.
Source of truth for requirements: [requirnment.md](requirnment.md)

## Tech Stack

| Layer    | Choice                                    |
| -------- | ----------------------------------------- |
| Backend  | Node.js + Express + Prisma ORM            |
| Frontend | Next.js (App Router) + Tailwind CSS       |
| Database | PostgreSQL (via Docker Compose)           |
| Auth     | JWT (access + refresh), role-based access |
| PDF      | pdfkit / puppeteer (reports, slips)       |
| Excel    | exceljs (import/export)                   |

## Project Structure

```
fort/
├── docker-compose.yml      # PostgreSQL (+ optional pgAdmin)
├── backend/                # Node.js + Express + Prisma API
│   ├── prisma/             # schema.prisma, migrations, seed
│   └── src/
│       ├── modules/        # one folder per module (auth, products, ...)
│       ├── middleware/      # auth, rbac, error handling, audit
│       └── utils/          # pdf, excel, helpers
├── frontend/               # Next.js app
│   └── src/
│       ├── app/            # routes (dashboard, products, inventory, ...)
│       ├── components/     # shared UI
│       └── lib/            # api client, auth helpers
├── BUILD_PLAN.md
└── HISTORY.md
```

---

## Phase 0 — Project Setup & Infrastructure

- [x] Initialize git repository
- [x] `docker-compose.yml` with PostgreSQL 16 (+ volume, healthcheck)
- [x] Scaffold `backend/` — Express, Prisma, env config, error middleware
- [x] Scaffold `frontend/` — Next.js + Tailwind (layout shell arrives with login in Phase 1)
- [x] Verify: DB up, backend `/health` responds, frontend renders

## Phase 1 — Auth, Users & Roles (§3.4)

- [x] Prisma models: `User`, `Role`, `Permission`, `RolePermission`
- [x] Seed 4 roles: Admin, Accountant, Operations, Sales (+ default admin user)
- [x] Auth endpoints: login, refresh, me (JWT, bcrypt; logout is client-side token discard)
- [x] RBAC middleware (permission-per-endpoint)
- [x] User CRUD endpoints (Admin only)
- [x] Frontend: login page, auth context, protected routes
- [x] Frontend: Users page (list/add/edit/deactivate)
- [x] Frontend: Roles & Permissions page (view/edit permissions per role)

## Phase 2 — Locations & Suppliers (§3.3, part of §3.7)

- [x] Prisma models: `Location` (name, type: Retail/Warehouse/Dispensary, address, contact person)
- [x] Prisma models: `Supplier` (name, TIN, phone, email, address, bank accounts)
- [x] CRUD APIs for both
- [x] Frontend: Locations page, Suppliers page (list, search, add/edit forms)

## Phase 3 — Product Management (§3.5)

- [x] Prisma models: `Product` (type, pharmacotherapeutic class, generic name,
      brand, description, strength/dose, dose unit, route, dose form, order unit,
      dispense unit, conversion factor, country, manufacturer, supplier link, unit price, code)
- [x] Lookup lists: dose forms, routes, units (seeded, editable)
- [x] Product CRUD API with filter/search/pagination
- [x] Excel: download template, export products (filters + batch selection), bulk upload with validation
- [x] Frontend: Products page (table + filters), Add/Edit Product form, Import/Export UI
- [x] Bin Card (pulled forward from Phase 4): `Batch` + `StockMovement` tables, report API, printable page

## Phase 4 — Inventory & Stock (§3.6)

- [x] Prisma models: `Batch` (product, batch no., expiry, supplier, unit cost),
      `StockMovement` (type, direction, qty, reason, performed by, date, location) — done early in Phase 3
- [x] `Stock` table (batch × location current quantity) kept in sync by a shared stock service
- [x] Inventory view API: code, generic, brand, description, qty, price, supplier, batch, expiry — per location
- [x] Stock adjustment API (increase/decrease + reason) → writes `StockMovement`
- [x] Bin Card report API: product + location + date range → In/Out/Balance rows (done in Phase 3)
- [x] Frontend: Inventory page (filter/search/export), Stock Adjustment form
- [x] Frontend: Bin Card page + printable output (done in Phase 3)

## Phase 5 — Procurement / GRV (§3.7)

- [x] Prisma models: `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceipt` (GRV), `GRVItem`
- [x] Create PO: pick products (search/filter), qty, price
- [x] GRV: receive against PO → enter qty, batch, expiry, price, location → creates batches + stock-in movements
- [x] Optional withholding tax on purchases (goods vs services)
- [x] Non-sale item purchases (office supplies etc. — `ExpensePurchase`)
- [x] GRV history API + page
- [x] Frontend: PO creation flow, GRV receiving flow, GRV history

## Phase 6 — Sales & Dispensing (§3.8)

- [x] Prisma models: `DispenseOrder`, `DispenseItem` (batch-level), `Attachment`
- [x] Dispense flow: select location → product → batch → qty → per-sale price adjustment
- [x] Dispense summary (editable quantities) → confirm → stock-out movements
- [x] Print dispense slip (browser print-to-PDF; branded PDF in Phase 9)
- [x] Sales history with attachments upload
- [x] Frontend: Dispense page (cart-style), summary/confirm, slip print, history page

## Phase 7 — Wallet / Finance (§3.9)

- [x] `Payment` model (cash/credit lives on `DispenseOrder` since Phase 6; WHT fields already there)
- [x] Outstanding balances (credit sales) API
- [x] Record payment endpoint (overpay guard, credit-only)
- [x] Withholding tax handling on sales (done in Phase 6, surfaced in wallet summary)
- [x] Frontend: Wallet page — summary cards, outstanding credits, record payment, payment history

## Phase 8 — Alerts & Dashboard (§3.1, §3.2)

- [x] Alerts engine: expiring/expired, low stock, over stock, stock adjustments —
      **thresholds per product in its own dispense unit** (minStock/maxStock/expiryAlertDays on Product)
- [x] Alert detail: reason, movement type, performed by, date, qty, expiry, batch no.
- [x] Frontend: Alerts page (filter by type + location, count cards)
- [x] Dashboard API: stock overview, low-stock/expiring counts, sales summary, top movers
- [x] Frontend: Dashboard with quick links to POs, Dispensing, Reports

## Phase 9 — Reports (§3.10)

- [x] Finance report: total sales, COGS, gross profit, revenue, payments — filter by location + date range
- [x] Sales report: performance by period, date-wise revenue
- [x] Professional PDF layout: logo + signature block (pdfkit, shared `utils/pdf.js`)
- [x] Frontend: Reports page with filters + on-screen preview + PDF download
- [x] Alerts page reworked to tabs (Expiring / Expired / Low / Over / Adjustments) with count badges

## Phase 10 — Settings & Polish (§3.11, §4)

- [x] Settings: pharmacy name/logo initials, WHT default rates, default expiry alert window
      (wired into PDFs, dispense slip, alerts engine and WHT form defaults)
- [x] Responsive pass (sidebar auto-collapses on tablet-width screens; tables scroll)
- [x] Audit trail review page (all stock movements with filters)
- [x] Security hardening: rate limiting (login + general), validation throughout, helmet
- [x] Final end-to-end walkthrough (all 17 pages verified, live data flows checked)

---

**All 11 phases complete — the system fulfils every module in requirnment.md.**

---

# Adjustment & Enhancement Phases (v1.1)

Source of truth: [adjustment_requirnment.md](adjustment_requirnment.md) (2026-07-16).
Items marked **➕ (added)** are professional-UX additions beyond the spec, per user request.

## Phase A1 — Shared UI Component Library (§1 foundations)

Build once, reuse everywhere (all monochrome, keyboard-accessible):

- [ ] **Drawer** — smooth slide-in panel from the right for all Add/Edit forms (§1.2)
- [ ] **Pagination** footer — rows per page 10 (default) / 25 / 50 / 100 + page controls (§1.1)
- [ ] **SearchInput** — debounced 350 ms, fires only from 2+ characters, clear button (§1.3)
- [ ] **DatePicker** — custom calendar popover, single date + range mode (§1.4)
- [ ] **Combobox** — searchable select for large lists (type-to-filter, arrow keys) (§2.3)
- [ ] **LoadingScreen / Spinner** — branded ("FortInventory" + spinner), used app-wide (§1.6)
- [ ] ➕ **Toast notifications** — success/error feedback instead of inline banners only
- [ ] ➕ **ConfirmDialog** — for destructive actions (cancel PO, deactivate, dispose)
- [ ] ➕ **EmptyState** — consistent friendly empty tables with a call-to-action
- [ ] Navbar/sidebar toggle polish (§1.5 — collapse behavior exists; refine icon + tooltip)

## Phase A2 — Roll-out Across All Modules (§1 applied)

- [ ] Pagination on every table: products, inventory, users, locations, suppliers,
      procurement (3 tabs), sales history, wallet (credits + payments), audit trail
- [ ] All Add/Edit forms become Drawers: users, locations, suppliers, products,
      stock adjustment, new PO, receive GRV, expense, record payment
- [ ] Debounced 2+ char search everywhere a search box exists
- [ ] Combobox for supplier & product selection: product form, PO lines, dispense
      stock picker, bin card product select (§2.3)
- [ ] Custom DatePicker replaces native date inputs: bin card, wallet, reports,
      audit, PO receive expiry, sales history
- [ ] ➕ Branded loading + skeleton rows during data fetch on all pages

## Phase A3 — Alerts Module Adjustments (§2.1)

- [ ] **Dispose** action on expired / near-expiry alerts → new `DISPOSE` stock-out
      movement (reason required, permission-gated), clears the alert as stock leaves
- [ ] Search + filter inside the alerts list (product search, location, type tabs stay)
- [ ] **Clickable product details** — product drawer from any alert: product info,
      current stock by batch/location, recent movements
- [ ] ➕ Dispose confirmation with quantity preview (ConfirmDialog)

## Phase A4 — Dashboard Enhancements (§2.2)

- [ ] **Customer entity** (required for Top Customers — not in v1.0): optional
      customer (name/phone) captured at dispensing via Combobox with quick-create
- [ ] **Profits Overview** — Gross Profit + Net Profit/Loss (gross − expenses),
      trend indicators ↑/↓ with % vs previous period
- [ ] **Top Customers** — ranked by sales volume & frequency, last order date
- [ ] **Charts** (line/area/bar, monochrome palette):
  - Sales vs Purchases trend
  - Gross & Net Profit trends
  - Top products by margin · Top products by volume
  - Monthly performance overview
- [ ] ➕ Period selector for the dashboard (7d / 30d / 90d / 12m)

## Phase A5 — Sales Print + Final Polish (§2.4)

- [ ] **Printable Sales History** — professional print layout with date-range picker
- [ ] ➕ Sales history date-range filter on screen (not just for print)
- [ ] ➕ Final consistency sweep: spacing, typography, focus states, tablet check
- [ ] Verify everything end-to-end, update HISTORY.md

---

## Build Order Rationale

Auth first because every other module needs users/permissions. Locations,
suppliers and products are master data that inventory depends on. Stock and
movements (Phase 4) are the core — procurement writes stock **in**, dispensing
writes stock **out**, and alerts/reports/dashboard just read what those wrote.
