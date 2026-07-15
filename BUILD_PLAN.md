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

- [ ] Alerts engine: expiring/expired, low stock, over stock, stock adjustments
      (min/max thresholds per product-location; expiry window setting)
- [ ] Alert detail: reason, movement type, performed by, date, qty, expiry, batch no.
- [ ] Frontend: Alerts page (filter by type)
- [ ] Dashboard API: stock overview, low-stock/expiring counts, sales summary, top movers
- [ ] Frontend: Dashboard with quick links to POs, Dispensing, Reports

## Phase 9 — Reports (§3.10)

- [ ] Finance report: total sales, COGS, gross profit, revenue, payments — filter by location + date range
- [ ] Sales report: performance by period, date-wise revenue
- [ ] Professional PDF layout: logo + signature block
- [ ] Frontend: Reports page with filters + PDF download

## Phase 10 — Settings & Polish (§3.11, §4)

- [ ] Settings: pharmacy name/logo, tax rates, alert thresholds, expiry window
- [ ] Responsive pass (desktop + tablet)
- [ ] Audit trail review page (all stock movements)
- [ ] Security hardening: rate limiting, validation everywhere, helmet
- [ ] Seed demo data + final end-to-end walkthrough

---

## Build Order Rationale

Auth first because every other module needs users/permissions. Locations,
suppliers and products are master data that inventory depends on. Stock and
movements (Phase 4) are the core — procurement writes stock **in**, dispensing
writes stock **out**, and alerts/reports/dashboard just read what those wrote.
