# FortInventory — Build History

Chronological log of everything done on the system. Newest entries at the top.
Each entry: date, phase/module, what was done, and any decisions made.

---

## 2026-07-20 — Customer: TIN and business license (number + document upload)

**Phase:** user asked to add TIN and a license — captured as a license number plus an uploadable license document, mirroring Supplier's existing `tin` field and the file-upload pattern already used for Sales attachments.

**Backend:**
- `Customer` gains `tin String?`, `licenseNumber String?`, and `licenseDocument Json?` (`{storedName, originalName, mimeType, size, uploadedAt}`, null until a file is uploaded) — migration `20260719213904_customer_tin_license`. `licenseDocument` is a single JSON blob rather than a full attachments table, since this is one "current license on file" per customer, not a list — same reasoning as `bankAccounts Json` already on this model.
- `customers.controller.js`: `validate()` extended for `tin`/`licenseNumber`. New `uploadLicense` (multer single-file upload to `uploads/customer-licenses/`, replaces — and deletes — any previous file rather than accumulating) and `downloadLicense`. `remove()` now also cleans up the license file from disk when a customer is deleted, closing a gap that would otherwise have left orphaned files behind.
- `customers.routes.js`: multer wiring (mirrors `sales.routes.js`'s pattern exactly), `POST/GET /api/customers/:id/license`, gated by `customers.manage`.

**Frontend (`customers/page.tsx`):** TIN input added next to Phone/Email. A new "Business license" section in the drawer: license number input, plus (for an existing customer only — a brand-new one has no ID to upload against yet) an upload/replace button and a download link when a document is on file. Upload/download handlers mirror the Sales page's attachment pattern (`FormData` POST; raw `fetch` + blob + programmatic `<a download>` for the authenticated download).

**Verified:** live API round-trip — create with `tin`/`licenseNumber` persists correctly; file upload → download returns the exact bytes; re-upload replaces the file and deletes the old one from disk (confirmed via directory listing before/after); delete cleans up. `node --check` on both backend files, `tsc --noEmit` clean, full 19-page HTTP-200 sweep.

---

## 2026-07-20 — Command palette: mobile support

**Phase:** follow-up — the palette's header trigger was `hidden sm:block`, so there was no way to open it on a phone at all (no physical keyboard for Ctrl/Cmd+K either).

**Done:**
- `layout.tsx`: `SearchTrigger` is now always visible in the header, not hidden below the `sm` breakpoint. The button itself already degraded gracefully to an icon-only tap target on narrow widths (text label and the "Ctrl K" hint were already `hidden sm:inline`), just needed its wrapper to stop hiding it.
- `command-palette.tsx` mobile-specific fixes:
  - Modal now anchors near the top on small screens (`pt-4` vs `sm:pt-24`) and caps its own height at `max-h-[85dvh]` with an internal flex layout (header fixed, results `flex-1 overflow-y-auto`) — leaves room for the on-screen keyboard instead of the results list getting pushed off-screen.
  - Input font bumped to `text-base` on mobile (`sm:text-sm` on desktop) — below 16px, iOS Safari auto-zooms the page on focus, a well-known mobile web input pitfall.
  - Added `autoComplete="off"`, `autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}` to the search input — without them mobile keyboards auto-capitalize every search term and autocorrect can mangle product codes/DSP numbers.
  - The "Esc" keyboard hint (meaningless without a physical keyboard) is hidden on mobile and replaced with a visible × close button, in addition to the existing tap-the-backdrop-to-close behavior.

**Verified:** `tsc --noEmit` clean, full 19-page HTTP-200 sweep, no rendered errors.

---

## 2026-07-20 — Global command palette (Ctrl/Cmd+K): search, navigate, quick actions

**Phase:** user asked for "quick functionality" — search-to-redirect, commands, and other quick access. Confirmed via AskUserQuestion: a global command palette (Ctrl/Cmd+K, like Linear/Notion/GitHub), searching across Products, Customers, Suppliers, and Sales (by DSP number), plus page navigation and quick-create actions.

**New shared component (`frontend/src/components/ui/command-palette.tsx`):**
- `CommandPaletteProvider` — wraps the app layout, owns the open/closed state, the global `Ctrl/Cmd+K` and `Escape` key listeners, and renders the modal itself. Exposes `useCommandPalette()` (an `open()` function) via context, and a `SearchTrigger` header button component that consumes it.
- **Actions**: a small curated list (New Sale, New Purchase Order, New Customer, New Supplier, New Product), each permission-gated and navigating to the relevant page — `?new=1` for the four that open a create-drawer/form.
- **Pages**: reuses the same nav list as the sidebar (passed in as a prop from `layout.tsx`, not duplicated), permission-filtered, fuzzy-matched against the typed term.
- **Records**: once 2+ characters are typed, fans out (debounced 250ms) to the existing `?q=` search endpoints on `/api/products`, `/api/customers`, `/api/suppliers`, and `/api/sales` in parallel — no new backend search endpoint needed, since all four already supported it. Selecting a record navigates to its list page with `?q=<term>` so the target page lands already filtered to that exact result.
- Full keyboard support: arrow keys + Enter across the combined result list (actions, pages, and records treated as one flat, ranked list), Escape to close, click-outside to close.

**Deep-link support added to the target pages** (`products`, `customers`, `suppliers`, `procurement`, `sales`): each reads `window.location.search` once in a post-mount `useEffect` (not a `useState` initializer, to avoid an SSR/hydration mismatch — this codebase has no existing `useSearchParams()` usage and that hook requires a Suspense boundary Next.js doesn't otherwise need here) and applies `?q=` to its search state and/or `?new=1` to open its create form. The Sales page additionally honors `?tab=history` so a DSP-number search lands on the History tab, not the New Dispense tab.

**Small supporting changes:**
- `SearchInput` (`components/ui/search-input.tsx`) gained an `initialValue` prop so a deep-linked search term is visible in the box, not just applied invisibly to the data — the internal "last fired" ref is seeded with `initialValue` too, so the box doesn't redundantly re-fire the same search 350ms after mount.
- New `search` icon added to `components/icons.tsx` (standard magnifying-glass path) — nothing existing fit.

**Verified:** `tsc --noEmit` clean. Confirmed all four fan-out search endpoints return the exact shape the palette expects, against real data (`products?q=para` → 3 Paracetamol batches; `customers?q=a` → 3 matches; `suppliers?q=med` → MedSupply PLC; `sales?q=DSP-00001` → DSP-00001). Full 19-page sweep clean, plus a separate sweep of every deep-link URL (`/products?q=para&new=1`, `/customers?new=1`, `/suppliers?q=med`, `/procurement?new=1`, `/sales?tab=history&q=DSP`) — all 200, no rendered errors.

---

## 2026-07-19 — Dashboard: second enhancement pass (location filter, trends, payment mix, location performance)

**Phase:** follow-up to the first dashboard enhancement pass — user asked to keep adding professional features.

**Backend (`dashboard.controller.js`):**
- `overview()`: added a previous-30-day comparison so Monthly Sales gets a trend badge (`sales.last30dTrend`, reusing the existing `pctChange()` helper — already module-scoped from the analytics section, so no duplication).
- `analytics()`: two new functions — `paymentMix()` (cash vs. credit totals/counts for the period) and `locationPerformance()` (revenue + order count grouped by location for the period, always computed since it's cheap; the frontend decides whether it's worth showing).

**Frontend (`dashboard/page.tsx`):**
- **Location filter**: the backend already accepted `locationId` on both endpoints but the UI never exposed it. Added a location `Select` (fetches `/api/locations` once) that re-scopes the entire dashboard — both the always-current KPIs and the period-scoped analytics — when changed.
- **Last updated + manual refresh**: a timestamp plus a refresh icon button that re-fires both the overview and analytics fetches on demand, without waiting for a state change to trigger a re-fetch.
- **Trend badge on Monthly Sales**: reused the existing `TrendBadge` component (already used on Gross/Net Profit) against the new 30-day-over-30-day comparison.
- **Payment Mix**: a Cash vs. Credit split — a simple two-segment horizontal bar plus a legend with counts and totals, deliberately not a new chart type (reuses the existing color tokens, avoids adding a pie/donut component for two categories).
- **Location Performance**: a `RankBars` panel ranking locations by revenue for the period — only rendered when there are 2+ locations with activity (comparing one location to itself is meaningless), so single-location deployments never see an empty/pointless panel.
- Extracted `loadOverview`/`loadAnalytics` into `useCallback`s (previously inline in `useEffect`) so the new refresh button can call the exact same fetch logic instead of duplicating it.

**Verified:** `node --check` on the controller. Live API checks confirm the location filter actually re-scopes results (stock value: 4,386.25 all-locations → 4,096.00 at Main Warehouse → 290.25 at Bole Retail Branch; Bole's last-30-day sales correctly 0). `paymentMix`/`locationPerformance` checked against real data. `tsc --noEmit` clean, full 19-page HTTP-200 sweep, no rendered errors.

---

## 2026-07-19 — Dashboard: professional enhancement pass (KPIs, Sales Overview, Top Products, Fast/Slow Movers, Alerts insights)

**Phase:** user asked for a richer, more professional dashboard: a specific 6-metric KPI row (Total Inventory, Monthly Sales, Unpaid Invoices, Low Stock, Expiring, Total Buyers), a "Sales Overview" with revenue and order-volume graphs, a "Top Products" view framed as fast movers by revenue, a dedicated "Fast Movers" (30-day top sellers) and "Slow Movers" (stock sitting idle — push or discount) view, and alerts surfaced with actual insights rather than just counts.

**Backend (`backend/src/modules/dashboard/dashboard.controller.js`):**
- `overview()`: added `sales.last30dTotal`/`last30dCount` (Monthly Sales), `unpaidInvoices: {count, totalOutstanding}` (same "total − sum of payments" computation Wallet already uses, applied across all CREDIT orders with an outstanding balance), `totalBuyers` (distinct customers with at least one order — via `groupBy` on `customerId`), `alertInsights` (top 5 Low Stock by severity, top 5 Expiring/Expired by days-to-expiry, top 3 Over Stock by severity — sliced from the alerts already computed by `buildAlerts()`, so no extra query cost), and `slowMovers` (in-stock products ranked by *least* 30-day sales quantity first, then by stock value — the "push or discount" candidates; needed expanding the existing `stocks` query's `select` to include product identity fields it didn't have before).
- `productStats()`: added a `byRevenue` ranking (revenue was already computed per product, just wasn't exposed as its own sorted list).
- New `salesOverviewSeries()`: revenue + order count per time bucket for the selected period. Kept deliberately separate from the existing `salesVsPurchasesSeries` (sales vs. purchases, both money) since order count is a different unit — per the project's charting convention, two measures of different scale get separate charts, never one dual-axis chart.
- `analytics()` now also returns `charts.salesOverview` and `charts.topProductsByRevenue`.

**Frontend (`frontend/src/app/(app)/dashboard/page.tsx`):**
- KPI row expanded from 4 to 6 cards, replaced with exactly the set requested: Total Inventory, Monthly Sales, Unpaid Invoices (→ Wallet), Low Stock (→ Alerts), Expiring (→ Alerts), Total Buyers (→ Customers) — each a clickable card, with a colored border (amber/red) when there's something to act on.
- "Top Moving Products" table replaced by an **Alerts & Insights** card (paired with the existing Recent Sales table): three mini-lists (Low Stock / Expiring & Expired / Over Stock) each showing the real detail text already generated by the alerts engine (e.g. "below this product's minimum of 1000 Strip", suggested reorder qty implied, days-to-expiry), with a badge per alert type and a "View all →" link to the full Alerts page; empty categories show "All clear."
- New **Sales Overview** section (period-scoped): two separate single-series charts — Revenue and Order Volume — rather than forcing both onto one dual-axis chart.
- **Top Products** section consolidated into one 3-column row: By Revenue (new) / By Margin / By Volume — all period-scoped, all `RankBars`.
- New **Fast & Slow Movers** section (fixed 30-day window, independent of the period selector, labeled as such): Fast Movers reuses `overview().topMovers`; Slow Movers is new, ranked by stock value with each row's 30-day sold count shown in the sublabel, framed explicitly as "push or discount" candidates.
- Removed now-dead code (`alertTotal` variable, superseded by the direct `alertCounts` KPI cards).

**Verified:** `node --check` on the dashboard controller. Live API checks against real data — `unpaidInvoices` (2 orders, 72.50 outstanding), `totalBuyers` (5), `alertInsights` (real low-stock/expiring/over-stock rows with correct detail text), `slowMovers` (correctly ranked a zero-30-day-sales product first). `analytics` endpoint checked across all four periods (7d/30d/90d/12m) — all 200. `tsc --noEmit` clean. Full 19-page HTTP-200 sweep, no rendered errors.

---

## 2026-07-19 — Sales: search-combo product picker replaces the browse table

**Phase:** user feedback — with many products, finding and adding items to a dispense order via the old "search box + scroll a table + click Add" flow was slow. Confirmed via AskUserQuestion: replace it (not add alongside) with the same fast search-combo pattern Procurement already uses for "Add products" on a Purchase Order; the "other additional" part of the request was about the same Sales screen, not a second page.

**Done:**
- `frontend/src/app/(app)/sales/page.tsx`: the New Dispense step's mobile card list + desktop scrollable table (each with its own "Add" button) is gone. In its place, a single "Add product" `Combobox` — type a product name, code, or batch number; the dropdown narrows (debounced, server-side via the existing `/api/inventory` search) and selecting a result adds it to the cart immediately, no extra click.
- Combo options are per-**batch**, not per-product, since dispensing must pick a specific batch — a product with multiple batches at a location shows one option per batch, each labeled with its batch no., quantity available, price, and an expiry hint (`45d left` / `EXPIRED`, reused from the old badge logic — `expiryBadge()` renamed to `expiryLabel()` and now returns plain text for the combo's sublabel instead of a JSX pill, since Combobox options are text-only).
- Batches already in the cart are filtered out of the dropdown so the same batch can't be added twice (previously handled by disabling/graying an "Added" button in the table).
- No backend changes — same `/api/inventory` endpoint, same response shape, same `addToCart` cart logic; this was purely a picker-UI change.

**Verified:** `tsc --noEmit` clean. Confirmed the inventory search response shape still matches what the combo expects (`batchId`, `code`, `genericName`, `brandName`, `dispenseUnit`, `unitPrice`, `quantity`, `batchNo`, `expiryDate`). Simulated the label/sublabel formatting against real data (`"Paracetamol (Panadol)"` / `"P-00001 · batch BN-2026-001 · 242 Strip · 12.50"`). Full 19-page HTTP-200 sweep, no rendered errors.

**Follow-up (same day):** user wanted the combo to sit behind an explicit "+ Add product" button rather than always being visible. Added an `addingProduct` toggle: the section shows a dashed "+ Add product" button by default; clicking it swaps in the search-combo (auto-focused so typing can start immediately) plus a small "×" button to collapse back to the button early. Added an `autoFocus` prop to the shared `Combobox` component (`frontend/src/components/ui/combobox.tsx`) to support this — focuses (and opens) the input on mount, reusable by any other button-revealed combo. Switching location also collapses the add-product UI, consistent with it already clearing the cart.

**Second follow-up (same day):** user clarified — after picking a product, the combo should collapse back to the "+ Add product" button immediately (not stay open for the next add). `pickProduct()` now also calls `setAddingProduct(false)` right after adding the line, so adding each subsequent item is an explicit "click Add product → search → select" cycle. `tsc --noEmit` clean, full 19-page sweep clean.

---

## 2026-07-19 — Withholding tax receipt tracking on the Withholding report

**Phase:** follow-up to the Withholding report (Phase A13) — user wants to track when the customer's withholding tax certificate/receipt is actually received back, with the receipt number, and have that status visible on the report.

**Done:**
- `DispenseOrder.withholdingReceiptNumber String?` and `withholdingReceivedAt DateTime?` — null until received, migration `20260719123209_withholding_receipt_tracking`.
- New `PATCH /api/sales/:id/withholding-receipt` (`sales.controller.js` `updateWithholdingReceipt`, gated by `finance.manage`, same permission used for Wallet payment recording): a non-empty `receiptNumber` records it as received (stamps `withholdingReceivedAt`); an empty one clears it back to pending — one endpoint handles both mark and un-mark, no separate undo route. Rejects with 400 if the sale has no withholding to track (`withholdingType === 'NONE'`).
- `finance.controller.js`'s `computeWithholding()` now selects and returns `withholdingReceiptNumber`/`withholdingReceivedAt` per row, plus a `receivedCount` in `totals`. PDF export gained a "Receipt" column (`Received: <no.>` or `Pending`) and a "Receipts received" summary line; table columns rebalanced to fit the 495px page-width budget.
- **Reports page, Withholding tab**: new "Receipt" column with a Received (green, shows receipt no.)/Pending (amber) badge, and — gated behind `hasPermission('finance.manage')`, mirroring Wallet's payment-recording UI — an "Actions" column with a "Mark received"/"Edit" button opening a `Drawer` form to enter the receipt number (blank + save clears it back to pending).

**Verified:** `tsc --noEmit` clean, `node --check` on all three modified backend files. Live API smoke test: marked a real withheld sale received (receipt no. persisted, `withholdingReceivedAt` stamped, report's `receivedCount` went 0→1), cleared it back to pending (fields nulled, `receivedCount` back to 0), confirmed the 400 rejection on a sale with no withholding, downloaded the PDF (valid 1-page PDF, 200 OK). Full 19-page HTTP-200 sweep, no rendered errors.

**Follow-up fix (same day):** the PDF's new 9-column table was garbled — the added "Receipt" column ran into "Net Total" with no gap, and any cell whose text was too wide for its column (a long receipt number, a long customer name, even the "Net Total"/"Withheld" headers themselves) wrapped to a second line that visually overlapped the row below. Root-caused in `backend/src/utils/pdf.js`'s shared `table()` helper (used by every report PDF, not just Withholding):
- pdfkit 0.19.1's own `ellipsis`/`lineBreak: false` text options were tested directly and confirmed to **not** suppress wrapping in this version — text still wrapped onto multiple lines regardless.
- Replaced with a manual `fitText()` that measures against `doc.widthOfString()` and truncates+ellipsizes character-by-character until it fits, plus a small per-column gap (`CELL_PAD`) so adjacent columns never touch, plus a small extra safety margin (pdfkit's actual line-wrap threshold sits ~1-2pt tighter than what `widthOfString()` reports, confirmed empirically — a string measured just under the box width still wrapped).
- Rebalanced the Withholding table's 9 column widths (measured real header/content widths — dates, 6-digit money, DSP numbers, "Received"/"Pending" — against the new fit-budget) so nothing that should normally fit gets needlessly truncated; only pathologically long input (e.g. an unusually long receipt number) now ellipsizes, which is the intended, non-overlapping fallback.

**Re-verified:** rendered the table in isolation with deliberately long test content (a 30-char customer name, a 27-char receipt number) — every cell stays on one line, no overlap, ellipsis kicks in only where genuinely necessary. Re-downloaded the live Withholding PDF — clean single-line rows, all headers fully legible. `node --check` clean, full 19-page sweep re-run clean.

---

## 2026-07-19 — Expenses split out of Procurement into its own page

**Phase:** user asked for Procurement's "Other Purchases" tab to become its own standalone page with a sidebar entry, named "Expenses".

**Done:**
- New `frontend/src/app/(app)/expenses/page.tsx` — the "Other Purchases" tab's content moved here wholesale (list, search, sort, pagination, the "Record Non-Sale Purchase" drawer form with description/category/supplier/amount/withholding), unchanged in behavior. Backend untouched — still `GET/POST /api/procurement/expenses`, same `procurement.view`/`procurement.manage` permission gates, since this was purely a frontend information-architecture change, not an API restructuring.
- `procurement/page.tsx` trimmed back to just Purchase Orders and GRV History: removed the `Expense` interface, `emptyExpense`, the `expenses`/`exp`/`expSaving`/`showNewExpense` state, `saveExpense()`, the expenses branch in `load()`, the "Other Purchases" `Tabs` entry, its table, and its Drawer. `Tab` type is now `'orders' | 'grv'`; the page's description line updated from "Purchase orders, goods receiving and non-sale purchases" to "Purchase orders and goods receiving."
- New sidebar nav entry "Expenses" (`/expenses`), positioned right after Procurement since that's where it came from, gated by the same `procurement.view` permission. New `banknotes` icon added to `components/icons.tsx` (Heroicons outline) since nothing existing fit — every other plausible icon was already claimed by another nav item.
- `TESTING_GUIDE.md`: removed the "9.3 Non-sale purchases" subsection from Procurement (replaced with a pointer to the new section), added a new "19. Expenses" section with equivalent test cases reworded for the new page.

**Verified:** `tsc --noEmit` clean. Live API check confirms `/api/procurement/expenses` still returns real data unchanged (2 existing expense records). Full 19-page HTTP-200 sweep (18 prior + the new `/expenses` route).

---

## 2026-07-19 — Customer credit rating (manual, backed by a payment-history summary)

**Phase:** follow-up to Customer management — user wants a rating to help decide whether to extend credit, surfaced during a Credit sale. Confirmed scope via AskUserQuestion: rating is **manual** (staff sets it), but backed by a **computed payment-history summary** so the decision isn't a guess; enforcement is **advisory only** — shown, never blocks the sale.

**Done:**
- `Customer.creditRating String @default("UNRATED")` — `UNRATED | GOOD | FAIR | POOR`, migration `20260719115738_customer_credit_rating`. Deliberately a plain string with an allow-list check in `validate()` (`RATINGS` const), matching how `withholdingType`/`paymentType` are already modeled elsewhere in this schema — not a Prisma enum, consistent with existing convention.
- New `GET /api/customers/:id/credit-summary` (`customers.controller.js`): pulls every `DispenseOrder` for that customer, splits out the `CREDIT`-type ones, and computes credit order count, fully-settled count, total credit extended, total paid, and current outstanding — the "detailed summary" staff use to decide what to set the rating to. Reachable by `customers.manage`, `sales.dispense`, or `sales.view` (same OR-permission pattern as the rest of the module), since it needs to be visible both in customer management and in the Sales dispense flow.
- **Customer management page**: new "Rating" column (colored badge — green/amber/red/gray), and inside the Add/Edit drawer (existing customers only, no history to show for a brand-new one) a payment-history panel — credit sales count, settled count, total extended, total paid, outstanding, last order date — sitting directly above the rating `Select`, so the data that should inform the decision is right where the decision gets made.
- **Sales dispense flow**: when `Payment = Credit` and a customer is picked, a small amber advisory panel appears — rating badge, current outstanding balance, "N/M past credit sales settled" — with an explicit "Advisory only — use your judgment" label. Does not block the sale regardless of rating, per the confirmed scope.

**Verified:** live API checks — new customer defaults to `UNRATED`; PATCH to `GOOD` persists; an invalid rating value (`EXCELLENT`) correctly rejected with `creditRating must be one of: UNRATED, GOOD, FAIR, POOR`; credit-summary against a customer with real order history (2 total orders, 1 credit order for 87.50, 40.00 paid) correctly computed `outstanding: 47.5`, `settledCount: 0`. `tsc --noEmit` clean, `node --check` on both modified backend files. Full 18-page HTTP-200 sweep.

---

## 2026-07-19 — Customer bank accounts (multiple per customer)

**Phase:** follow-up to Phase A13 — user asked for the same multi-bank-account capability Suppliers already has, on Customers.

**Done:**
- `Customer.bankAccounts Json @default("[]")` — new field, exact same shape as `Supplier.bankAccounts` (`[{ bankName, accountNumber }]`), same reason for `Json` over a relational table (a handful of unstructured pairs, no need to query into them). Migration `20260719114619_customer_bank_accounts`.
- `customers.controller.js`'s `validate()` gained the identical `bankAccounts` handling `suppliers.controller.js` already has: array check, trim each pair, drop empty ones.
- `customers/page.tsx`: new "Bank Accounts" table column (joined `bankName accountNumber` list, matching Suppliers' column exactly); the Add/Edit drawer gained the same repeatable bank-account rows section (+ Add bank account / Remove per row) as the Suppliers form, byte-for-byte the same interaction pattern.

**Verified:** live API round-trip — created a customer with two bank accounts, confirmed both persisted; updated to replace them with a different single account, confirmed the replacement (not an append) persisted correctly; cleaned up. `tsc --noEmit` clean, `node --check` on the controller. Full 18-page HTTP-200 sweep.

---

## 2026-07-19 — Phase A13: Withholding report + Customer management

**Phase:** client-requested — withholding tax tracking (by DSP no. and customer) as a report tab, plus a real Customer management page. Confirmed scope up front via AskUserQuestion: two separate features (not one), and the withholding report covers sales-side only (not procurement).

**Done:**
- **Withholding report** (`backend/src/modules/reports/finance.controller.js`): new `computeWithholding()`/`withholdingJson`/`withholdingPdf`, reusing the file's existing `parseFilters`/`locationName`/`pdf.js` helpers so it looks and behaves exactly like Finance/Sales. Queries `DispenseOrder` where `withholdingType != 'NONE'` within the date range/location filter, returning DSP no., date, customer name (`Walk-in` if none), location, subtotal, WHT type/rate/amount, and net total, plus aggregate totals. New routes `GET /api/reports/withholding` and `GET /api/reports/withholding.pdf`. Frontend: `reports/page.tsx` gained a third `Tabs` entry and a table matching the Sales Report tab's structure (DSP No./Date/Customer/Location/Subtotal/Rate/Withheld/Net Total + a totals footer row); `downloadPdf()` generalized from a two-way ternary to `/api/reports/${tab}.pdf` since there are now three tabs.
- **Customer management** (`/customers`, new page mirroring Suppliers exactly): search, sortable paginated table (Name/Phone/Email/Orders count/Added/Status/Actions), Add/Edit drawer, Activate/Deactivate, Delete-with-FK-guard (`P2003` → "has sales history — deactivate them instead", same pattern as Suppliers/Locations). Schema gained `Customer.isActive Boolean @default(true)` — migration `20260719113024_customer_active` — since the model had no active/inactive concept before this. `customers.controller.js` rewritten to the dual-mode list pattern (`?page` present → paginated management view with `_count.dispenseOrders`; absent → capped 20-row quick-search, unchanged shape for the existing sales-dispense combobox) plus `update`/`remove`. New `customers.manage` permission, seeded onto Admin (via `ALL`) and the Sales role; `customers.routes.js`'s existing `GET`/`POST` permission checks got `customers.manage` OR'd in additively — the quick-search/quick-create paths Sales-role users already used while dispensing keep working unchanged. New sidebar nav entry (`heart` icon, gated on `customers.manage`), placed between Sales and Wallet.
- Sales page's customer quick-search (`searchCustomers` in `sales/page.tsx`) now passes `?active=true`, excluding deactivated customers from the dispense-flow picker — the same "deactivated entities don't belong in creation dropdowns" fix applied to suppliers/products/locations earlier in the session, now extended to customers now that they have an active flag at all.
- Re-ran `prisma migrate dev` (had to stop all node processes first — the Windows query-engine-DLL EPERM issue noted throughout this project) and `npm run seed` (idempotent — safe to re-run, only touches Lookup/Permission/Role/RolePermission and upserts the admin user).

**Verified:** live API round-trip — admin token confirmed to carry `customers.manage` after reseeding; paginated list, create, deactivate, `?active=true` exclusion, and delete (with cleanup) all behaved correctly; withholding JSON returned real totals matching 3 existing withheld sales in the dev DB (`{count: 3, subtotal: 10050.5, withholdingAmount: 2003.26, total: 8047.24}`); withholding PDF downloaded with a valid `%PDF-` header (~26KB, consistent with the branded-logo header established earlier). `tsc --noEmit` clean; every modified backend file passes `node --check`. Full 18-page HTTP-200 sweep (the prior 17 plus the new `/customers` route).

---

## 2026-07-17 — The actual fix for the sidebar-hidden-by-mobile-toolbar bug

**Phase:** follow-up — the safe-area padding from the previous pass didn't fully fix it; user confirmed the sidebar's bottom was still hidden behind the phone's own bottom bar.

**Found:** the real cause was a different, more fundamental viewport bug. The `<aside>` used `h-screen` (`height: 100vh`) *together with* `inset-y-0` (`top: 0; bottom: 0`) — per the CSS spec, when `top`, `bottom`, and `height` are all set on a positioned element, `height` wins and `bottom` is ignored. On mobile browsers, `100vh` is the *static/largest* viewport size — as if the browser's own address/toolbar chrome were hidden — which is taller than what's actually visible whenever that chrome is showing. So the sidebar's box literally extended past the visible area, and its bottom content (the avatar/sign-out footer, and the safe-area padding added around it in the previous pass) rendered underneath the browser's bottom bar rather than above it. `env(safe-area-inset-bottom)` only accounts for OS-level chrome (notches, home indicators) — a completely different, smaller overlap than a mobile browser's own dynamic toolbar.

**Fix:** swapped `h-screen`/`min-h-screen` for `h-dvh`/`min-h-dvh` (dynamic viewport height — a standard Tailwind utility, widely supported) on the sidebar and the page's outer wrapper. `dvh` tracks the *currently visible* viewport and shrinks/grows live as the mobile browser's chrome shows or hides, so the sidebar's bottom edge — and everything in it — is never rendered behind unreachable/invisible space again.

**Verified:** `tsc --noEmit` clean. Page sweep still HTTP 200 across the internal app.

---

## 2026-07-17 — Fixed sidebar bottom hidden by mobile's system bar; added a header account menu

**Phase:** user reported the sidebar's bottom (the avatar/sign-out footer) gets covered by the phone's own bottom bar (home indicator / gesture pill), and asked for a user avatar + sign-out on the right side of the top header.

**Done:**
- **Safe-area fix**: the sidebar footer sat flush against the screen's bottom edge with a fixed `p-3`, so on notched/gesture-bar phones the OS chrome could visually overlap it. Added `paddingBottom: max(0.75rem, env(safe-area-inset-bottom))` (inline style, since Tailwind has no arbitrary-env utility) — resolves to the same 12px as before on ordinary screens, grows on devices that report a safe-area inset. Same technique already used for the Sales page's sticky mobile checkout bar.
- **Header account menu**: new avatar button on the right of the top header (`ml-auto`), visible at every breakpoint — initials circle always shown, name/role/chevron collapse away below `sm` to keep the mobile header tight. Click opens a small dropdown (name/role repeated inside it on mobile, since the trigger hides that text there) with a red "Sign out" action, closing on an outside click or route change. This gives mobile users sign-out access without opening the full off-canvas sidebar at all — directly addressing the footer-visibility problem from a second angle, not just the safe-area patch.
- The sidebar's own avatar/sign-out footer is unchanged and still there for desktop users who have it always in view.

**Verified:** `tsc --noEmit` clean. Full 17-page HTTP-200 sweep.

---

## 2026-07-17 — Logout icon: bigger, better-shaped, red on hover

**Phase:** follow-up — user asked for further style/layout enhancement on the logout icon after the tooltip pass.

**Done:**
- `(app)/layout.tsx`'s two sign-out buttons grew from a cramped `p-1.5` square with a 16px icon to a proper `h-8 w-8` (expanded row, matching the user avatar circle it sits beside) / `h-9` (collapsed rail, matching nav-row height) button with a 18–20px icon and `rounded-lg` — a real, consistent touch target instead of whatever the icon's intrinsic padding happened to produce.
- Added a red hover/focus state (`hover:bg-red-50 hover:text-red-600`, `focus-visible:ring-red-500`) — a standard convention (GitHub, Linear, Slack all do this) that visually flags sign-out as a distinct, session-ending action instead of blending in with neutral nav icons. Default (non-hovered) state stays neutral slate so it doesn't shout at rest.
- Tooltip pill kept neutral dark (unchanged from the previous pass) — only the icon/button itself picked up color, not the label.

**Verified:** `tsc --noEmit` clean. Full page sweep still HTTP 200.

---

## 2026-07-17 — Logout button: custom tooltip instead of the native browser one

**Phase:** user asked for a more professional logout affordance — standard icon (already the case — `logout` is the standard Heroicons arrow-out-of-a-doorway glyph) with a proper tooltip instead of whatever's there.

**Done:**
- `(app)/layout.tsx`'s two sign-out buttons (expanded-sidebar footer, and the icon-only rail in collapsed mode) relied on the native `title` attribute — the plain, delayed, OS-styled browser tooltip, inconsistent with the app's own dark-pill tooltip already used for collapsed nav-item labels. Swapped both to that same custom tooltip pattern (`group`/`group-hover:opacity-100`, `bg-slate-900` pill, `shadow-lg`): the expanded button's tooltip opens above-right (`bottom-full right-0`, since it sits at the very bottom of the screen), the collapsed rail's opens to the right (`left-full`, identical positioning to the nav-item tooltips it sits right above). `title` replaced with `aria-label` on both so screen readers still get the accessible name.

**Verified:** `tsc --noEmit` clean. Page sweep still HTTP 200 across the internal app. Confirmed no other logout UI exists elsewhere in the app (grepped the whole frontend) — this was the only place to change.

---

## 2026-07-17 — Sidebar collapse toggle moved to a floating icon on the border

**Phase:** user asked to move the sidebar's collapse control to the top, sitting on the border, as an icon (not a labeled row).

**Done:**
- `(app)/layout.tsx`: removed the old "Collapse" button (full-width row with a chevron + text label, bottom of the sidebar next to sign-out) and replaced it with a small circular icon button — `absolute -right-3 top-4.5`, half-overlapping the sidebar's right border near the top, same chevron icon (flips 180° when collapsed) with no text label. Desktop-only (`md:flex`), matching the existing rule that the icon-rail "collapsed" treatment never applies to the mobile overlay. Same `toggleSidebar()` handler and `localStorage` persistence as before — only the control's position and shape changed, not the behavior.

**Verified:** `tsc --noEmit` clean. Page sweep still HTTP 200 across the internal app.

---

## 2026-07-17 — Fixed the real cause of Wallet's wrong count: a backend pagination bug

**Phase:** follow-up — the previous `setTotal(0)` fix addressed a real but *transient* staleness on tab switch; user reported the count was still wrong afterwards, which pointed at something deeper.

**Found:** `wallet.controller.js`'s `credits()` computed `total` via `prisma.dispenseOrder.count({ where })` against *all* credit-type orders (settled + unsettled), while the actual rows went through `findMany({ where, skip, take })` — the same unfiltered `where` — and only *then*, after the DB had already paginated, filtered out settled orders in JS (`.filter(r => settled === 'true' ? true : r.outstanding > 0)`). "Outstanding" isn't a real column (it's `total` minus a sum over related `payments` rows), so it can't be pushed into Prisma's `where`. Confirmed live: default view (unsettled only) returned `total: 4` but only 2 actual rows — the count and the list were describing two different sets. This is exactly the "1–4 of 4 doesn't match what's on screen" symptom, and it's present on the very first load too, not just after switching tabs.
- **Fix**: load every matching order (no DB-level skip/take), compute `outstanding` per order, filter to unsettled (or not, per the `settled` query param), *then* slice that filtered array for the page and set `total` to its length — so the count and the visible rows always come from the same set. Sorting still happens at the DB level first (only real columns are sortable per `CREDIT_SORT_FIELDS`), so order is preserved through the filter.
- `listPayments()` (the other Wallet tab) was already correct — same `where` used for both `count` and `findMany`, no post-query filtering — so it needed no change.

**Verified:** live API check — unsettled view now returns `total: 2, rows: 2`; `settled=true` returns `total: 4, rows: 4`; Payments still `total: 4, rows: 4`. `tsc --noEmit` clean, `node --check` on the controller, full page sweep.

---

## 2026-07-17 — Alerts pagination, and a stale-total bug on tab switch (Wallet)

**Phase:** two issues found in manual testing: Alerts had no pagination at all (unlike every other list page), and switching tabs on pages sharing one `total`/`Pagination` state could show a range ("1–4 of 4") left over from the *previous* tab instead of the one now on screen.

**Done:**
- **Alerts pagination**: `/api/alerts` returns everything in one shot (it's a computed, urgency-sorted list, not a simple paged DB query), so the fix is client-side: new `page`/`pageSize` state, `paged = sorted.slice((page-1)*pageSize, page*pageSize)` rendered instead of the full `sorted` array, and a `<Pagination>` footer matching every other list page. A `useEffect` resets `page` to 1 whenever anything upstream of the list changes (tab, search, location, sort column) so the footer can never show a range that doesn't match what's above it.
- **Wallet's stale-total bug**: `switchTab` reset `tab`/search/page/sort but never `total`, unlike Procurement's equivalent `switchTab` which already zeroed it. Since Credits and Payments share one `<Pagination total={total} .../>`, switching tabs left the *previous* tab's total showing until the new tab's fetch resolved — exactly the "1–4 of 4 doesn't match this tab" symptom reported. Added the missing `setTotal(0)`, matching the pattern Procurement already had correct.
- Audited every other tabbed+paginated page for the same gap: Procurement was already correct; Sales only paginates its one "Sales History" tab (no second tab shares the state, so no cross-tab mismatch is possible there); Reports doesn't use the `Pagination` component at all.

**Verified:** `tsc --noEmit` clean. Full 17-page HTTP-200 sweep.

---

## 2026-07-17 — Alerts gets the same Tabs bar as Sales/Wallet/Procurement/Reports

**Phase:** follow-up correction — the previous change replaced Alerts' redundant pill-tab row with a small "Filtering: X ✕" chip instead of the shared `Tabs` component; user wants the same tab bar the other four pages have.

**Done:**
- Alerts now renders the shared `Tabs` component (scrollable underline strip, counts baked into each tab) right below the page header, built from the existing `TABS` array with each tab's count (`alerts.length` for "All", `counts[type]` for the rest) — visually and behaviorally identical to the tab bar on Sales/Reports/Procurement/Wallet.
- Removed the one-off "Filtering: X ✕" chip that stood in for it — the `Tabs` bar itself now shows and controls the active filter.
- The color-coded stat-card grid above it stays (still clickable, still toggles the same `tab` state) — it's a richer at-a-glance dashboard than a tab label, not a redundant control now that it and the tab bar are just two views onto the same selection rather than the tab bar being a second near-identical copy of the cards.
- Dropped the now-unused `Icon` import that only the removed chip needed.

**Verified:** `tsc --noEmit` clean. Full 17-page HTTP-200 sweep.

---

## 2026-07-17 — Tabs: reverted the mobile dropdown, kept them as scrollable tabs

**Phase:** user feedback on the previous change — preferred the actual tab strip over the dropdown-on-mobile swap, but still wanted the mobile overflow problem fixed.

**Done:**
- Reworked `components/ui/tabs.tsx` in place (no changes needed to the four pages using it — Sales, Reports, Procurement, Wallet — since they consume the same `<Tabs>` API). Every breakpoint now renders the same underline button strip; below `sm` it no longer swaps to a `Select` dropdown. Instead the strip is horizontally scrollable with CSS scroll-snap (`snap-x snap-proximity` on the container, `snap-start` on each button) and a hidden scrollbar (`scrollbar-none`, a Tailwind v4 core utility), so tabs that don't fit the viewport slide into view with a touch-swipe instead of wrapping, clipping, or dragging the whole page sideways.
- Added one behavior that wasn't there before on desktop either: the active tab now scrolls itself into view (`scrollIntoView` on change), so switching to a tab near the scrolled-off edge doesn't leave it half-hidden.
- Tap targets grew slightly on mobile (`py-2.5`, back to `py-2` at `sm:`) since a swipeable strip needs more forgiving touch targets than a mouse-hover strip.
- Alerts' change from the same session (removing the redundant pill-tab row that duplicated the stat-card filters) was **not** part of this revert — that wasn't a dropdown conversion, it was deleting a genuinely duplicate control, and stays removed.

**Verified:** `tsc --noEmit` clean. Full 17-page HTTP-200 sweep.

---

## 2026-07-17 — Mobile-friendly tabs everywhere, and Alerts' duplicate filter removed

**Phase:** user flagged that pages with tabs are hard to use on mobile, calling out Alerts specifically.

**Done:**
- New `components/ui/tabs.tsx` — a `Tabs` component that renders as a dropdown (reusing the house `Select`) below `sm`, and the familiar underline tab strip at `sm` and up. The old pattern (`flex gap-1 border-b` with no wrap or scroll handling) had no defense against overflow: 3 tabs with real labels ("Purchase Orders", "GRV History", "Other Purchases") or 2 tabs with longer text ("Outstanding Credits", "Payment History") would either get clipped or force the whole page to scroll sideways on a phone, since the app shell's `<main>` allows horizontal overflow. A dropdown can't overflow regardless of tab count or label length.
- Applied it to the four pages that had this exact pattern: **Sales** (New Dispense / Sales History), **Reports** (Finance / Sales), **Procurement** (Purchase Orders / GRV History / Other Purchases), **Wallet** (Outstanding Credits / Payment History). Same active state, same click handlers — only the markup changed.
- **Alerts was a different problem, not just a cramped tab strip**: it had *two* controls doing the same job — the colored stat-card grid (Expired/Expiring/Low Stock/Over Stock/Adjustments, already a perfectly good responsive filter, click a card to filter, click again to clear) sitting directly above a second row of pill tabs with the same five options plus "All", wrapping into a ragged multi-line block on narrow screens. Removed the redundant pill row entirely — the stat cards are the sole filter now (they already toggled to "ALL" on a second click). In its place, next to the search box, a small dismissible "Filtering: Low Stock ✕" chip appears only when a filter is active, so the reset action stays discoverable without permanently occupying space. Also let the Refresh-button-and-location-select row wrap (`flex-wrap`) and narrowed the location `Select` on mobile (`w-40 sm:w-48`), since that row alone was tight enough to overflow on the smallest phones (iPhone SE class, ~320px).

**Verified:** `tsc --noEmit` clean. Full 17-page HTTP-200 sweep. Confirmed no page still uses the old unbounded `flex gap-1 border-b` tab pattern (only `tabs.tsx` itself and the still-legitimate stat-card grids remain).

---

## 2026-07-17 — New Dispense split into a 2-step flow (choose items → dispense)

**Phase:** follow-up to the sales page UX pass — user pointed out that having the full Dispense Summary auto-appear stacked below the product picker was awkward on every device, not just mobile, and asked for a "choose items" step before the "dispense" step.

**Done:**
- `NewDispense` gained `step: 'items' | 'dispense'` state and a small step indicator at the top (1. Choose items → 2. Dispense) — this now governs the whole flow on **every** breakpoint, not just mobile.
- **Step 1 — Choose items**: location + stock search + add-to-cart (unchanged content, same mobile-card/desktop-table split from the previous pass), plus a new "Selected items" list underneath once the cart has anything in it — name, batch, quantity, a remove (×) button. No price/quantity editing here; that's deliberately deferred to step 2, so step 1 stays a pure "what am I selling" pick-list. A "Continue to Dispense (N)" button appears once the cart isn't empty — inline on tablet/desktop, and as a sticky bottom bar with a running subtotal on mobile (`sm:hidden`, matching the pattern from the previous pass).
- **Step 2 — Dispense**: exactly the previous Dispense Summary (mobile cards with the quantity stepper / desktop table, the customer/payment/withholding/notes grid, the totals card, Confirm/Clear) — now gated behind `step === 'dispense'`, with a "← Back to items" link at the top that returns to step 1 without losing the cart. The sticky mobile Confirm bar now only renders in this step (previously it was keyed off `cart.length` alone, which would have doubled up with the new step-1 sticky bar).
- Nothing about the underlying state, validation (`confirm()`), or the `/api/sales` payload changed — this was purely a JSX/flow restructuring of the same component.

**Verified:** `tsc --noEmit` clean. Full page sweep still HTTP 200. Confirmed the two sticky mobile bars are mutually exclusive (gated on `step`, not just `cart.length`), so only one ever shows at a time.

---

## 2026-07-17 — Sales page UI/UX pass, especially mobile

**Phase:** user asked for more UI/UX polish on the Sales & Dispensing page, specifically the stock-search/"adding" flow and the Dispense Summary, especially on mobile.

**Done (all inside `NewDispense`, the "New Dispense" tab):**
- **Stock search results** — the 6-column table was unusable on a phone (cramped cells, a "+ Add" text link too small to reliably tap). Below `sm` it's now a card list instead: product name/code, batch + expiry (with the same red "Expired"/amber "Nd left" badge already used on the Inventory page — new local `expiryBadge()` helper), available quantity, and a full solid "Add" button with a cart/check icon that switches state visibly once added. The dense table is kept at `sm:` and up, and also gained the expiry badge for consistency.
- **Dispense Summary (cart review)** — the 8-column edit table had the same mobile problem, made worse by being the step right before submitting money. Below `sm` it's now a card per line: product + batch/available as a subtitle, a remove (×) button, a proper quantity **stepper** (−/number/+, each button a 36px tap target) instead of a bare number input, a sale-price input, and the line total pinned to the bottom of the card. New `stepQty(i, delta)` helper clamps to `[1, available]`, reusing the same `setLine` state update the typed-input path already used.
- **Customer/Payment/Withholding/Notes fields** — were a single `flex flex-wrap` row with mismatched fixed widths (`w-56`, `w-32`, `w-44`, `w-24`) that wrapped messily on narrow screens. Now a `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — every field full-width and evenly stacked on mobile, tablet gets 2 up, desktop gets all 4 (or 3 + notes spanning full width) in one row.
- **Totals** — pulled out of that same flex row into its own `bg-slate-50` summary card (Subtotal / Withholding / Total), so it reads as a distinct total rather than one more item wrapping into the field row.
- **Sticky mobile action bar** — the single biggest change: below `sm`, a `fixed bottom-0` bar (Total + item count on the left, Clear + Confirm Dispense on the right, `env(safe-area-inset-bottom)`-aware padding for iOS home-indicator devices) stays on screen regardless of cart length, so a cashier with 8 items in the cart doesn't have to scroll past the whole card list and every field to find the confirm button. The desktop inline action row is hidden below `sm` (`hidden sm:flex`) so the two don't double up; the page gains `pb-28` on mobile while a cart exists so the sticky bar never overlaps the last card.
- Also disabled the "Clear" button while `saving` (both the desktop row and the new sticky bar), closing a small pre-existing gap where a mid-submit tap could clear the cart out from under an in-flight request.

**Verified:** `tsc --noEmit` clean. Full page sweep still HTTP 200. No backend changes — this was a frontend-only structural/responsive rework of `NewDispense`'s JSX; the state model, validation (`confirm()`), and API payload are untouched.

---

## 2026-07-17 — Real Fort Pharma logo on login, PDFs and print

**Phase:** user supplied the actual Fort Pharma PLC logo artwork (dropped as `photo_2026-07-17_20-53-44.jpg` in the repo root) and asked for it to replace the placeholder text/initials branding on the login page, PDF reports and printable documents.

**Done:**
- Copied the logo to `frontend/public/logo.jpg` (served at `/logo.jpg` for every client-rendered surface) and `backend/src/assets/logo.jpg` (embedded directly into PDFs via `pdfkit`'s `doc.image()`).
- **Login page**: both the desktop dark-panel mark and the mobile-only mark now show the real logo instead of a "FP" initials square + separate "Fort Pharma PLC" text label (redundant now — the artwork already contains that wordmark). The dark panel wraps it in a small white rounded card since the source JPG has a white background that wouldn't read against navy.
- **`backend/src/utils/pdf.js`** (shared by the Finance and Sales PDF reports): the header's solid-color initials block is replaced by the real logo image, with the pharmacy name/tagline text shifted right to make room. Kept a fallback to the old initials-block rendering if the logo file is ever missing, so a deployment without the asset doesn't crash.
- **Print surfaces**: the dispense slip and sales-history report (`sales/page.tsx`) and the bin card (`bincard/page.tsx`) all gained the logo next to the pharmacy name in their printed headers — previously plain text only, no logo existed on any print output.
- Settings' `logoInitial` field (used as the fallback-only initials block) was left as-is — still functional as a safety net, just no longer the primary branding.

**Verified:** `tsc --noEmit` clean; `node --check` on `pdf.js`. Fetched `/logo.jpg` directly (200, 23.5KB) and confirmed the login/sales/bincard pages still return HTTP 200. Downloaded the live Finance PDF via the API — valid `%PDF-` header, file size grew from the old text-only version to ~26KB, consistent with the image now being embedded. The original source photo was left at the repo root, untouched and uncommitted, since it wasn't asked to be removed.

---

## 2026-07-17 — Remove the public marketing homepage

**Phase:** user request — the system no longer needs a public marketing site; the root URL should go straight into the app.

**Done:**
- Deleted `components/marketing/homepage.tsx` and its two exclusive dependencies (`globe-map.tsx`, `hooks.ts` — both were only ever imported by the homepage). Kept `decorative.tsx` (`FloatingPharmaIcons`), since the login page's background animation still uses it.
- `app/page.tsx` no longer renders `Homepage` for signed-out visitors — it's now a pure redirect: signed-in → `/dashboard`, signed-out → `/login`. No more branching on whether to show marketing content.
- `login/page.tsx`: removed the now-meaningless "Back to homepage" link and the two brand-logo `<Link href="/">` wrappers (linking to a page that itself immediately redirects back to `/login` was a dead loop-in-disguise) — the logo is now static, non-interactive brand identity.
- Root `layout.tsx` metadata (page `<title>`/description) changed from the marketing-flavored "Global Pharmaceutical Imports" copy to a plain internal-system description, since there's no longer a public-facing page for that copy to serve.

**Verified:** `tsc --noEmit` clean. Confirmed `GET /` no longer returns homepage markup and instead serves the redirect-loading shell that immediately client-navigates to `/login`. Full 17-page HTTP-200 sweep.

---

## 2026-07-17 — Phase A12: manual-testing bugfix pass

**Phase:** A12 — user ran a full manual pass over the internal system against `TESTING_GUIDE.md` and reported eight concrete problems in one message. All eight addressed in this pass.

**Done:**

1. **Native browser validation replaced with toast.** Root cause: HTML5 `required`/`minLength`/`type="email"` attributes (e.g. the Users form's `minLength={6}` on password) trigger the browser's own unstyled validation popup and block the submit handler from ever running — so the app's already-correct `toast.error(err.message)` pattern in every `save()` catch block never got a chance to fire. Added `noValidate` to all 13 internal-app `<form>` elements (plus the login form) so submission always reaches the handler; the existing backend `ApiError` messages (e.g. "Password must be at least 6 characters") now surface as toasts exactly as intended, with no duplicated client-side validation logic to maintain.
2. **Deactivated suppliers/products/locations no longer appear in creation flows.** `suppliers.controller.js` and `locations.controller.js`'s unpaginated "dropdown" list path returned every row regardless of `isActive` (products already supported `?active=true/false` but nothing passed it). Added the same `active` query support to suppliers/locations; added it to `inventory.controller.js`'s stock list too (used by the Sales dispense-stock search). Every *creation-context* dropdown now excludes inactive rows — procurement's supplier/product/location pickers, the product form's supplier field, sales's location and stock search, inventory's transfer-destination picker — while *filter* contexts (Alerts/Audit/Reports location filters, the Products/Suppliers/Locations management tables themselves) still show everything, since those need to reference historical/inactive records. Editing a product whose assigned supplier was since deactivated still shows it (labeled "(inactive)"), rather than silently blanking the field.
3. **Country of Origin is now a real country list.** New `frontend/src/lib/countries.ts` (195 ISO short-form names); the product form's free-text input became a `Combobox` search-and-select against that list.
4. **Native `<select>` replaced everywhere with a house-built dropdown.** New `components/ui/select.tsx`, styled and keyboard-driven the same way as the existing `Combobox` (portaled listbox via `usePopoverPosition`, arrow keys/Enter/Escape) but without search — a straight value/onChange swap for a native select. Replaced all ~25 remaining native `<select>` elements across the app: type/status/method/withholding filters and form fields in products, locations, procurement (×5), sales (×3), inventory (×2), wallet, alerts, audit (×2), reports, bincard, users, and the pagination page-size picker.
5. **Zero-amount procurement/sales items now rejected.** `orders.controller.js` (PO create + receive) and `sales.controller.js` required `unitCost`/`unitPrice` to be "zero or more" — so a free line item silently went through. Changed to "greater than zero" in both places (matching the expense-purchase amount check, which already required `> 0`), plus the matching product-catalog `unitPrice` validation in `products.controller.js`. Frontend `min="0"` → `min="0.01"` on the corresponding inputs; sales additionally got a client-side pre-check (`confirm()` in `NewDispense`) since that screen has no `<form>` to hang `noValidate`/native validation off of in the first place.
6. **Bulk product import errors now say what was actually wrong.** `products.excel.js`'s per-row messages named the rule ("Type must be one of …") without the offending cell value, so a whole-column mis-mapping produced a wall of identical-looking errors with no way to tell why. Every validation message now echoes the actual cell content (`Type must be one of Medication, Equipment, Cosmetics (got "Tablet")`). Frontend (`products/page.tsx`) no longer truncates to 5 errors with "…" — the notice panel is now a scrollable list of every failed row, and only shows a failure toast when zero rows succeeded (a partial import surfaces as a success toast + the detail panel, not a scary red toast for what was mostly a success).
7. **Sorting extended to every list that structurally supports it.** Procurement's PO list (added Location), GRV list (added Location, Subtotal, Withholding), and Expenses list (added Withholding, Net Payable, By) — all needed new relation/field entries in the backend `SORT_FIELDS` maps, not just frontend header changes. Alerts' table gained click-to-sort columns (Type/Product/Location/Batch/Expiry/Qty) implemented as a client-side sort over the already-fetched array — an empty `sortBy` (the default) preserves the server's urgency-first ordering; clicking a header overrides it with a plain stable sort. **Deliberately left unsorted:** Bin Card (a chronological ledger whose running "Balance" column only makes sense in date order) and the Reports "Sales Report" daily table (a dated report with a fixed Total footer row) — both are read as ordered narratives, not browsable lists, so column-sorting would break the thing they're for.

**Verified:** `tsc --noEmit` clean; all 9 touched backend files pass `node --check`. Live API smoke tests against the running dev stack: confirmed `/api/suppliers?active=true` and `/api/locations?active=true` exclude the inactive test rows while the unfiltered endpoints still return them; confirmed creating a product with `unitPrice: 0` now fails with "Unit price must be greater than zero" (400) and `unitPrice: 5` succeeds (201); confirmed creating a PO item with `unitCost: 0` fails with "Item 1: unit cost must be greater than zero" (400); confirmed `/api/inventory?active=true` (the sales stock-search path) returns only active-product stock. Full 17-page HTTP-200 sweep (public + internal) against the live dev server.

---

## 2026-07-17 — Phase A11: automated restocking recommendations

**Phase:** A11 — second (and, for now, last) backlog item picked, immediately following Phase A10.

**Done:**
- **`alerts.controller.js`**: added `suggestReorder(product, currentQty, dispensedRecent)`. Target stock = `max(what was actually dispensed at that product+location over the last 30 days, product.maxStock ?? minStock × 2)`; suggested reorder = target minus current stock, floored at 0. The 30-day dispensed figures for every product×location come from a single `stockMovement.groupBy(['productId','locationId'])` call reused across every alert being built in that request — not a query per product. Wired into **both** places `LOW_STOCK` alerts get generated: the normal case (some stock, below minimum) and the zero-stock case (no `Stock` row at all, since a product that's completely out never appears in the stock query that seeds the first loop) — missing the second one would have meant the most urgent products (literally zero on hand) silently got no suggestion while merely-low ones did.
- **`alerts/page.tsx`**: `LOW_STOCK` rows now show a line under the existing detail text — "Suggested reorder: 1950 Strip · ~10.5/day recent usage" — surfacing both the number and why, not just a bare figure. No new page or nav item; this enriches the alert list that was already there.

**Verified:** `tsc --noEmit` clean. Checked the arithmetic by hand against the two real `LOW_STOCK` alerts already in the dev database from Phase A10's testing — one location with real dispense history (Main Warehouse: 358 on hand, ~10.5/day recent usage → 30-day demand 315, below the 2×minStock fallback of 2000, so target stayed at 2000 → suggested 1642) and one without (Bole Retail Branch: 50 on hand, 0 usage → target 2000 → suggested 1950) — both matched by hand. Confirmed the unfiltered `/api/alerts` endpoint's counts are unchanged for every other alert type, since nothing outside the `LOW_STOCK` branches was touched. All 16 pages HTTP 200.

**Deliberately not built:** a "generate a PO from this suggestion" button linking Alerts to Procurement — the recommendation itself now exists and is visible; wiring it directly into PO creation is a reasonable next step if wanted, kept out of this increment to stay scoped.

**Backlog status:** both items picked from the 2026-07-17 review are now done. Remaining: self-service account management, partial PO receiving (higher priority); forgot-password/email flow, dedicated Customer management page (lower priority) — see `BUILD_PLAN.md`'s Backlog section.

---

## 2026-07-17 — Phase A10: inter-location stock transfer

**Phase:** A10 — first item off the backlog compiled during a full requirements-vs-code review (2026-07-17). User selected "no inter-location stock transfer" and "no automated restocking recommendations" to implement, step by step, starting with transfer.

**Done:**
- **Schema**: new `StockTransfer` + `StockTransferItem` models (migration `stock_transfers`), directly mirroring the existing `GoodsReceipt`/`GRVItem` shape — a transfer has a unique `TRF-00001`-style number, a from/to location pair, an optional note, and one-or-more line items (product, batch, quantity).
- **`backend/src/modules/inventory/inventory.controller.js`**: new `transfer()` — validates the two locations are different and exist, validates every item, then inside one `prisma.$transaction` creates the `StockTransfer` + its items and, per item, calls the existing `applyMovement()` utility **twice** (`TRANSFER_OUT` at the source, `TRANSFER_IN` at the destination), both remarked with the shared transfer number so the pair reads as one event in the bin card/audit trail. Reused `applyMovement` rather than writing new stock-mutation logic, so the insufficient-stock guard, the Stock upsert, and the movement record all behave identically to every other stock-moving endpoint (GRV, dispense, adjust, dispose) — and a transaction rollback on failure is therefore already correct for free. New `listTransfers()` for history, using the same `parseSort` whitelist pattern as everywhere else. Both reuse the existing `inventory.view`/`inventory.adjust` permissions — no new permission, no role-seed change.
- **Routes**: `POST /api/inventory/transfer`, `GET /api/inventory/transfers`.
- **Frontend** (`inventory/page.tsx`): a "Transfer" action next to each row's existing "Adjust" action (hidden unless a second location exists — transferring to nowhere isn't meaningful), opening a Drawer built to match the Adjust drawer's exact look: destination location select, quantity (HTML `max` set to what's on hand at the source), optional notes. `audit/page.tsx`'s `TYPE_LABELS` gained `TRANSFER_IN`/`TRANSFER_OUT` → "Transfer in"/"Transfer out" (the existing IN/OUT-direction badge coloring already handles them correctly with no further change, since it keys off the movement's `direction` field, not its `type`).

**Verified:** `tsc --noEmit` clean. Full API smoke test against the running dev stack (had to restart Docker Desktop, Postgres and the backend — all three had stopped since the prior session): created a second location ("Bole Retail Branch"), transferred 50 units of Paracetamol from Main Warehouse, confirmed the source dropped 396→346 and the destination showed exactly 50, confirmed both `StockMovement` rows exist with the expected `TRF-00001 → …`/`TRF-00001 ← …` remarks, confirmed a same-location transfer is rejected (400) and an over-quantity transfer is rejected (400) **with the source location's stock left completely unchanged**, confirming the transaction rolls back cleanly. All 16 pages (public + internal) return HTTP 200.

**Next:** automated restocking recommendations (same backlog session) — not started yet.

---

## 2026-07-16 — Phase A9: responsiveness pass across the whole system

**Phase:** A9 — user asked to "dive into ensuring responsiveness of the system." Confirmed scope up front: whole system (public site + internal app), all breakpoints (mobile ~375px, tablet ~768px, desktop 1024px+).

**Done:**
- **The internal app had no mobile navigation at all** — this was the real finding. `(app)/layout.tsx`'s sidebar was a fixed 256px (or 64px collapsed) column, always on-screen, with no hamburger/overlay/off-canvas behavior. On a 375px phone the collapsed rail alone would eat 17% of the viewport width with no way to hide it. Rebuilt it as a proper responsive sidebar: below `md` it's a `fixed` full-width overlay that slides in/out (`-translate-x-full` ↔ `translate-x-0`) with a dimming backdrop (click to close, matching the Drawer component's existing backdrop convention) and a hamburger button in the header; it closes itself on route change. At `md`+ it's pixel-identical to the old behavior — sticky, collapsible to an icon rail, nothing changed for desktop/tablet users. Had to introduce a `railCollapsed = isDesktop && collapsed` (tracked via a live `matchMedia('(min-width: 768px)')` listener, not just a one-time check) so the icon-only rail treatment — which only makes sense as a *persistent* sidebar's space-saving mode — can never apply to the mobile overlay, which should always show full labels since it's temporary and not competing for screen space.
- **Dashboard had 3 tables with no horizontal-scroll wrapper** (Top Moving Products, Recent Sales, Top Customers) — found via a repo-wide grep for every `<table>` lacking an `overflow-x-auto` ancestor. Every other page already had this from the Phase A5 sweep; dashboard's three were simply missed at the time. Wrapped the same way.
- **DatePicker/DateRangePicker popovers could overflow off-screen on narrow viewports** — their calendar panel is a fixed 288px (`w-72`) regardless of where the trigger sits, unlike Combobox's dropdown (which matches its trigger's own width and can therefore never exceed the viewport by construction). A trigger positioned anywhere in a filter bar with less than 288px of clearance to its right would push the panel past the screen edge. Fixed at the source: `usePopoverPosition` (`components/ui/popover.tsx`) gained an optional `panelWidth` param that clamps `left` to `[8px, viewportWidth - panelWidth - 8px]`; both date pickers now pass `panelWidth={288}`. Combobox is unaffected (didn't pass the new param, so its existing trigger-matched-width behavior is unchanged).
- Swept the rest of the codebase for the usual mobile pitfalls — unqualified 3+ column grids, fixed pixel widths, filter-bar rows without `flex-wrap` — and found nothing else; the table/grid/filter-bar conventions already established across Phases A1–A8 were already sound.

**Verified:** `tsc --noEmit` clean. Discovered both dev servers had stopped since the last phase (not related to this work); restarted the frontend dev server and re-ran the full page sweep — all 16 routes (public + internal) return HTTP 200. Confirmed the public homepage/login page content still renders correctly via the established SSR-bypass technique. Internal app pages are gated behind client-side JWT auth stored in `localStorage` (not cookies), so a plain request to them always SSRs the loading shell regardless of the sidebar/layout changes underneath — HTTP-200 status is therefore the correct and sufficient check for those pages, exactly as it has been for every prior phase touching the internal app; no regression tooling exists to do better than that without a browser.

**Known gap, not touched:** `TrendChart`'s hover tooltip (`components/ui/charts.tsx`) is mouse-only with no touch/tap handling — a pre-existing limitation from Phase A4, not introduced or addressed here.

---

## 2026-07-16 — Login page redesign

**Phase:** A7 follow-up — user asked for a more styled login page, to match the effort put into the new public homepage.

**Done:**
- **`frontend/src/app/login/page.tsx`** rebuilt as a split layout: a dark branded panel (hidden below `md`) with the Fort Pharma PLC logo, a headline, three feature highlights (real-time visibility, full audit trail, role-based access — each with an icon), the same `FloatingPharmaIcons` background used on the homepage, and a footer credit line; the form panel keeps a "FortInventory Portal" badge (distinguishing the internal platform name from the public Fort Pharma PLC brand), icon-prefixed email/password inputs, a show/hide password toggle (new `eye`/`eyeSlash` icons), an icon-styled error banner, a spinner in the submit button while signing in, a "← Back to homepage" link, and a mobile-only compact logo (the brand panel is desktop-only).
- **No fake "Forgot password?" link** — checked the backend first; there's no password-reset endpoint, so rather than link to a feature that doesn't exist, the form has a small "contact your administrator" note instead.
- **`components/ui/loading.tsx`**: `Spinner` gained a `colorClassName` prop (default unchanged, `text-slate-900`) so it can be told to render white on a dark button — needed for the login button's dark background; all three existing call sites are unaffected since they don't pass it.
- Login page now shows the branded `LoadingScreen` while the auth check resolves, instead of briefly flashing the login form (same fix pattern as the homepage's guest/authed gate).

**Verified:** `tsc --noEmit` clean; `/login` returns HTTP 200. Since the page is gated behind the same client-side auth check as the homepage (SSR only shows `LoadingScreen` until the browser resolves the token check), used the same temporary-bypass technique to confirm the actual form — brand panel copy, all three highlights, password toggle markup — renders with no runtime errors, then reverted the bypass. Did not runtime-test the actual sign-in submission since `onSubmit`/`useAuth` logic was untouched.

---

## 2026-07-16 — Phase A7 polish: floating pharma-icon backgrounds + micro-interactions

**Phase:** A7 follow-up — user asked for pharma-themed decorative background elements ("drugs" — pills, capsules, bottles) and more general creative polish.

**Done:**
- **New `frontend/src/components/marketing/decorative.tsx`**: four small line-art SVGs (capsule, round tablet with a score line, medicine bottle, medical cross) drawn in the same stroke style as the main icon set, and a `FloatingPharmaIcons` component that scatters them at fixed percentage positions with a slow `animate-float` bob (new keyframe in `globals.css`, staggered per-icon duration/delay so they drift out of sync, disabled under `prefers-reduced-motion`). Three density variants — `light` (Hero, 7 icons, slate-tinted), `sparse` (Services, 4 icons, blue-tinted), `dark` (CTA banner, 4 icons, white/10% for a dark background) — all `pointer-events-none` and `-z-10` so they never block clicks or bleed through card backgrounds.
- Wiring the sparse variant into Services required giving that section `bg-white` on its cards (previously relying on the page's white background, which would have let the icon layer show through the card interior) and moving the `mx-auto max-w-7xl` width constraint from the `<section>` itself onto an inner wrapper, since the icons need to paint full-bleed behind the section while the content stays constrained.
- **Trust line → badges**: the hero's plain "GMP-compliant sourcing · Cold-chain logistics · EFDA-registered" text line is now three small icon pill badges (shield/snowflake/check), matching the rest of the page's badge language.
- **Micro-interaction**: every primary CTA's arrow icon now slides right on hover (`group-hover:translate-x-1`) — hero "Get in touch", CTA banner "Contact our team", and the contact form's "Send message" button.

**Verified:** `tsc --noEmit` clean; `/` and `/login` both return HTTP 200; SSR-bypass check confirmed the badges, the floating-icon layer (`animate-float` class present), and every section still render with no runtime errors.

---

## 2026-07-16 — Phase A7 addition: "Who We Serve" (retail/wholesale sales) + more creativity

**Phase:** A7 follow-up — the user clarified that Fort Pharma PLC doesn't only import; it also sells the imported products directly to local customers (pharmacies, hospitals, wholesalers, and retail/walk-in customers), and asked for more creativity on the public page generally.

**Done:**
- **New "Who We Serve" section** (`WhoWeServe()` in `homepage.tsx`, `#customers` anchor, added to the nav): four customer-segment cards — Pharmacies & Drug Stores, Hospitals & Clinics, Wholesalers & Distributors, Retail Customers — each with a circular icon avatar, styled distinctly from the Services cards (circular vs. square icon treatment) for visual variety. Placed between Services ("what we import") and Process ("how we work") so the page's narrative now reads: import → sell to → how it works → why us.
- **Copy updated everywhere the page implied import-only**: hero headline ("...Sold and delivered across Ethiopia"), hero subhead (imports "and sells them directly to pharmacies, hospitals, wholesalers and customers"), Why-Us intro, and the Process section's last step renamed "Distribution & Sales" ("Sold and delivered to pharmacies, hospitals, wholesalers and customers across Ethiopia").
- **Two-directional ticker**: the country-sourcing marquee now has a second row underneath, scrolling the opposite direction, listing who the products are *sold to* (Pharmacies, Hospitals & Clinics, Wholesalers, Distributors, Retail Customers, Drug Stores) — the ticker itself now visually tells the import → sell story. New `marquee-reverse` keyframe in `globals.css`.
- **Floating back-to-top button**: appears after scrolling past ~600px, smooth-scrolls to top, hidden in print.

**Verified:** `tsc --noEmit` clean; `/` and `/login` both return HTTP 200; SSR-bypass check confirmed the new section ("Who we serve", all four segment titles), the updated Process step title, and both ticker rows render with no runtime errors.

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
