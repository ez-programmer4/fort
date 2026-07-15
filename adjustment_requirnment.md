PHARMAINVENTORY
Adjustments & Enhancements Specification
Version 1.1
Date: July 16, 2026

1. Global / Cross-Cutting Adjustments
   1.1 Pagination

All list/tables across the system must have adjustable rows per page
Default: 10 records per page
Options: 10, 25, 50, 100

1.2 Form Experience (Add / Update)

Replace modals with Drawer (Slide-in Panel)
Drawer should slide smoothly from the right edge of the screen

Support both Add and Edit operations

1.3 Search Behavior

Implement debounced search (trigger after user stops typing for 300–400ms)
Minimum 2–3 characters before triggering search

1.4 Date Picker

Build a custom reusable Date Picker component for better compatibility across browsers and devices
Support single date and date range selection

1.5 Navbar & Sidebar

Add expand/collapse icon on the top navbar
This icon should control the left sidebar (open/close)
Sidebar should be collapsible (collapsed state shows only icons)

1.6 Loading States

All loading states should display the company name (e.g. “PharmaInventory”) with a professional spinner
Consistent loading animation across the application

2. Module-Specific Adjustments
   2.1 Alerts Module

Expiring Items:
Add "Dispose" action button for expired / near-expired items

Add Search + Filter functionality
Show Product Details (clickable) within each alert

2.2 Dashboard Enhancements
Add the following new sections:
Profits Overview

Gross Profit
Net Profit / Loss
Clear display with trend indicators (↑ / ↓ with percentage)

Top Customers

Ranked by sales volume and frequency
Show Last Order Date for each customer

Real-time Graphs / Charts

Sales vs Purchases Trend (Line Chart)
Gross & Net Profit Trends (Line / Area Chart)
Top Products by Margin
Top Products by Volume
Monthly Performance Overview

2.3 Selection Fields (Supplier / Product)

Replace simple dropdowns with Searchable Select / Combobox
Support large lists (search while typing)
Apply to:
Supplier selection
Product selection (especially in Procurement & Sales)

2.4 Sales Module

Add Printable Sales History
Include Day Picker (Date Range) for filtering history
Print view should be well-formatted and professional
