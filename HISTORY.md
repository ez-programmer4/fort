# FortInventory — Build History

Chronological log of everything done on the system. Newest entries at the top.
Each entry: date, phase/module, what was done, and any decisions made.

---

## 2026-07-16 — Phase A7 polish: real orthographic globe, side-by-side hero, creative pass

**Phase:** A7 follow-up — the user asked for the globe itself to use a real world map (not the abstract wireframe sphere from the previous pass), for the graphic to sit to the right of the hero text instead of stacked below it, and for more creativity across the rest of the page's sections.

**Done:**
- **Real orthographic globe**: `globe-map.tsx` was rebuilt around a proper 3D-looking globe generated the same way as the Ethiopia outline — `world-atlas` (`countries-110m`) land data + `topojson-simplify` (to keep the path light — full-detail land was ~46KB, simplified down to ~23KB) run through `d3-geo`'s orthographic projection (centered ~42°E, 17°N so China, India, Germany, UAE and Ethiopia are all simultaneously on the visible hemisphere — confirmed by computing each point's angular distance from the center), clipped to a circle. Ethiopia is drawn a second time on top of the generic land layer, filled in the accent blue, so it reads as the highlighted destination on an otherwise real, recognizable world map — not a separate cutout shape next to the globe like before. Origin markers and the Addis Ababa pin are now real projected coordinates through this same projection (so they land in their true positions on the map), with flight-path arcs curving between them exactly as before. As with the Ethiopia outline, `world-atlas`/`d3-geo`/`topojson-simplify` were only used to generate the static paths once; nothing ships to the browser but the resulting SVG.
- **Hero layout**: restructured from a stacked (text-above, graphic-below) layout back to a side-by-side `md:grid-cols-2` layout — headline/copy/CTAs on the left, the globe on the right, matching the classic split-hero pattern the user asked for.
- **Creative pass across the rest of the page**:
  - Stats cards gained icons (globe/box/clock/check), borders, and a hover lift, instead of being bare numbers on a flat background.
  - Services cards gained a large faint "01/02/03" numeral in the corner (editorial-style, sits behind the content via `-z-10`) for visual rhythm now that there are only three cards.
  - Process steps gained per-step icons (globe/shield/truck/mapPin) in a circular badge with the step number overlaid, replacing the plain numbered circle.
  - The dark "Real-time inventory technology" panel (Why Us) and the CTA banner both gained a soft blue glow (blurred, semi-transparent circle) plus a faint dot-grid texture, echoing the hero's background pattern instead of being flat slate-900.
  - Contact info cards gained the same hover-lift + accent-on-hover treatment as the services/stats cards for consistency.
  - Added `scroll-behavior: smooth` site-wide so the nav's anchor links (`#services`, `#process`, etc.) scroll smoothly instead of jumping.

**Verified:** `tsc --noEmit` clean; `/` and `/login` both return HTTP 200; same SSR-bypass check as prior passes confirmed the new globe (including its `clipPath`/`globeClip` mask and the "Addis Ababa" label) and every section render with no runtime errors.

---

## 2026-07-16 — Phase A7 correction: real Ethiopia outline + real product categories

