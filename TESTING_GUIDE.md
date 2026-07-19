# FortInventory — Full Testing Guide

A complete manual test checklist for the internal system (everything under
`/(app)` plus auth) — every module, every success path, every failure/edge
case. Built from the actual validation logic in the backend controllers
(exact error messages quoted below are real, not approximated), so this
guide stays accurate as long as the code it was built from doesn't change
underneath it.

Not covered here: the public marketing homepage (`/`) and the login page's
visual design — those are UI/content, not business logic. This guide is
about whether the _system_ behaves correctly.

## How to use this

- Work through a module top to bottom. Each row is one test case: what to
  do, and exactly what should happen.
- ✅ rows are the happy path. ❌ rows are validation/failure/edge cases —
  the system should reject these cleanly with the quoted message (via a
  toast on the relevant page), not crash, not silently succeed, not lose
  data.
- Error messages in `code font` are the literal string the backend returns
  — if what you see doesn't match, that's a bug (either the message
  changed and this guide is stale, or the validation broke).
- Tick boxes as you go; this file isn't meant to be committed back with
  checkmarks — copy it or track results separately if you want a
  persistent record of a specific test run.

## Setup

1. `docker compose up -d` (Postgres on port 5434)
2. `cd backend && npm run dev` (port 4000)
3. `cd frontend && npm run dev` (port 3000)
4. Open `http://localhost:3000/login`

## Test accounts

Only **Admin** is seeded by default:

| Email                       | Password   | Role                |
| --------------------------- | ---------- | ------------------- |
| `admin@fortinventory.local` | `admin123` | Admin (full access) |

For the RBAC section (below) you need one user per role. Create them
yourself via **Users** (as Admin) before starting that section:

| Suggested email         | Role       | Password   |
| ----------------------- | ---------- | ---------- |
| `accountant@test.local` | Accountant | `test1234` |
| `operations@test.local` | Operations | `test1234` |
| `sales@test.local`      | Sales      | `test1234` |

Role permissions (from the seed data, for reference while testing RBAC):

| Role           | Permissions                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**      | everything                                                                                                                                                              |
| **Accountant** | dashboard.view, alerts.view, finance.view, finance.manage, reports.view, sales.view                                                                                     |
| **Operations** | dashboard.view, alerts.view, locations.manage, products.view, products.manage, inventory.view, inventory.adjust, suppliers.manage, procurement.view, procurement.manage |
| **Sales**      | dashboard.view, alerts.view, products.view, inventory.view, sales.view, sales.dispense, customers.manage                                                                |

---

## 1. Authentication

