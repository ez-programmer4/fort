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

- [x] **Drawer** — smooth slide-in panel from the right for all Add/Edit forms (§1.2)
- [x] **Pagination** footer — rows per page 10 (default) / 25 / 50 / 100 + page controls (§1.1)
- [x] **SearchInput** — debounced 350 ms, fires only from 2+ characters, clear button (§1.3)
- [x] **DatePicker** — custom calendar popover, single date + range mode (§1.4)
- [x] **Combobox** — searchable select for large lists (type-to-filter, arrow keys) (§2.3)
- [x] **LoadingScreen / Spinner / SkeletonRows** — branded, used app-wide (§1.6)
- [x] ➕ **Toast notifications** — success/error feedback instead of inline banners only
- [x] ➕ **ConfirmDialog** — for destructive actions (cancel PO, deactivate, dispose)
- [x] ➕ **EmptyState** — consistent friendly empty tables with a call-to-action
- [x] Navbar/sidebar toggle (§1.5 — already built in Phase 2; icons-only collapse + persisted state)
- [x] Pilot integrations: Locations page (drawer, pagination, search, toasts, confirm, skeleton,
      empty state) and Bin Card (product combobox + date-range picker)

## Phase A2 — Roll-out Across All Modules (§1 applied)

- [x] Pagination on every table: products, inventory, users, locations, suppliers,
      procurement (3 tabs), sales history, wallet (credits + payments), audit trail
- [x] All Add/Edit forms become Drawers: users, locations, suppliers, products,
      stock adjustment, new PO, receive GRV, expense, record payment
- [x] Debounced 2+ char search everywhere a search box exists
- [x] Combobox for supplier & product selection: product form, PO lines, dispense
      stock picker, bin card product select (§2.3)
- [x] Custom DatePicker replaces native date inputs: bin card, wallet, reports,
      audit, PO receive expiry, sales history
- [x] ➕ Branded loading + skeleton rows during data fetch on all pages

## Phase A3 — Alerts Module Adjustments (§2.1)

- [x] **Dispose** action on expired / near-expiry alerts → new `DISPOSE` stock-out
      movement (reason required, permission-gated), clears the alert as stock leaves
- [x] Search + filter inside the alerts list (product search, location, type tabs stay)
- [x] **Clickable product details** — product drawer from any alert: product info,
      current stock by batch/location, recent movements
- [x] ➕ Dispose confirmation with quantity preview (ConfirmDialog)
- [x] ➕ Clickable summary cards per alert type (counts, icon, color) that double as tab filters
- [x] ➕ Alerts sorted by urgency server-side (soonest expiry / biggest deficit-excess / most recent first)
- [x] ➕ Disposals show up in the Adjustments tab and Audit Trail (`DISPOSE` movement type, labeled)
- [x] ➕ Manual Refresh control (alerts are computed live, not cached)

## Phase A4 — Dashboard Enhancements (§2.2)

- [x] **Customer entity** (required for Top Customers — not in v1.0): optional
      customer (name/phone) captured at dispensing via Combobox with quick-create
- [x] **Profits Overview** — Gross Profit + Net Profit/Loss (gross − expenses),
      trend indicators ↑/↓ with % vs previous period
- [x] **Top Customers** — ranked by sales volume & frequency, last order date
- [x] **Charts** (line/area/bar, monochrome palette):
  - Sales vs Purchases trend
  - Gross & Net Profit trends
  - Top products by margin · Top products by volume
  - Monthly performance overview
- [x] ➕ Period selector for the dashboard (7d / 30d / 90d / 12m)
- [x] ➕ Reusable `Combobox` quick-create (`onCreate`) — generic addition, not just for customers
- [x] ➕ Hand-built SVG chart components (`TrendChart`, `RankBars`) validated against the
      dataviz skill's color/contrast checks — no new chart-library dependency

## Phase A5 — Sales Print + Final Polish (§2.4)

- [x] **Printable Sales History** — professional print layout with date-range picker
- [x] ➕ Sales history date-range filter on screen (not just for print)
- [x] ➕ Final consistency sweep: spacing, typography, focus states, tablet check
- [x] Verify everything end-to-end, update HISTORY.md

---

**All adjustment phases (A1–A5) complete — the professional UX pass is done.**

---

## Phase A6 — Post-launch Punch List

Follow-up items reported after using the finished app.