**Phase:** A7 follow-up — the user pointed out the hero's Ethiopia shape wasn't real ("i need the map real then current is not real" — the hand-plotted low-poly polygon from the previous pass didn't actually resemble the country), and that the invented six-category services list didn't match reality: the company imports exactly three types — **Medication, Equipment, Cosmetics**.

**Done:**
- **Real Ethiopia outline**: replaced the hand-plotted polygon in `globe-map.tsx` with one extracted from actual boundary data. Used `world-atlas` (`countries-50m.json`, Natural Earth-derived TopoJSON) + `topojson-client` in a throwaway scratchpad script — pulled Ethiopia's feature by ISO-3166 numeric code `231`, simplified its ~300-point ring down to 90 points, and projected it (equirectangular, aspect-ratio preserved) into the hero's existing SVG coordinate space. Addis Ababa's pin was re-projected the same way from its real coordinates (9.0572416, 38.7138769), landing almost exactly where the old placeholder pin was (627,211 vs. 624,210) — confirming the original layout math was sound, just the outline itself was fake. `world-atlas`/`topojson-client` were only used to *generate* the static path once; the result is hardcoded into the component, so no map library ships to the browser.
- **Real product categories**: `SERVICES` in `homepage.tsx` now lists the company's actual three import categories — Medication (`beaker` icon), Equipment (`gear` icon), Cosmetics (new `sparkles` icon added to `components/icons.tsx`) — each with a short description and a few example-product tags (e.g. Medication: antibiotics, analgesics, chronic-disease therapies, OTC). Grid simplified from a 6-card `sm:grid-cols-2 lg:grid-cols-3` layout to a 3-card `sm:grid-cols-3` layout, with slightly larger cards to fill the space now that there are fewer of them.

**Verified:** `tsc --noEmit` clean; `/` and `/login` both return HTTP 200; same SSR-bypass check as prior A7 passes confirmed the real polygon renders (spot-checked the emitted `<polygon points>` against the extracted data) and all three category names + their example tags render, with no runtime errors.

---

## 2026-07-16 — Phase A7 enhancement: globe/map hero, real map, rebrand to Fort Pharma PLC

**Phase:** A7 follow-up — user asked for a more creative homepage (not the generic SaaS-landing look), specifically: an animated globe-to-Ethiopia-map graphic on the hero, and the real business location integrated via Google Maps. They also shared their Google Maps listing, which showed the actual registered business name is **Fort Pharma PLC**, not FortInventory (that's the internal software).

**Done:**
- **Rebrand**: the public homepage now presents as Fort Pharma PLC (navbar, footer, page metadata) with FortInventory repositioned as "our internal inventory platform" — mentioned in the Why Us section and still the name on the staff login portal. Confirmed this split with the user before making the change.
- **`components/marketing/globe-map.tsx`** (new): a hand-built SVG hero illustration — a wireframe globe (meridian/parallel bezier curves) with four pulsing origin markers (China, India, Germany, UAE), animated dashed "flight path" arcs from each origin to a hand-plotted low-poly Ethiopia outline, each path with a small dot travelling along it via native SVG `<animateMotion>` (staggered `begin` offsets so shipments don't all move in lock-step), landing on a pulsing Addis Ababa pin. Ethiopia's outline is a decorative, hand-plotted low-poly polygon (not survey-accurate) — good enough to read as "Ethiopia" alongside the label and pin, without pretending to be a precise map. No chart/mapping library — pure SVG + two CSS keyframes (`dash-flow`, `pulse-ring` in `globals.css`, both disabled under `prefers-reduced-motion: reduce`).
- **Real Google Map integration**: the Contact section now embeds an actual Google Map (`maps.google.com/maps?q=<lat>,<lng>&z=16&output=embed`, no API key needed) centered on Fort Pharma PLC's real coordinates (9.0572416, 38.7138769) taken from the Google Maps listing the user linked, plus a "Get directions" link straight to that listing.
- **Motion/polish pass**: `components/marketing/hooks.ts` (new) — `useReveal` (IntersectionObserver-based scroll-reveal, fires once) and `useCountUp` (eased count-up animation, starts when the stat scrolls into view) — wired into every major section (fade+slide up, staggered per card/step) and the four hero stats (15+ countries, 500+ products, 8 years, 99% on-time clearance now animate up from 0). Added a country-sourcing marquee ticker strip below the hero (auto-scrolling, pauses on hover, seamless loop via a duplicated list + `translateX(-50%)`).
- Contact form and other Phase A7 structure (services grid, 4-step process, why-us, CTA banner, footer) unchanged from the initial pass — see the entry below.

**Verified:** `tsc --noEmit` clean; `/` and `/login` both return HTTP 200. Same SSR-bypass technique as the initial A7 verification (the homepage is normally hidden behind a client-side auth check, so a plain `curl` only sees the SSR "Loading…" shell) — confirmed all new content (Fort Pharma PLC branding, "ETHIOPIA"/"Addis Ababa" labels from the SVG, the map iframe, all four sourced-from-country ticker entries) renders with no runtime errors, then reverted the bypass.

**Still placeholder:** the street address, phone and email in `CONTACT` (`homepage.tsx`) are still placeholders — only the map coordinates and directions link are real, taken from the Google Maps listing the user shared.

---

## 2026-07-16 — Phase A7 complete: Public Homepage

**Phase:** A7 — public marketing homepage for FortInventory, the pharmaceutical import/distribution company. Requested directly (not from `adjustment_requirnment.md`): "need to add homepage for them ... figma like ui/ux with more aesthetic and professional."

**Done:**
- **New `frontend/src/components/marketing/homepage.tsx`**: a full public landing page — sticky navbar with a mobile menu; hero with headline/CTA and a "shipment overview" visual panel; a stats strip; a "what we import" services grid (prescription pharmaceuticals, OTC, consumables, equipment, cold-chain/vaccines, nutraceuticals); a 4-step "how we work" process; a why-us section that bridges to the internal FortInventory platform (real-time inventory technology) as a trust signal; a dark CTA banner; a contact section (info cards + a form that opens a prefilled `mailto:` — no backend endpoint exists for form submissions, so this was kept honest rather than faking a success state); and a footer with a "Client Portal" link into `/login`.
- **`frontend/src/app/page.tsx`**: root `/` now renders the homepage for signed-out visitors instead of redirecting straight to `/login`; signed-in users still auto-redirect to `/dashboard` exactly as before.
- **`components/icons.tsx`**: added marketing-oriented icons (globe, mail, phone, check, arrowRight, clock, x, star, beaker, heart, snowflake) to the existing outline icon set.
- **Typography**: self-hosted Inter via `next/font/google` in the root layout, wired in as the `font-sans` stack through a Tailwind v4 `@theme` block in `globals.css` — used app-wide, not just on the homepage.
- **Design**: kept the established monochrome convention (slate-900/white, `rounded-lg`/`rounded-xl` cards, `focus-visible` rings) with blue as the single accent color, so the public site and the internal app read as one product.

**Note (placeholder content):** the address, phone, email and the four headline stats (countries sourced, products imported, years in operation, on-time clearance %) in `homepage.tsx` are placeholders — swap in the real figures before this is shown to real visitors.

**Verified:** `tsc --noEmit` clean; `/` and `/login` both return HTTP 200. Because `/` is gated behind a client-side auth check (`AuthProvider`'s `loading` state starts `true`, so the server-rendered shell always shows "Loading…" until the client resolves it — this is pre-existing behavior, not new), a plain `curl` couldn't exercise the real homepage markup. Temporarily bypassed the gate to confirm the homepage renders server-side with no runtime errors (all sections present — hero headline, services, process, CTA, contact — in the full ~41KB output vs. ~12KB for the loading shell), then reverted the bypass.

---

## 2026-07-16 — Phase A5 complete: Sales Print + Final Polish

**Phase:** A5 — Sales Print + Final Polish (§2.4) — last of the adjustment phases (A1–A5)

**Done:**
- **Backend**: `sales.controller.js` `list` now accepts optional `from`/`to` (same `YYYY-MM-DD` + invalid-date-→ 400 pattern as audit/bincard/wallet); pageSize cap raised from 100 to 500 so the print flow can pull a full filtered date range in one request.
- **Frontend — Sales History**: on-screen `DateRangePicker` next to the existing search box, scoping the table (and pagination) live — not just for print.
- **Frontend — Printable Sales History report** (`SalesHistoryReport` in `sales/page.tsx`): branded header (pharmacy name/address/phone from Settings), the active date range and search filter, summary line (order count, total, cash/credit split), a full order table (DSP no., date, location, customer, payment, total) with a totals footer, and a signature block — same visual language as the existing Dispense Slip and Bin Card. "Print Sales History" fetches every order matching the current filters (up to 500) before switching to the report view, so the printed list isn't limited to the on-screen page; `window.print()` triggers the browser print dialog.
- **Final consistency sweep**:
  - `roles/page.tsx` modernized — last page still on the pre-monochrome `text-slate-800` convention and inline error/success banners; now `text-slate-900`, `rounded-lg` (was `rounded-xl`, the only stray corner-radius in the app), `useToast()`, and a branded loading state
  - `focus-visible` rings added to every icon-only shared control that previously relied on the bare browser default: Drawer close button, Toast dismiss, SearchInput clear, Combobox clear
  - Fixed three wide tables with no horizontal-scroll wrapper that could overflow at tablet widths (`overflow-x-auto`, with `print:overflow-visible` on the two that also print): Bin Card's 9-column movement table, the Dispense Slip's item table, and the new Sales History report table; also wrapped the Dispense Summary's 8-column editable cart table

**Verified:** `tsc --noEmit` clean; all 15 pages HTTP 200; API smoke test on the new date filter — unfiltered vs. a range covering everything returned the same total, a future-only range returned 0, and an invalid date string correctly returned 400.

**Adjustment phases (A1–A5) are now complete.** The system has gone from an 11-phase functional build to a fully polished, professional UI: shared component library, pagination/search/drawers/comboboxes/date-pickers everywhere, alerts with dispose + product-details + urgency sorting, a real analytics dashboard (customers, profit trends, charts), and printable sales history — with a consistency pass to close it out.

---

## 2026-07-16 — Phase A6 complete: Post-launch Punch List

**Phase:** A6 — sidebar, popover rendering, and table sorting, reported after using the finished app.

**Done:**
- **Sidebar rebuild** (`(app)/layout.tsx`): the collapse toggle moved out of the top navbar into the sidebar itself — a "Collapse" row at the bottom of the rail with a double-chevron that flips 180° when collapsed. The sidebar is now `sticky top-0 h-screen`, so it and the header stay in place while only `<main>` scrolls (previously the whole page — sidebar included — scrolled with the body). Collapsed mode now shows a hover tooltip with the full label next to each icon (no more relying on the native `title` attribute alone). The user's name/role/sign-out moved into a sidebar footer above the collapse control, matching common professional dashboard layouts (Linear, Vercel, Notion) and freeing up the header to just show the current page title.
- **Popover clipping fix** — the real bug behind "date picker not properly rendered on procurement expiry date": `DatePicker`/`DateRangePicker` and `Combobox` positioned their dropdown with `absolute`, nested inside whatever container rendered them. Inside a Drawer's `overflow-y-auto` body or a table wrapped in `overflow-x-auto` (procurement's PO/GRV line-item tables), that ancestor clips the popover the moment it would overflow the scroll box — exactly what was happening with the expiry-date picker inside the receive-goods table. New shared `components/ui/popover.tsx` (`usePopoverPosition` + `PopoverPortal`) tracks the trigger's `getBoundingClientRect()` and portals the dropdown straight to `document.body` with `position: fixed` coordinates, escaping every ancestor's overflow/clipping context; it also flips upward automatically when there's no room below. Outside-click handling was updated to check both the trigger and the portaled panel. Both components were fully re-verified with `tsc`.
- **Column sorting, everywhere** — every paginated table now has clickable sortable headers: Locations, Suppliers, Users, Products, Inventory, all 3 Procurement tabs (Purchase Orders, GRV History, Other Purchases), Sales History, both Wallet tabs (Outstanding Credits, Payment History), and Audit Trail. New shared `useSort`/`SortableHeader` (`components/ui/sortable-header.tsx`) tracks the active column + direction and renders a neutral/up/down chevron; clicking a new column starts ascending, clicking the active one flips direction. This is server-side sorting (`?sortBy&sortDir`), not client-side, so it stays correct together with pagination — a new backend helper `utils/sort.js` (`parseSort`) turns those query params into a Prisma `orderBy` against a **per-endpoint whitelist**, so an unrecognized or malicious `sortBy` value can never reach the database (it silently falls back to the endpoint's default order). Relation sorts (e.g. product by supplier name, sale by customer name) are supported via a function form in the whitelist. Tabs with a different default table (Procurement, Wallet) reset to a sensible default sort key on switch.

**Verified:** `tsc --noEmit` clean throughout; all 15 pages HTTP 200; smoke-tested sorting directly against the API — products by unit price asc/desc (order correctly reversed), suppliers by name, inventory by quantity (396 → 250 → 45 → 10 → 2, correctly descending), and confirmed an invalid/malicious `sortBy` value doesn't error or affect the query, it just falls back safely.

---

## 2026-07-16 — Phase A4 complete: Dashboard Enhancements

**Phase:** A4 — Dashboard Enhancements (§2.2)

**Done:**
- **Schema**: new `Customer` model (name, phone, email) and an optional `DispenseOrder.customerId` FK — migration `20260716075137_phase_a4_customers` applied cleanly.
- **Backend — customers module**: `GET /api/customers?q=` (search, top 20) and `POST /api/customers` (quick-create, name required) — `customers.controller.js`/`.routes.js`, mounted at `/api/customers`.
- **Backend — sales**: `sales.controller.js` accepts an optional `customerId` on dispense creation (validated if present) and includes `customer` on every order response (list, getOne, create).
- **Backend — dashboard analytics**: new `GET /api/dashboard/analytics?period=7d|30d|90d|12m` (`dashboard.controller.js`), fully period-scoped and compared against the equivalent prior period:
  - **Profit overview** — total sales, COGS, gross profit, expenses, net profit/loss for the current and previous period, plus `trend.gross`/`trend.net` percentage change
  - **Top customers** — grouped by `customerId`, ranked by total spend, with order count and last-order date (walk-in/no-customer sales excluded)
  - **Chart series** — Sales vs Purchases and Gross/Net Profit trend, bucketed by day (7d/30d), week (90d) or month (12m); Top Products by margin and by volume (from `DispenseItem` aggregation); a fixed last-12-months Monthly Overview independent of the period selector
  - The existing `GET /api/dashboard` overview (stock value, today's sales, alerts, top movers, recent sales) is unchanged — analytics is additive, not a replacement
- **Frontend — Combobox**: added an optional `onCreate` prop — when set, a "+ Create '<term>'" row appears for unmatched search terms. Purely additive (undefined everywhere else), so no existing Combobox usage changed behavior.
- **Frontend — Sales page**: customer `Combobox` with quick-create in the Dispense Summary footer ("Walk-in" if left blank); customer name shown on the printed slip and as a new column in Sales History.
- **Frontend — chart components** (`components/ui/charts.tsx`): hand-built SVG `TrendChart` (up to 2 series, hairline gridlines, crosshair + tooltip, legend, direct end-labels) and `RankBars` (ranked horizontal bar list, value at the tip) — no new npm dependency. Followed the dataviz skill's procedure: form chosen per data job, categorical colors (`#2a78d6` blue / `#008300` green, slots 1–2 of the reference palette) validated with `scripts/validate_palette.js` against the app's white card surface — CVD separation, normal-vision floor and contrast all pass.
- **Frontend — Dashboard**: new "Performance Overview" section below the existing snapshot — a 7d/30d/90d/12m period-preset row (scopes everything below it, per the dataviz skill's filter-composition rule) driving one `/api/dashboard/analytics` call; 4 profit stat cards (Total Sales, Gross Profit with trend badge, Expenses, Net Profit/Loss with trend badge, red when negative); Sales-vs-Purchases and Gross/Net-Profit trend charts; Top-Products-by-Margin/Volume rank bars; a fixed Monthly Overview chart; and a Top Customers table.

**Verified:** `npx prisma migrate dev` applied without data loss; `tsc --noEmit` clean; all 15 pages HTTP 200; full API smoke test — created a customer, searched it, dispensed a sale with `customerId` attached, confirmed the customer appears correctly in `topCustomers` (1 order, correct total), confirmed `/api/dashboard/analytics` returns sane data for all four periods (correct bucket counts: 8/31/14/12 points for salesVsPurchases, always 12 for monthlyOverview), and confirmed customer-create validation (missing name → 400).

**Next:** Phase A5 — Sales print + final polish (printable sales history with date-range picker, on-screen date filter, final consistency sweep)

---

## 2026-07-16 — Phase A3 complete: Alerts Module Adjustments

**Phase:** A3 — Alerts Module Adjustments (§2.1)

**Done:**
- **Backend — Dispose action**: `POST /api/inventory/dispose` (`inventory.controller.js`/`.routes.js`), gated by `inventory.adjust`. Always a stock-out through the shared `applyMovement` service with a new `DISPOSE` movement type; reason is mandatory (400 without one). Stock, bin card and audit trail all update atomically, exactly like `adjust`.
- **Backend — product detail**: `GET /api/products/:id/detail` (`products.controller.js`/`.routes.js`) returns product identity + alert thresholds, current stock by batch/location, and the last 20 stock movements — powers the new product-details drawer.
- **Backend — alerts feed**: `DISPOSE` movements now flow into the existing Adjustments bucket alongside `ADJUST_INCREASE`/`ADJUST_DECREASE` (last 30 days), so a disposal is visible as an audit entry right after it clears the alert. Alerts are now sorted server-side by urgency: Expired → Low Stock → Expiring → Over Stock → Adjustments, and within each group by soonest-expiry / biggest-deficit-or-excess / most-recent.
- **Frontend — Alerts page rewrite**:
  - Clickable summary cards (one per alert type, icon + color + live count) that double as tab filters — click again to clear
  - SearchInput filters by product name, code or batch number (client-side over the live alert set)
  - Manual Refresh button with its own spinner, since alerts are computed live rather than cached
  - **Dispose** action on Expired/Expiring rows (permission-gated) opens a `ConfirmDialog` with an editable quantity (capped at what's on hand) and a required reason — mirrors the stock-adjustment UX
  - **Product Details Drawer** — click any product name to open a drawer with full product info, alert thresholds, current stock broken down by batch/location, and its 20 most recent movements
  - Adjustment-tab rows now show a colored sub-badge (Increased / Decreased / Disposed) so disposals stand out from ordinary adjustments
  - SkeletonRows loading, EmptyState for no-match/no-alerts, toasts for all outcomes — brings Alerts to full parity with the rest of the app after Phase A2
- **Audit Trail**: `DISPOSE` added to the movement-type label map ("Disposed")

**Verified:** `tsc --noEmit` clean; all 15 pages HTTP 200; smoke-tested end-to-end — disposed 5 units from an expired batch via the API, confirmed stock decremented (50→45), the movement appeared correctly labeled in both the Adjustments alert feed and `/api/inventory/movements?type=DISPOSE`, and the missing-reason case correctly returns 400

**Next:** Phase A4 — Dashboard enhancements (Customer entity, Profits Overview, Top Customers, charts, period selector)

---

## 2026-07-16 — Phase A2 complete: Roll-out Across All Modules

**Phase:** A2 — Roll-out Across All Modules (§1 applied)

**Done:**
- **Backend pagination** added (optional `?page&pageSize`, backward-compatible — no `page` still returns the full list): `suppliers.controller.js`, `users.controller.js` (both gained `q` search too; every other list endpoint — inventory, procurement orders/receipts/expenses, sales, wallet credits/payments, inventory movements — already supported it)
- **Suppliers** — Drawer form (bank accounts sub-list), Pagination, SearchInput, toasts, Delete + ConfirmDialog, SkeletonRows, EmptyState
- **Users** — Drawer form, Pagination, SearchInput, toasts, SkeletonRows, EmptyState
- **Products** — Drawer form (xl width, alert-thresholds section), Pagination, SearchInput, supplier Combobox, toasts, SkeletonRows, EmptyState; Excel import/export and template unchanged
- **Inventory** — Pagination, SearchInput, stock-adjustment Drawer, toasts, SkeletonRows, EmptyState
- **Procurement** (3 tabs) — New Purchase Order and Receive GRV forms moved into xl Drawers with product Combobox + DatePicker for expiry; Record Purchase (expense) in a md Drawer with supplier Combobox; per-tab SearchInput + Pagination; Cancel PO now uses a danger ConfirmDialog instead of a bare confirm
- **Sales & Dispensing** — stock picker now uses SearchInput (debounced) with a branded SkeletonRows loading state; Sales History gained SearchInput + Pagination; toasts throughout; dispense summary/confirm flow unchanged
- **Wallet** — DateRangePicker replaces native from/to inputs; SearchInput + Pagination on both Outstanding Credits and Payment History tabs; Record Payment moved into a Drawer; toasts
- **Audit Trail** — SearchInput, DateRangePicker (backend already supported `from`/`to`), Pagination, SkeletonRows, EmptyState
- **Reports** — DateRangePicker replaces native from/to inputs; skeleton loading for both the finance summary and the sales table

**Verified:** `tsc --noEmit` clean; all 15 app pages render HTTP 200 (dashboard, alerts, products, inventory, bincard, procurement, sales, wallet, reports, audit, locations, suppliers, users, roles, settings); smoke-tested paginated APIs (suppliers, users, wallet credits, wallet payments, inventory movements) — correct `{items, total, page, pageSize}` shape and unpaginated fallback still intact for dropdown consumers

**Next:** Phase A3 — Alerts module adjustments (Dispose action, search/filter, clickable product-details drawer)

---

## 2026-07-16 — Phase A1 complete: Shared UI Component Library

**Phase:** A1 — Shared UI Component Library

**Done** (`frontend/src/components/ui/`):
- **Drawer** — right slide-in panel (250 ms ease-out, overlay, Esc/overlay close, body-scroll lock, md/lg/xl widths) — replaces modals for Add/Edit (§1.2)
- **Pagination** — rows-per-page 10 (default)/25/50/100, range info, prev/next (§1.1)
- **SearchInput** — 350 ms debounce, fires only for empty (reset) or 2+ chars, search icon + clear button (§1.3)
- **DatePicker + DateRangePicker** — custom Monday-first calendar popover, month navigation, today ring, range highlighting, two-click range with auto-swap, clear/Today, outside-click + Esc close (§1.4)
- **Combobox** — searchable select: type-to-filter (client) or debounced `onSearch` (server), arrow-key navigation, Enter/Esc, sublabels, clear (§2.3)
- **LoadingScreen** (branded FortInventory + spinner), **Spinner**, **SkeletonRows** (§1.6)
- ➕ **ToastProvider/useToast** — bottom-right stacked toasts (success/error/info), auto-dismiss 4.5 s
- ➕ **ConfirmDialog** — centered confirm for destructive actions with danger variant
- ➕ **EmptyState** — friendly empty tables with optional call-to-action
- Wired: ToastProvider in root layout; branded LoadingScreen replaces the plain "Loading…" in the app shell
- Backend: `GET /api/locations` now supports optional `?page&pageSize` (returns `total`; without `page` still returns the full list for dropdown consumers)
- **Pilot pages:** Locations fully converted (drawer form, pagination, debounced search, toasts, delete with ConfirmDialog, skeleton rows, empty state); Bin Card uses the product Combobox + DateRangePicker

**Verified:** paginated + unpaginated locations API both work; `tsc --noEmit` clean; locations/bincard/dashboard render (HTTP 200)

**Next:** Phase A2 — roll the components out across all modules

---

## 2026-07-16 — Adjustment phase planning (v1.1)

**Phase:** Planning — Adjustments & Enhancements

**Done:**
- Pushed phases 5–10 to GitHub (`ee4e03e..5c327da`, github.com/ez-programmer4/fort)
- Received [adjustment_requirnment.md](adjustment_requirnment.md) (v1.1, 2026-07-16)
- Planned 5 adjustment phases in [BUILD_PLAN.md](BUILD_PLAN.md):
  - **A1** — shared UI component library: Drawer, Pagination (10/25/50/100), debounced SearchInput, custom DatePicker (single+range), Combobox, branded loading; added Toasts, ConfirmDialog, EmptyState
  - **A2** — roll the components out across every module (tables, forms, searches, selects, date inputs)
  - **A3** — alerts: Dispose action (new DISPOSE movement), search/filter, clickable product details drawer
  - **A4** — dashboard: profits overview with trends, Top Customers (requires new optional Customer capture at dispensing), real-time charts (sales vs purchases, profit trends, top products by margin/volume, monthly overview), period selector
  - **A5** — printable sales history with date range + final consistency sweep

**Decisions:**
- Component library first (A1) so every later phase reuses the same primitives
- Top Customers requires a Customer entity — v1.0 sales have no customer; will add optional customer capture in the dispense flow (A4)
- Charts will be built with a monochrome palette to match the UI

**Next:** Phase A1 — Shared UI Component Library

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