| #       | Scenario                           | Steps                                                                     | Expected                                                                                          |
| ------- | ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1.1 ✅  | Valid login                        | Go to `/login`, enter `admin@fortinventory.local` / `admin123`, submit    | Redirects to `/dashboard`; sidebar shows all nav items                                            |
| 1.2 ❌  | Wrong password                     | Correct email, wrong password                                             | `Invalid email or password`                                                                       |
| 1.3 ❌  | Unknown email                      | Any email not in the system                                               | `Invalid email or password` (same message as wrong password — doesn't leak which field was wrong) |
| 1.4 ❌  | Empty fields                       | Submit with email and/or password blank                                   | Browser-level required-field validation blocks submit (HTML5 `required`)                          |
| 1.5 ❌  | Deactivated user                   | Deactivate a test user (via Users page) then try to log in as them        | `This account has been deactivated`                                                               |
| 1.6 ❌  | Rate limiting                      | Submit 21+ failed logins within 15 minutes from the same IP               | 21st+ attempt gets HTTP 429 (rate limited)                                                        |
| 1.7 ✅  | Session persistence                | Log in, refresh the browser tab                                           | Stays logged in (token from localStorage re-validated via `/api/auth/me`)                         |
| 1.8 ✅  | Logout                             | Click sign-out in the sidebar footer                                      | Returns to `/login`; back button / re-visiting `/dashboard` redirects to `/login`                 |
| 1.9 ❌  | Direct URL access while logged out | With no session, navigate directly to `/dashboard` (or any internal page) | Redirects to `/login`                                                                             |
| 1.10 ❌ | Expired/invalid token              | Manually corrupt the access token in localStorage, then reload            | Treated as logged out; redirects to `/login`                                                      |

## 2. Role-Based Access Control (RBAC)

Test with each of the 4 role accounts from the setup table.

| #      | Scenario                              | Steps                                                                                       | Expected                                                                                                                    |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 2.1 ✅ | Sidebar scoping                       | Log in as each role                                                                         | Sidebar shows only the nav items that role has permission for (compare against the permissions table above)                 |
| 2.2 ❌ | Direct URL to an unpermitted page     | As Sales, navigate directly to `/users` (or any page outside Sales' permissions)            | Page either redirects or its data calls fail with `You do not have permission to do this` (403) — should not show real data |
| 2.3 ❌ | API call without the right permission | As Accountant, call a procurement-mutating endpoint directly (e.g. via browser devtools)    | 403 `You do not have permission to do this`                                                                                 |
| 2.4 ✅ | Admin sees everything                 | Log in as Admin                                                                             | All 15 internal nav items visible and functional                                                                            |
| 2.5 ❌ | Non-admin editing the Admin role      | As any non-Admin (or even Admin) try to edit the Admin role's permissions on the Roles page | `The Admin role always has full access and cannot be edited`                                                                |
| 2.6 ❌ | Self-deactivation                     | As Admin, try to deactivate your own user account from Users                                | `You cannot deactivate your own account`                                                                                    |

## 3. Users & Roles

| #       | Scenario                                  | Steps                                                                             | Expected                                                                                                    |
| ------- | ----------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 3.1 ✅  | Create user                               | Users → Add, fill fullName/email/password (6+ chars)/role, save                   | User appears in list, can log in immediately                                                                |
| 3.2 ❌  | Missing required fields                   | Submit with any of fullName/email/password/role blank                             | `fullName, email, password and roleId are required`                                                         |
| 3.3 ❌  | Short password                            | Password under 6 characters                                                       | `Password must be at least 6 characters`                                                                    |
| 3.4 ❌  | Duplicate email                           | Create a user with an email that already exists                                   | `A user with this email already exists` (409)                                                               |
| 3.5 ❌  | Invalid role                              | Submit a roleId that doesn't exist (API-level test)                               | `Role not found`                                                                                            |
| 3.6 ✅  | Edit user — change role                   | Edit an existing user, change their role, save                                    | Their permissions update immediately (log in as them to confirm sidebar changed)                            |
| 3.7 ✅  | Reset another user's password             | Edit user, enter a new password, save (leave blank = unchanged)                   | They can log in with the new password; old password no longer works                                         |
| 3.8 ✅  | Deactivate a user                         | Toggle isActive off for a non-self user                                           | User can no longer log in (`This account has been deactivated`); still visible in the list, marked inactive |
| 3.9 ✅  | Roles & Permissions — toggle a permission | Roles page, select Operations, uncheck a permission, save                         | That role's users lose access to that feature on next page load                                             |
| 3.10 ❌ | Invalid permission key                    | (API-level) PUT permissions with a key that doesn't exist in the Permission table | `One or more permission keys are invalid`                                                                   |
| 3.11 ❌ | permissions not an array                  | (API-level) PUT with `permissions` as a non-array value                           | `permissions must be an array of permission keys`                                                           |

## 4. Locations

| #      | Scenario                           | Steps                                                                   | Expected                                                                                                                     |
| ------ | ---------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 4.1 ✅ | Create location                    | Locations → Add, fill name/type/address (contact person optional), save | Appears in list; now selectable everywhere a location picker exists (Inventory, Procurement, Sales, Transfer)                |
| 4.2 ❌ | Missing required fields            | Omit name, type, or address                                             | `name, type and address are required`                                                                                        |
| 4.3 ❌ | Invalid type                       | Submit a type outside Retail/Warehouse/Dispensary/Other (API-level)     | `type must be one of: Retail, Warehouse, Dispensary, Other`                                                                  |
| 4.4 ❌ | Duplicate name                     | Create a second location with an existing name                          | `A location with this name already exists` (409)                                                                             |
| 4.5 ✅ | Edit location                      | Change address/contact person, save                                     | Updates reflected everywhere the location is shown                                                                           |
| 4.6 ❌ | Deactivate a location with history | Try to delete/deactivate a location that has stock or movement history  | `This location has stock or transaction history — deactivate it instead` (409) — confirms it's protected, not hard-deletable |
| 4.7 ❌ | Edit/delete non-existent location  | (API-level) PUT/DELETE with a bad id                                    | `Location not found` (404)                                                                                                   |

## 5. Suppliers

| #      | Scenario                     | Steps                                                                          | Expected                                                                         |
| ------ | ---------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 5.1 ✅ | Create supplier              | Suppliers → Add, name required, TIN/phone/email/address/bank accounts optional | Appears in list; selectable in Product forms and Procurement                     |
| 5.2 ❌ | Missing name                 | Submit with name blank                                                         | `name is required`                                                               |
| 5.3 ❌ | Duplicate name               | Create with an existing supplier's name                                        | `A supplier with this name already exists` (409)                                 |
| 5.4 ✅ | Add bank accounts            | Add one or more `{bankName, accountNumber}` rows                               | Saved and shown on the supplier's detail/edit view                               |
| 5.5 ❌ | Malformed bank accounts      | (API-level) send `bankAccounts` as a non-array                                 | `bankAccounts must be an array`                                                  |
| 5.6 ❌ | Deactivate a supplier in use | Try to remove a supplier linked to products or past purchases                  | `This supplier is linked to products or purchases — deactivate it instead` (409) |
| 5.7 ✅ | Search suppliers             | Type in the search box                                                         | Debounced search (300–400ms after typing stops), filters by name/TIN/phone       |

## 6. Products

| #       | Scenario                                    | Steps                                                                                 | Expected                                                                                                   |
| ------- | ------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 6.1 ✅  | Create product                              | Products → Add, fill Type/Pharm Class/Generic Name (required) + optional fields, save | Appears in list with an auto-generated code (`P-00001` style)                                              |
| 6.2 ❌  | Invalid/missing type                        | Type blank or not Medication/Equipment/Cosmetics                                      | `type must be one of: Medication, Equipment, Cosmetics`                                                    |
| 6.3 ❌  | Missing pharm class                         | Leave Pharmacotherapeutic Class blank                                                 | `Pharmacotherapeutic class is required`                                                                    |
| 6.4 ❌  | Missing generic name                        | Leave Generic Name blank                                                              | `Generic name is required`                                                                                 |
| 6.5 ❌  | Bad conversion factor                       | Enter 0 or a negative conversion factor                                               | `Conversion factor must be a positive number`                                                              |
| 6.6 ❌  | Bad unit price                              | Enter a negative unit price                                                           | `Unit price must be zero or more`                                                                          |
| 6.7 ❌  | maxStock < minStock                         | Set maxStock lower than minStock                                                      | `maxStock cannot be lower than minStock`                                                                   |
| 6.8 ❌  | Unknown supplier                            | Link a supplierId that doesn't exist (API-level)                                      | `Supplier not found`                                                                                       |
| 6.9 ✅  | Edit product                                | Change any field, save                                                                | Reflected in Inventory/Alerts/Reports immediately                                                          |
| 6.10 ✅ | Deactivate product                          | Toggle isActive off                                                                   | No longer selectable for new POs/sales; existing history unaffected                                        |
| 6.11 ✅ | Search/filter                               | Search by code/name/brand; filter by type                                             | Debounced search; results narrow correctly                                                                 |
| 6.12 ✅ | Download Excel template                     | Products → Import → Download Template                                                 | `.xlsx` downloads with the correct columns + a sample row + a Notes sheet                                  |
| 6.13 ✅ | Export products                             | Products → Export (optionally with filters/selection)                                 | `.xlsx` downloads with all matching products                                                               |
| 6.14 ✅ | Bulk import — valid file                    | Fill the template with valid rows, upload                                             | Reports `created: N`, `errors: []`; products appear in the list                                            |
| 6.15 ❌ | Bulk import — bad type                      | A row with Type not in the allowed enum                                               | Row rejected with `Type must be one of Medication, Equipment, Cosmetics`; other valid rows still import    |
| 6.16 ❌ | Bulk import — missing required cell         | A row missing Generic Name or Pharm Class                                             | Row rejected (`Generic name is required` / `Pharmacotherapeutic class is required`); other rows unaffected |
| 6.17 ❌ | Bulk import — unknown supplier name         | A row referencing a supplier name that doesn't exist                                  | Row rejected: `Supplier "X" not found`                                                                     |
| 6.18 ❌ | Bulk import — bad conversion factor / price | Zero/negative conversion factor, or negative unit price                               | Row rejected with the matching message; import continues for other rows                                    |
| 6.19 ❌ | Bulk import — no file                       | Submit the import form with nothing selected                                          | `Upload an .xlsx file in the "file" field`                                                                 |
| 6.20 ❌ | Bulk import — empty workbook                | Upload an `.xlsx` with no worksheets                                                  | `The workbook has no sheets`                                                                               |

## 7. Inventory

| #       | Scenario                      | Steps                                                                                                                    | Expected                                                                                                                                                                     |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 ✅  | View stock                    | Open Inventory                                                                                                           | Lists stock per batch × location: code, name, brand, qty, unit, price, supplier, batch no., expiry, location                                                                 |
| 7.2 ✅  | Search/filter/sort            | Search by code/name/batch; filter by location; click column headers                                                      | Results update correctly; sort direction toggles; combination of search+filter+sort all apply together                                                                       |
| 7.3 ✅  | Export inventory              | Click Export (with or without filters active)                                                                            | `.xlsx` downloads matching the current filter                                                                                                                                |
| 7.4 ✅  | Adjust — increase             | Row → Adjust, type Increase, quantity + reason, submit                                                                   | Quantity increases; toast confirms new total; movement appears in Audit Trail as `ADJUST_INCREASE`                                                                           |
| 7.5 ✅  | Adjust — decrease             | Row → Adjust, type Decrease, quantity + reason (≤ current stock)                                                         | Quantity decreases; audit trail shows `ADJUST_DECREASE`                                                                                                                      |
| 7.6 ❌  | Adjust without a reason       | Submit with reason blank                                                                                                 | `A reason is required for stock adjustments`                                                                                                                                 |
| 7.7 ❌  | Decrease below zero           | Decrease by more than what's on hand                                                                                     | `Not enough stock: only N available in this batch at this location`                                                                                                          |
| 7.8 ✅  | Transfer — valid              | Row → Transfer (only shown when 2+ locations exist), pick destination, quantity ≤ available, submit                      | Source location drops by the amount, destination gains exactly that amount; toast shows the transfer number (`TRF-00001` style)                                              |
| 7.9 ❌  | Transfer to the same location | Attempt to pick the source location as the destination (should be excluded from the dropdown, but test API directly too) | `Source and destination locations must be different`                                                                                                                         |
| 7.10 ❌ | Transfer more than available  | Quantity greater than the row's current stock                                                                            | `Not enough stock: only N available in this batch at this location`; **verify the source location's quantity is unchanged** (transaction rolled back, not partially applied) |
| 7.11 ❌ | Transfer with no items        | (API-level) submit with an empty items array                                                                             | `At least one item is required`                                                                                                                                              |
| 7.12 ✅ | Transfer history visible      | After a transfer, check Audit Trail                                                                                      | Two rows: `Transfer out` at source, `Transfer in` at destination, both referencing the same transfer number in the remark                                                    |
| 7.13 ✅ | Movements / audit sub-view    | Inventory → view movements for a product                                                                                 | Full chronological list of every IN/OUT for that product, filterable                                                                                                         |

## 8. Bin Card

| # | Scenario | Steps | Expected  
 |
| ------ | --------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 8.1 ✅ | Generate bin card | Bin Card page, pick a product + location + date range | Table: Date, Batch, Expiry, Supplier, In, Out, Balance, Performed By, Remark — running balance is arithmetically correct |
| 8.2 ❌ | Missing product or location | Submit without both selected | `productId and locationId are required` |
| 8.3 ❌ | Invalid date range | Enter a malformed date | `Invalid date range` |
| 8.4 ❌ | Unknown product/location | (API-level) bad ids | `Product not found` / `Location not found` |
| 8.5 ✅ | Print | Click Print | Browser print dialog opens; layout is clean (no sidebar/nav bleeding into the printout — check `print:hidden` classes worked) |

## 9. Procurement

### 9.1 Purchase Orders

| #        | Scenario                                | Steps                                                                                                    | Expected                                                                             |
| -------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 9.1.1 ✅ | Create PO                               | Procurement → Orders → New, pick location + items (product/qty/unit cost, optional batch/expiry), submit | PO created with status `OPEN`, auto-numbered (`PO-00001`)                            |
| 9.1.2 ❌ | No location                             | Submit without a location                                                                                | `locationId is required`                                                             |
| 9.1.3 ❌ | No items                                | Submit with zero line items                                                                              | `At least one item is required`                                                      |
| 9.1.4 ❌ | Invalid item                            | Missing productId, zero/negative quantity, or negative unit cost on a line                               | Matching per-line message, e.g. `Item 1: quantity must be a positive whole number`   |
| 9.1.5 ❌ | Unknown product                         | (API-level) reference a productId that doesn't exist                                                     | `One or more products do not exist`                                                  |
| 9.1.6 ✅ | Cancel an open PO                       | Cancel a PO still in `OPEN` status                                                                       | Status → `CANCELLED`; no stock effect                                                |
|          |
| 9.1.7 ❌ | Cancel an already-received/cancelled PO | Try to cancel a PO that's `RECEIVED` or already `CANCELLED`                                              | `Only open purchase orders can be cancelled (this one is received)` (or `cancelled`) |

### 9.2 Goods Receiving (GRV)

| #        | Scenario                        | Steps                                                                                     | Expected                                                                                                                      |
| -------- | ------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 9.2.1 ✅ | Receive a PO                    | Open an OPEN PO → Receive, enter batch no. (+ optional expiry override) per line, confirm | Creates a GRV (`GRV-00001`), stock increases at the PO's location per batch, PO status → `RECEIVED`                           |
| 9.2.2 ❌ | Receive an already-received PO  | Try to receive the same PO again                                                          | `This purchase order is already received`                                                                                     |
| 9.2.3 ❌ | Missing batch number            | Submit a receive line with no batch no.                                                   | `Line 1: batch number is required`                                                                                            |
| 9.2.4 ❌ | Invalid quantity/cost on a line | Zero/negative quantity or negative unit cost                                              | Matching message, e.g. `Line 1: quantity must be a positive whole number`                                                     |
| 9.2.5 ❌ | Line doesn't belong to the PO   | (API-level) itemId not on this PO                                                         | `Line 1: itemId does not belong to this purchase order`                                                                       |
| 9.2.6 ✅ | Withholding tax on GRV          | Set withholdingType = GOODS or SERVICES with a rate, receive                              | `withholdingAmount`/`netPayable` computed correctly (`subtotal × rate / 100`); shows on the GRV and rolls into Finance report |
| 9.2.7 ❌ | Invalid WHT rate                | Rate outside 0–100                                                                        | `Withholding rate must be between 0 and 100`                                                                                  |
| 9.2.8 ❌ | Invalid WHT type                | Type not NONE/GOODS/SERVICES (API-level)                                                  | `withholdingType must be one of: NONE, GOODS, SERVICES`                                                                       |
| 9.2.9 ✅ | GRV history                     | Procurement → GRV tab                                                                     | Lists all receipts, searchable/sortable, each linkable back to its PO                                                         |

Non-sale purchases (expenses) used to be a third Procurement tab ("Other
Purchases") — they're now their own page, **Expenses**, with its own
sidebar entry. See section 19.

## 10. Sales & Dispensing

| #        | Scenario                     | Steps                                                                                                      | Expected                                                                                                                  |
| -------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 10.1 ✅  | Dispense — single item       | Sales → New Dispense, pick location, click "+ Add product", then use the search-combo (type a name/code/batch) and select a result | Combo appears in place of the button, auto-focused; item added to the cart instantly, combo collapses back to the "+ Add product" button; quantity/price editable in Step 2, submit creates the order (`DSP-00001`), stock decreases at that location/batch |
| 10.2 ✅  | Dispense — multiple items    | Click "+ Add product" again for each additional item (search + select each time)                           | Each add collapses back to the button; all lines processed atomically on submit — one order, multiple `DispenseItem`s     |
| 10.1a ✅ | Add-product combo — search   | Type part of a product name, code, or batch number into the combo                                          | Dropdown narrows to matching batches (debounced ~300ms); each option shows code, batch, quantity available, price, and expiry status (e.g. "45d left"/"EXPIRED") in the sublabel |
| 10.1b ✅ | Add-product combo — same product, multiple batches | A product with 2+ batches at the location                                                     | Each batch appears as its own option so staff can choose (e.g. pick the near-expiry batch first)                          |
| 10.1c ✅ | Add-product combo — already in cart | Add a batch (combo auto-collapses), click "+ Add product" again                                     | That batch no longer appears in the dropdown (can't be added twice); still visible/removable in the "Selected items" list |
| 10.1d ✅ | Add-product combo — cancel   | Click "+ Add product", then click the "×" without selecting anything, or switch location                   | Combo collapses back to the "+ Add product" button with nothing added; switching location also clears the cart           |
| 10.3 ❌  | No location                  | Submit without a location                                                                                  | `locationId is required`                                                                                                  |
| 10.4 ❌  | Invalid payment type         | paymentType outside CASH/CREDIT (API-level)                                                                | `paymentType must be CASH or CREDIT`                                                                                      |
| 10.5 ❌  | No items                     | Submit with zero lines                                                                                     | `At least one item is required`                                                                                           |
| 10.6 ❌  | Insufficient stock on a line | Quantity greater than what's in that batch                                                                 | `Not enough stock: only N available in this batch at this location` — **whole order should fail, not partially dispense** |
| 10.7 ❌  | Invalid line                 | Zero/negative quantity, negative price, or a batch that doesn't exist                                      | Matching message, e.g. `Item 1: batch not found`                                                                          |
| 10.8 ✅  | Credit sale + customer       | Choose CREDIT, quick-create or pick a customer                                                             | Order recorded with an outstanding balance; customer appears in Wallet's outstanding list and Dashboard's Top Customers   |
| 10.9 ❌  | Unknown customer             | (API-level) customerId that doesn't exist                                                                  | `Customer not found`                                                                                                      |
| 10.10 ✅ | Print dispense slip          | After confirming, Print Slip                                                                               | Branded printable slip with items, totals, signature block                                                                |
| 10.11 ✅ | Attach a file                | Sales History → an order → Attach                                                                          | File uploads (up to 10MB), listed under that order, downloadable                                                          |
| 10.12 ❌ | Attach with no file          | Submit the attach form with nothing selected                                                               | `Upload a file in the "file" field`                                                                                       |
| 10.13 ✅ | Sales history filter         | Filter by date range / search                                                                              | Debounced search, date-range filters correctly, pagination stays correct                                                  |
| 10.14 ✅ | Print sales history report   | Apply filters, Print Sales History                                                                         | Fetches all matching orders (up to 500) regardless of on-screen page size, prints a branded summary report                |

## 11. Wallet / Finance

| #       | Scenario                    | Steps                                                              | Expected                                                                           |
| ------- | --------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 11.1 ✅ | View outstanding credits    | Wallet → Outstanding Credits                                       | Lists every CREDIT sale with a balance > 0, correct outstanding = total − payments |
| 11.2 ✅ | Record a payment            | Pick a credit order, enter amount ≤ outstanding + method, submit   | Balance reduces; if fully paid, order no longer appears in outstanding list        |
| 11.3 ❌ | No dispenseOrderId          | (API-level) omit it                                                | `dispenseOrderId is required`                                                      |
| 11.4 ❌ | Zero/negative amount        | Amount ≤ 0                                                         | `Amount must be greater than zero`                                                 |
| 11.5 ❌ | Invalid payment method      | Method outside CASH/BANK_TRANSFER/CHEQUE/MOBILE                    | `method must be one of: CASH, BANK_TRANSFER, CHEQUE, MOBILE`                       |
| 11.6 ❌ | Payment against a cash sale | Try to record a payment against an order that was CASH, not CREDIT | `Payments can only be recorded against credit sales`                               |
| 11.7 ❌ | Overpayment                 | Amount greater than the remaining outstanding balance              | `Payment exceeds the outstanding balance (X.XX)`                                   |
| 11.8 ✅ | Payment history             | Wallet → Payment History                                           | Every recorded payment, filterable/sortable                                        |

## 12. Alerts

| #        | Scenario                                              | Steps                                                                                       | Expected                                                                                                                                            |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12.1 ✅  | Expired items                                         | Have a batch past its expiry date with stock > 0                                            | Shows under Expired tab: days overdue, quantity, batch, supplier                                                                                    |
| 12.2 ✅  | Expiring soon                                         | A batch within its product's expiry alert window (default 90 days, or per-product override) | Shows under Expiring, with days remaining                                                                                                           |
| 12.3 ✅  | Low stock                                             | Total stock for a product at a location falls below its `minStock`                          | Shows under Low Stock, `severity` = deficit; **now also shows a "Suggested reorder: N unit" line**                                                  |
| 12.4 ✅  | Low stock — suggested reorder qty, with usage history | Product with recent DISPENSE movements at that location                                     | Suggested qty reflects `max(30-day dispensed, maxStock ?? minStock×2) − current`; "~X/day recent usage" shown                                       |
| 12.5 ✅  | Low stock — suggested reorder qty, no usage history   | A product below minStock that's never been dispensed at that location                       | Falls back to `(maxStock ?? minStock×2) − current`; no "recent usage" text shown (since it'd be 0)                                                  |
| 12.6 ✅  | Out-of-stock (zero stock) still alerts                | A product with `minStock` set but zero stock (no Stock row at all) at a location            | Still appears as Low Stock ("Out of stock…") **with** a suggested reorder qty — this is a real edge case since it's a different code path than 12.3 |
| 12.7 ✅  | Over stock                                            | Total stock exceeds `maxStock`                                                              | Shows under Over Stock tab                                                                                                                          |
| 12.8 ✅  | Adjustments feed                                      | Any ADJUST_INCREASE/ADJUST_DECREASE/DISPOSE in the last 30 days                             | Shows under Adjustments, with reason and who performed it                                                                                           |
| 12.9 ✅  | Filter by type/location                               | Use the tabs + location filter                                                              | Correctly narrows results; count badges match                                                                                                       |
| 12.10 ✅ | Product details drawer                                | Click a product name in an alert                                                            | Drawer opens with current stock breakdown + recent movement history for that product                                                                |
| 12.11 ✅ | Dispose from an alert                                 | On an Expired/Expiring alert, click Dispose, enter a reason, confirm                        | Stock zeroed for that batch/location, `DISPOSE` movement recorded, alert disappears                                                                 |
| 12.12 ❌ | Dispose without a reason                              | Submit the dispose form blank                                                               | `A reason is required to dispose stock`                                                                                                             |
| 12.13 ❌ | Invalid alert type filter                             | (API-level) `?type=` something not in EXPIRED/EXPIRING/LOW_STOCK/OVER_STOCK/ADJUSTMENT      | `type must be one of: EXPIRED, EXPIRING, LOW_STOCK, OVER_STOCK, ADJUSTMENT`                                                                         |

## 13. Dashboard

| #       | Scenario                        | Steps                                                                             | Expected                                                                                                    |
| ------- | ------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 13.1 ✅  | Stock overview                  | Open Dashboard                                                                    | Correct product count, units in stock, stock value, batch-location count                                    |
| 13.2 ✅  | Sales summary                   | Check today's total and Monthly Sales (last 30 days) total/count                  | Matches what Sales History shows for the same windows                                                        |
| 13.3 ✅  | Alert counts                    | Quick-link cards (Low Stock, Expiring)                                            | Counts match the Alerts page exactly                                                                         |
| 13.4 ✅  | Top moving products             | Check the "Fast Movers" ranked list                                               | Matches actual dispense quantities over the last 30 days                                                     |
| 13.5 ✅  | Recent sales table              | Check the list                                                                    | Matches the most recent Sales History entries                                                                |
| 13.6 ✅  | Period switch (7d/30d/90d/etc.) | Change the period selector on the Performance Overview section                    | Sales Overview, profit/sales trend charts, top customers, and Top Products (revenue/margin/volume) all re-fetch for the new window |
| 13.7 ✅  | Profit trend charts             | Compare Gross/Net profit lines against Finance report figures for the same period | Numbers reconcile                                                                                            |
| 13.8 ✅  | Top customers                   | Check ranking + Last Order Date                                                   | Matches actual credit/cash order history per customer                                                        |
| 13.9 ✅  | Quick links                     | Click through to Purchase Orders / Dispensing / Reports                           | Navigates correctly                                                                                          |
| 13.10 ✅ | Unpaid Invoices KPI             | Compare the count/outstanding total against Wallet's outstanding credit sales     | Numbers match exactly (same "total − payments" computation)                                                  |
| 13.11 ✅ | Total Buyers KPI                | Compare against the number of distinct customers with at least one order          | Matches; a customer added but never sold to is NOT counted                                                   |
| 13.12 ✅ | Sales Overview charts           | Revenue chart vs Order Volume chart, same period                                  | Two separate single-series charts (not one dual-axis chart); values match Sales report totals for the period |
| 13.13 ✅ | Top Products by Revenue         | Compare ranking against Reports → Sales for the same period                       | Highest-revenue products ranked correctly, using actual unit price × quantity                                |
| 13.14 ✅ | Slow Movers                     | A product with stock but zero/low sales in the last 30 days                       | Appears in the "Slow Movers" list, ranked by stock value tied up, with its 30-day sold count shown            |
| 13.15 ✅ | Alerts & Insights panel         | Compare the Low Stock / Expiring / Over Stock mini-lists against the Alerts page   | Same items, same detail text (suggested reorder qty, days to expiry, etc.); "View all →" navigates to Alerts |
| 13.16 ✅ | Alerts & Insights — all clear   | A category (e.g. Over Stock) with zero active alerts                              | Shows "All clear." instead of an empty list                                                                  |
| 13.17 ✅ | Location filter                 | Pick a specific location from the new dropdown                                    | Every KPI, chart, and list on the page (both the always-current section and the period-scoped section) re-scopes to that location only |
| 13.18 ✅ | Location filter — all locations | Reset the dropdown to "All locations"                                             | Figures return to the unfiltered, all-location totals                                                        |
| 13.19 ✅ | Last updated + refresh          | Note the "Updated HH:MM:SS" timestamp, click the refresh icon                     | Timestamp updates to the current time; both the KPI section and the period-scoped section re-fetch            |
| 13.20 ✅ | Monthly Sales trend badge       | Compare the badge against last-30-days vs the prior 30-days total                 | Up/down arrow and percentage match the computed change                                                        |
| 13.21 ✅ | Payment Mix                     | Compare Cash/Credit totals and counts against Wallet's summary for the same period| Split bar proportions and legend numbers match exactly                                                        |
| 13.22 ✅ | Payment Mix — no sales          | Filter to a period/location with zero sales                                       | Shows "No sales in this period." instead of a broken/empty bar                                                |
| 13.23 ✅ | Location Performance            | With 2+ locations having sales in the period                                      | Ranked bar list by revenue, with order count per location; matches Reports figures per location               |
| 13.24 ✅ | Location Performance — hidden   | Filter to a single location, or a period where only one location has sales        | Panel doesn't render (comparing one location to itself isn't useful)                                          |

## 14. Reports

| #       | Scenario                       | Steps                                                 | Expected                                                                                                                                             |
| ------- | ------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14.1 ✅ | Finance report — on screen     | Reports → Finance, pick location + date range         | Total Sales, COGS, Gross Profit, Withholding, Net Revenue, Payments all shown and internally consistent (Gross Profit = Sales − COGS, etc.)          |
| 14.2 ✅ | Finance report — PDF           | Click Download PDF                                    | Branded PDF (logo, pharmacy name/address/phone from Settings, filters, generated timestamp) downloads correctly                                      |
| 14.3 ✅ | Sales report — on screen + PDF | Reports → Sales tab, same flow                        | Date-wise revenue breakdown; PDF downloads                                                                                                           |
| 14.4 ❌ | Invalid date range             | Malformed from/to dates                               | `Invalid date range`                                                                                                                                 |
| 14.5 ❌ | Unknown location filter        | (API-level) bad locationId                            | `Location not found`                                                                                                                                 |
| 14.6 ✅ | Filter by location             | Pick a specific location                              | Figures scope to just that location's activity                                                                                                       |
| 14.7 ✅ | Withholding report — on screen | Reports → Withholding tab, pick location + date range | Every sale with `withholdingType != NONE` in range: DSP no., date, customer, location, subtotal, rate, withheld amount, net total, plus a totals row |
| 14.8 ✅ | Withholding report — PDF       | Click Download PDF while on the Withholding tab       | Same branded PDF layout as Finance/Sales, table of withheld sales + summary totals                                                                   |
| 14.9 ✅ | Withholding report — empty     | Filter to a period/location with no withheld sales    | "No withheld sales in this period" empty state, no totals row rendered                                                                               |
| 14.10 ✅ | Withholding receipt — mark received | On the Withholding tab, click "Mark received" on a row (requires `finance.manage`), enter a receipt number, save | Row switches to a green "Received" badge showing the receipt number; totals row's received count increments; toast confirms |
| 14.11 ✅ | Withholding receipt — edit/clear | Click "Edit" on an already-received row, clear the receipt number field, save | Row reverts to an amber "Pending" badge; received count decrements |
| 14.12 ❌ | Withholding receipt — no withholding | (API-level) PATCH `/api/sales/:id/withholding-receipt` for a sale with `withholdingType = NONE` | `This sale has no withholding to track` |
| 14.13 ❌ | Withholding receipt — permission | User without `finance.manage` views the Withholding tab | Receipt badges still visible; no "Actions" column or mark/edit button shown |

## 15. Settings

| #       | Scenario                           | Steps                                                                                                  | Expected                                                                          |
| ------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 15.1 ✅ | Update branding                    | Change pharmacy name/address/phone/logo initial, save                                                  | Reflected immediately on the dispense slip, bin card, and PDF reports             |
| 15.2 ❌ | Empty pharmacy name                | Clear the name field and save                                                                          | `Pharmacy name cannot be empty`                                                   |
| 15.3 ✅ | Update WHT default rates           | Change default goods/services withholding rate                                                         | New Procurement/Sales forms default to the new rate (existing records unaffected) |
| 15.4 ❌ | Invalid WHT rate                   | Enter a rate outside 0–100                                                                             | `whtGoodsRate must be between 0 and 100` (or `whtServicesRate`)                   |
| 15.5 ✅ | Update default expiry alert window | Change `defaultExpiryAlertDays`                                                                        | Products without their own override now use the new window for Alerts             |
| 15.6 ❌ | Invalid expiry days                | Negative or non-integer value                                                                          | `defaultExpiryAlertDays must be a non-negative whole number`                      |
| 15.7 ❌ | Non-admin access                   | As a role without `settings.manage`, try to save Settings                                              | 403 `You do not have permission to do this`                                       |
| 15.8 ✅ | Read-only access                   | Any signed-in user (even without settings.manage) loads pages that need branding (dispense slip, etc.) | Settings are readable by everyone; only saving is restricted                      |

## 16. Audit Trail

| #       | Scenario             | Steps                                                                                                      | Expected                                                                                          |
| ------- | -------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 16.1 ✅ | Full movement list   | Open Audit Trail                                                                                           | Every stock movement across the system: GRV, Dispensed, Adjustment +/−, Disposed, Transfer in/out |
| 16.2 ✅ | Filter by type       | Use the type dropdown, including the new Transfer in/Transfer out options                                  | Correctly narrows to that movement type                                                           |
| 16.3 ✅ | Filter by location   | Pick a location                                                                                            | Shows only movements at that location                                                             |
| 16.4 ✅ | Filter by date range | Pick a range                                                                                               | Only movements within it                                                                          |
| 16.5 ✅ | Search by product    | Type a product name/code                                                                                   | Debounced, filters correctly                                                                      |
| 16.6 ✅ | Sort columns         | Click each sortable header                                                                                 | Correct ascending/descending order; combining with filters/pagination still works                 |
| 16.7 ✅ | Traceability check   | Cross-reference: every GRV, dispense, adjustment, disposal, and transfer you performed in earlier sections | Each one has a matching Audit Trail row with correct type/direction/quantity/performer            |

## 17. Cross-cutting

| #        | Scenario                    | Steps                                                                                            | Expected                                                                                                                                                         |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17.1 ✅  | Pagination everywhere       | On every list page, change rows-per-page (10/25/50/100), page forward/back                       | Correct row counts, correct "X–Y of Z" range, disabled Prev on page 1 / Next on last page                                                                        |
| 17.2 ✅  | Debounced search everywhere | Type quickly into any search box                                                                 | Only fires after you stop typing (~300–400ms), not on every keystroke; minimum 2–3 characters before it triggers                                                 |
| 17.3 ✅  | Sorting everywhere          | Click any `SortableHeader`                                                                       | Toggles asc/desc; an invalid/tampered `sortBy` query param falls back to the default sort instead of erroring                                                    |
| 17.4 ✅  | Date pickers                | Open any single or range date picker, including inside a Drawer or a horizontally-scrolled table | Renders fully visible, never clipped or pushed off-screen, even near a viewport edge                                                                             |
| 17.5 ✅  | Comboboxes                  | Any searchable product/supplier select                                                           | Type-to-filter works; keyboard (arrow keys + Enter) works; quick-create works where offered (e.g. customer during dispensing)                                    |
| 17.6 ✅  | Drawers                     | Any Add/Edit form                                                                                | Slides in from the right, Escape key closes it, backdrop click closes it, body scroll locks while open                                                           |
| 17.7 ✅  | Loading states              | Slow network (throttle in devtools) or first load of any page                                    | Branded spinner + "FortInventory" shown, not a blank screen                                                                                                      |
| 17.8 ✅  | Toasts                      | Trigger any success/error action                                                                 | Toast appears bottom-right, auto-dismisses, doesn't stack unreadably with rapid actions                                                                          |
| 17.9 ✅  | Print pages                 | Bin Card, Dispense Slip, Sales History Report, Finance/Sales PDFs                                | No sidebar/header/nav bleeding into the printout; wide tables don't get cut off                                                                                  |
| 17.10 ✅ | Mobile layout               | Resize to ~375px width (or a real phone)                                                         | Sidebar becomes a hamburger-triggered overlay with a backdrop; every table scrolls horizontally instead of breaking the page layout; date pickers stay on-screen |
| 17.11 ✅ | Tablet layout               | Resize to ~768px                                                                                 | Sidebar auto-collapses to icon rail by default; content remains usable                                                                                           |
| 17.12 ✅ | Rate limiting (general API) | Fire 300+ authenticated API requests in under a minute                                           | 301st+ request in that window gets HTTP 429                                                                                                                      |
| 17.13 ❌ | Unknown route               | Navigate to a route that doesn't exist, e.g. `/api/nonsense` (API)                               | 404 `Not found: GET /api/nonsense`                                                                                                                               |
| 17.14 ❌ | No auth header at all       | Call any protected API endpoint with no Authorization header                                     | 401 `Authentication required`                                                                                                                                    |

## 18. Customer Management

| #        | Scenario                               | Steps                                                              | Expected                                                                                           |
| -------- | -------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 18.1 ✅  | Add a customer                         | Customers → + Add Customer, fill name (phone/email optional), save | Customer created, appears in the list, active by default                                           |
| 18.2 ❌  | Add without a name                     | Submit the form blank                                              | `Customer name is required`                                                                        |
| 18.3 ✅  | Edit a customer                        | Edit an existing row, change phone/email, save                     | Updated fields persist                                                                             |
| 18.4 ✅  | Deactivate / reactivate                | Toggle Deactivate on a row, then Activate again                    | Status badge flips; deactivated customers no longer appear in the Sales dispense-flow quick-picker |
| 18.5 ✅  | Delete an unused customer              | Delete a customer with zero sales history                          | Removed from the list                                                                              |
| 18.6 ❌  | Delete a customer with sales history   | Try to delete a customer that has at least one dispense order      | `This customer has sales history — deactivate them instead`                                        |
| 18.7 ✅  | Search                                 | Search by name, phone, or email                                    | Debounced, matches any of the three fields                                                         |
| 18.8 ✅  | Sort + paginate                        | Click sortable headers; change rows-per-page; page forward/back    | Correct order; correct "X–Y of Z" range                                                            |
| 18.9 ✅  | Orders column                          | Check the Orders count for a customer with sales history           | Matches the number of dispense orders on that customer                                             |
| 18.10 ✅ | Quick-create still works during a sale | Sales → New Dispense → create a new customer inline                | Still works exactly as before (unaffected by the new management page/permission)                   |
| 18.11 ✅ | Add bank accounts                      | Add one or more `{bankName, accountNumber}` rows on a customer     | Saved and shown in the Bank Accounts column and on re-opening Edit                                  |
| 18.12 ❌ | Malformed bank accounts                | (API-level) send `bankAccounts` as a non-array                     | `bankAccounts must be an array`                                                                     |
| 18.13 ✅ | Replace bank accounts                  | Edit a customer's bank accounts to a different set, save           | Old rows are replaced, not appended to                                                              |
| 18.14 ✅ | New customer defaults to Unrated       | Add a customer, check the Rating column                            | Shows "Unrated" (gray badge)                                                                        |
| 18.15 ✅ | Payment-history summary informs rating | Edit a customer with credit sales history                          | Drawer shows credit sales count, settled count, total extended, total paid, outstanding, last order date, directly above the rating selector |
| 18.16 ✅ | Set a rating                           | Edit → Credit rating → Good/Fair/Poor, save                        | Badge updates in the list (green/amber/red)                                                         |
| 18.17 ❌ | Invalid rating (API-level)             | PATCH `creditRating` to a value outside UNRATED/GOOD/FAIR/POOR     | `creditRating must be one of: UNRATED, GOOD, FAIR, POOR`                                            |
| 18.18 ✅ | Credit advisory in Sales               | New Dispense → pick a customer with history → set Payment to Credit | Amber "Credit check" panel appears: rating badge, outstanding balance, N/M past credit sales settled, "Advisory only" label |
| 18.19 ✅ | Advisory doesn't block                 | With a Poor-rated / high-outstanding customer, complete a Credit sale anyway | Sale completes normally — the panel is informational only, never blocks                             |
| 18.20 ✅ | Advisory disappears for Cash           | Switch Payment back to Cash (or clear the customer)                | The credit-check panel disappears                                                                   |

## 19. Expenses

Non-sale purchases — office supplies, services and similar — previously the
"Other Purchases" tab on Procurement, now its own page.

| #       | Scenario              | Steps                                                                             | Expected                                                 |
| ------- | --------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 19.1 ✅ | Record a purchase     | Expenses → + Record Purchase, description/category/amount (+ optional supplier/WHT), submit | Appears in the list; feeds into the Finance report         |
| 19.2 ❌ | Missing description   | Submit with description blank                                                     | `Description is required`                                 |
| 19.3 ❌ | Zero/negative amount  | Amount ≤ 0                                                                        | `Amount must be greater than zero`                        |
| 19.4 ❌ | Unknown supplier      | (API-level) bad supplierId                                                        | `Supplier not found`                                       |
| 19.5 ✅ | Search + sort         | Search by description/category; click sortable headers                          | Debounced search; correct asc/desc ordering                |
| 19.6 ✅ | Withholding on an expense | Set withholding type/rate when recording                                     | `withholdingAmount`/`netPayable` computed correctly, rolls into the Finance report |

---

## Sign-off template

Copy this per test run:

```
Test run date: ____________
Tester: ____________
Environment: local / staging
Backend commit: ____________
Modules fully passed: ____ / 17
Failures found (link to issue/notes): ____________
```