- [x] Sidebar collapse toggle moved from the top navbar into the sidebar itself
      (bottom of the rail, with a chevron that flips on collapse)
- [x] Sidebar made `sticky` + full viewport height so it (and the header) stay in
      place while only the main content scrolls; collapsed state now shows
      hover tooltips for each nav icon; user profile + sign-out moved into a
      sidebar footer
- [x] Fixed DatePicker/Combobox popovers rendering clipped or mispositioned
      inside Drawers and horizontally-scrolled tables (e.g. procurement's
      expiry-date picker) — both now portal to `document.body` and position
      with `fixed` coordinates computed from the trigger's bounding rect, so
      no ancestor `overflow` can clip them; flips upward automatically when
      there's no room below
- [x] Column sorting added to every paginated table (Locations, Suppliers,
      Users, Products, Inventory, Procurement's 3 tabs, Sales History,
      Wallet's 2 tabs, Audit Trail) — click a column header to sort, click
      again to reverse; server-side via `?sortBy&sortDir` so it works
      correctly together with pagination, with a whitelist per endpoint so
      an invalid `sortBy` can never reach the database

---

## Phase A7 — Public Homepage

The public-facing company is **Fort Pharma PLC** (the registered business,
per its Google Maps listing), which imports pharmaceuticals from around the
world and distributes them across Ethiopia; **FortInventory** is its
internal inventory platform (mentioned on the homepage as the tech behind
the operation, and still the name/branding of the staff login portal). Root
`/` previously just redirected straight to `/login`; it now shows a public
marketing homepage to signed-out visitors, and still redirects signed-in
users straight to `/dashboard`.

- [x] `frontend/src/components/marketing/homepage.tsx` — sticky navbar
      (mobile menu), hero, country-sourcing marquee ticker, animated
      count-up stats, "what we import" services grid, 4-step process,
      why-us section, CTA banner, contact (info cards + real embedded
      Google Map + "Get directions" + mailto-based form), footer with a
      "Client Portal" link to `/login` — all major sections fade/slide in
      on scroll via a small `useReveal` IntersectionObserver hook
- [x] `frontend/src/components/marketing/globe-map.tsx` — a real
      orthographic globe (not an abstract wireframe): `world-atlas` land
      data + `topojson-simplify`, projected via `d3-geo`'s orthographic
      projection centered so China, India, Germany, UAE and Ethiopia are
      all on the visible hemisphere at once, clipped to a circle. Ethiopia
      is drawn again on top in the accent color as the highlighted
      destination. Pulsing origin markers, animated dashed flight paths
      (native SVG `<animateMotion>`) and the Addis Ababa pin all use real
      projected coordinates. Generated once via a throwaway script and
      hardcoded — no map/geo library ships to the browser. Positioned to
      the right of the hero text (`md:grid-cols-2`), not stacked below it.
- [x] Real product categories in the services grid — Medication, Equipment,
      Cosmetics (replacing an earlier, invented six-category list) — each
      with a few example-product tags
- [x] Creative pass on the remaining sections: icon+hover-lift stat cards,
      numbered-corner service cards, icon badges on process steps, a
      glow/dot-grid treatment on the dark Why-Us and CTA panels, smooth
      anchor-link scrolling
- [x] **"Who We Serve" section** (`#customers`) — Fort Pharma PLC doesn't
      only import, it sells directly to local customers: four segment cards
      (Pharmacies & Drug Stores, Hospitals & Clinics, Wholesalers &
      Distributors, Retail Customers). Copy updated throughout (hero,
      Why-Us, Process's last step renamed "Distribution & Sales") to say
      import **and sell**, not import-only. Ticker gained a second,
      reverse-direction row listing who products are sold to. Floating
      back-to-top button added.
- [x] `frontend/src/components/marketing/decorative.tsx` — floating
      pharma-themed background icons (capsule, tablet, bottle, medical
      cross) at three density/color variants (Hero, Services, CTA banner),
      slow-bobbing via a new `animate-float` keyframe, `-z-10` and
      `pointer-events-none` so they never interfere with content. Hero's
      trust line became icon badges; primary CTA arrows now slide on hover.
- [x] `frontend/src/components/marketing/hooks.ts` — `useReveal` (scroll
      reveal) and `useCountUp` (eased count-up, starts once the stat
      scrolls into view)
- [x] Real Google Maps embed (`output=embed`, no API key) + "Get
      directions" link, both pointed at Fort Pharma PLC's actual
      coordinates (9.0572416, 38.7138769) from the Google Maps listing the
      user provided
- [x] `frontend/src/app/page.tsx` renders `<Homepage />` for guests instead
      of redirecting to `/login`; still redirects authenticated users to
      `/dashboard`
- [x] Added marketing icon set (globe, mail, phone, check, arrowRight,
      clock, x, star, beaker, heart, snowflake) to `components/icons.tsx`
- [x] Self-hosted Inter font via `next/font/google`, wired as `font-sans`
      through a Tailwind v4 `@theme` block
- [x] Verified: `tsc --noEmit` clean; `/` and `/login` both return 200; SSR
      output for the homepage checked directly (temporarily bypassed the
      client-side auth gate) to confirm all sections — including the new
      globe/map graphic and ticker — render with no runtime errors

**Note:** contact details (address, phone, email) and stats (countries,
years in operation, etc.) in `homepage.tsx` are placeholders — replace with
the company's real figures before this goes live.

---

## Phase A8 — Login Page Redesign

- [x] `frontend/src/app/login/page.tsx` rebuilt as a split layout: a dark
      branded panel (desktop only) with the Fort Pharma PLC logo, headline,
      three feature highlights and the homepage's `FloatingPharmaIcons`
      background; the form side keeps a "FortInventory Portal" badge,
      icon-prefixed inputs, a show/hide password toggle, an icon error
      banner, a spinner in the submit button, and a "back to homepage" link
- [x] No fake "Forgot password?" link — no reset-password endpoint exists
      on the backend, so the form has a "contact your administrator" note
      instead of linking to a feature that doesn't work
- [x] `components/ui/loading.tsx` `Spinner` gained an optional
      `colorClassName` prop (default unchanged) so it can render white on
      a dark button; existing call sites unaffected
- [x] Verified: `tsc --noEmit` clean; `/login` returns 200; SSR-bypass
      check confirmed the full form (brand panel, highlights, password
      toggle) renders with no runtime errors

---

## Phase A9 — Responsiveness Pass (whole system)

Full audit + fixes across the public site and the internal app, targeting
mobile (~375px), tablet (~768px) and desktop (1024px+). The public homepage
and login page were already built responsively (Phases A7/A8); this phase's
real gap was the internal app, which had no mobile navigation at all.

- [x] **`(app)/layout.tsx` — mobile off-canvas sidebar.** Previously the
      256px/64px sidebar was always on-screen with zero mobile handling,
      leaving almost no room for content on a phone. Now: below `md` the
      sidebar is a `fixed` full-width (`w-64`) overlay that slides in via
      `-translate-x-full` → `translate-x-0`, with a `bg-slate-900/40`
      backdrop (click to close) and a header hamburger button
      (`md:hidden`) to open it; it auto-closes on route change. At `md`+ it
      reverts to exactly its previous sticky, collapsible-to-icon-rail
      behavior — desktop/tablet users see no change. A new `railCollapsed
    = isDesktop && collapsed` (tracked via a `matchMedia('(min-width:
    768px)')` listener) replaces the old bare `collapsed` check so the
      icon-only rail treatment can never leak onto the mobile overlay.
- [x] **Dashboard's 3 unwrapped tables** (Top Moving Products, Recent
      Sales, Top Customers) — found via a repo-wide sweep for `<table>`
      without an `overflow-x-auto` ancestor; every other page's tables
      already had it from the Phase A5 sweep, dashboard's three were
      missed. Fixed the same way.
- [x] **`components/ui/popover.tsx`** `usePopoverPosition` gained an
      optional `panelWidth` param: Combobox's dropdown already matches its
      trigger's own width so it can never overflow the viewport, but
      `DatePicker`/`DateRangePicker`'s calendar panel is a fixed 288px
      (`w-72`) regardless of trigger width or position — on a narrow
      screen a trigger sitting anywhere in a filter bar with less than
      288px of space to its right would push the panel off-screen. Now
      clamped: `left` is kept within `[8px, viewportWidth - panelWidth -
    8px]`. Both date pickers pass `panelWidth={288}`.
- [x] Repo-wide sweep for other common mobile pitfalls (unqualified
      `grid-cols-3+`, fixed pixel widths, `flex` header rows without
      `flex-wrap`) — none found beyond the two issues above; the app's
      existing table/filter-bar/grid conventions were already responsive
      from earlier phases.
- [x] Verified: `tsc --noEmit` clean; all 16 pages (public + internal)
      return HTTP 200 against a freshly restarted dev server (the
      previous one had stopped since the last phase). Confirmed via the
      established SSR-bypass technique for the public pages; internal app
      pages are gated behind client-side JWT auth (localStorage, not
      cookies) so their SSR output is always the loading shell regardless
      of the request — HTTP-200 status is the correct and sufficient
      check for those, consistent with every prior phase's verification.

**Not covered:** did not add touch/tap support to `TrendChart`'s hover
tooltip (`components/ui/charts.tsx`) — it's mouse-hover-only, a pre-existing
gap from Phase A4, not something introduced or fixed in this pass. No
browser was available to visually confirm at each breakpoint; this pass was
verified by code/class review plus the checks above, not screenshots.

---

## Phase A10 — Inter-location Stock Transfer

First item picked off the backlog above. Lets stock move from one location
to another as a single traceable transaction, instead of a manual
decrease-here/increase-there workaround.

- [x] **Schema**: `StockTransfer` (transferNumber, fromLocation,
      toLocation, notes, performedBy) + `StockTransferItem`
      (product/batch/quantity), mirroring the existing
      `GoodsReceipt`/`GRVItem` pattern. Migration `stock_transfers`.
- [x] **`POST /api/inventory/transfer`** — atomic: for each item, calls
      the existing `applyMovement` twice inside one `$transaction` (a
      `TRANSFER_OUT` at the source, a `TRANSFER_IN` at the destination,
      both tagged with the same `TRF-00001`-style number in their
      `remark`), so a batch's stock and the bin card/audit trail stay
      consistent using the same primitive every other stock-moving
      endpoint already uses. Rejects same-location transfers; insufficient
      stock at the source rolls the whole transaction back (verified — a
      failed transfer leaves quantities untouched).
      `GET /api/inventory/transfers` lists transfer history, sortable.
      Reused the existing `inventory.view`/`inventory.adjust` permissions
      — no new permission or role-seed changes needed.
- [x] **Frontend**: a "Transfer" row action next to "Adjust" on the
      Inventory page (only shown once a second location exists) opens a
      Drawer — destination location, quantity (capped at what's on hand),
      optional notes — mirroring the existing Adjust drawer's UX exactly.
      Audit Trail's type filter/labels gained "Transfer in"/"Transfer
      out".
- [x] Verified: `tsc --noEmit` clean; full API smoke test (create a
      second location, transfer 50 units, confirm both locations' stock,
      confirm both movement rows with correct remarks, confirm
      same-location and insufficient-stock are rejected with no partial
      effect, confirm the list endpoint); all 16 pages HTTP 200.

---

## Phase A11 — Automated Restocking Recommendations

Second (and last, for now) backlog item. Turns the existing reactive
low-stock *alert* into an actual *recommendation* — a suggested reorder
quantity, grounded in real demand where there's history for it.

- [x] **`alerts.controller.js`**: new `suggestReorder(product, currentQty,
      dispensedRecent)` — target stock is `max(last-30-days-dispensed,
      product.maxStock ?? minStock × 2)`, suggested qty is that target
      minus what's on hand (floored at 0). The 30-day dispensed figure
      comes from one `stockMovement.groupBy(['productId','locationId'])`
      query (not N+1 per-product queries), reused for every LOW_STOCK
      alert in the same request. Every `LOW_STOCK` alert object now
      carries `suggestedReorderQty` and `recentDailyUsage` — both of the
      existing code paths that produce `LOW_STOCK` (products with some
      stock below minimum, and products at zero stock with no `Stock` row
      at all) were updated, since only enriching one would have made
      out-of-stock products — the most urgent case — silently miss a
      recommendation.
- [x] **Frontend** (`alerts/page.tsx`): under a `LOW_STOCK` alert's detail
      text, a line reading e.g. "Suggested reorder: 1950 Strip · ~10.5/day
      recent usage" — shows the number **and** the reasoning behind it,
      not just a magic figure. No new page, no new nav item — reuses the
      alert list that was already there.
- [x] Verified: `tsc --noEmit` clean; live-data check against the two
      LOW_STOCK alerts already present (one with real dispense history,
      one without) confirmed the arithmetic by hand for both branches of
      the `max()`; confirmed the unfiltered `/api/alerts` endpoint's
      counts are unaffected (`EXPIRED`/`EXPIRING`/`OVER_STOCK`/
      `ADJUSTMENT` logic wasn't touched); all 16 pages HTTP 200.

**Not built (deliberately, to keep this step scoped):** a "generate a PO
from this suggestion" shortcut linking Alerts → Procurement. The
recommendation now exists and is visible; turning it directly into a
purchase order is a natural next increment if wanted.

---

## Phase A12 — Manual-Testing Bugfix Pass

Eight issues reported from a full manual test pass over the internal
system, all fixed in one pass. Full detail in `HISTORY.md`; summary here:

- [x] All internal-app forms use toast for validation errors instead of
      the browser's native popup (`noValidate` on every `<form>`, so the
      existing backend-error → `toast.error` wiring actually runs).
- [x] Deactivated suppliers/products/locations excluded from every
      *creation* dropdown (PO/product/sale forms) while still visible in
      *filter* dropdowns and management tables, where hiding them would
      hide history.
- [x] Country of Origin is a searchable list of real countries
      (`lib/countries.ts` + `Combobox`), not free text.
- [x] New `components/ui/select.tsx` — a house-built dropdown matching
      `Combobox`'s look/keyboard behavior — replaces every native
      `<select>` in the app (~25 instances).
- [x] Procurement/sales line items must have `unitCost`/`unitPrice`
      `> 0`, not `>= 0` (backend + matching frontend `min` attributes).
- [x] Bulk product import errors now include the actual offending cell
      value, and the frontend shows every failed row (not just 5).
- [x] Sorting added everywhere structurally sensible (procurement's 3
      tables, Alerts client-side). Left off Bin Card and the Reports
      daily table on purpose — both are ordered narratives (a running
      balance ledger, a dated report with a total footer), not browsable
      lists.

---

## Public Homepage — Removed

The public marketing homepage built in Phase A7 (`components/marketing/homepage.tsx`,
`globe-map.tsx`, `hooks.ts`) was removed at the user's request — the system no longer
needs a public-facing marketing site. `/` now redirects straight to `/dashboard` (signed
in) or `/login` (signed out). `decorative.tsx` (`FloatingPharmaIcons`) was kept since the
login page's background still uses it. Full detail in `HISTORY.md`.

---

## Backlog — Remaining Work

Found via a full pass over every module in `requirnment.md` against the
actual backend/frontend code (2026-07-17), not just re-checking the
adjustment punch lists. The system is otherwise remarkably complete — PDF
reports, Excel import/export, withholding tax, attachments, and the full
audit trail are all genuinely wired end-to-end, not stubbed. Nothing below
is started; this is a list to pick from, not a plan.

### High-value gaps

1. **No self-service account management.** A logged-in user of any role
   can't change their own password or view/edit their own profile — only
   an Admin can reset someone else's password, via Users management. No
   `/profile` page; no backend endpoint for it (`auth.routes.js` only has
   `login` / `refresh` / `me`).
2. **No partial PO receiving.** `orders.controller.js`'s `receive()`
   rejects any purchase order whose status isn't `OPEN`, and a successful
   receive immediately flips it to `RECEIVED` — permanently. The schema
   (a PO can have many `GoodsReceipt`s) and the per-line quantity override
   already look designed for partial receipts, but there's no way to
   receive a second shipment against the same PO. Realistic friction for
   a company importing from multiple countries with staggered shipments.

~~No inter-location stock transfer~~ — done, see Phase A10.
~~No automated restocking recommendations~~ — done, see Phase A11.

### Lower priority

3. **No forgot-password / email reset flow.** Known since the login
   redesign — the system has no email-sending capability at all, so this
   would mean adding SMTP integration from scratch, not just a form.
4. **No dedicated Customer management page.** Customers are quick-created
   inline during dispensing (Phase A4) and are only otherwise visible via
   "Top Customers" on the dashboard and the customer name on a sales
   order. No edit/merge/deduplicate UI. Not in the original written spec
   — an organic addition, so lower priority than items 1–2.

---

## Build Order Rationale

Auth first because every other module needs users/permissions. Locations,
suppliers and products are master data that inventory depends on. Stock and
movements (Phase 4) are the core — procurement writes stock **in**, dispensing
writes stock **out**, and alerts/reports/dashboard just read what those wrote.
