---

# **FORTINVENTORY**  
**Pharmacy Inventory Management System**  
**Requirements Specification Document**


---

## **1. Executive Summary**

PharmaInventory is a **free, robust, and pharmacy-specific inventory management system** designed to provide real-time visibility, reduce stockouts, automate restocking, and streamline pharmacy operations.

The system eliminates hidden charges and subscription fees while offering enterprise-grade features tailored for pharmacies.

---

## **2. Core Objectives**

- Real-time inventory tracking and visibility
- Significant reduction in stockout risks through prescription-based insights
- Automated restocking recommendations
- Improved operational efficiency
- Full traceability of stock movements
- Multi-location (warehouse) support
- Role-based access control
- Comprehensive reporting (Financial & Sales)

---

## **3. Key Modules & Functionalities**

### **3.1 Interactive Dashboard**

- Real-time stock overview
- Low stock / Expiring soon alerts
- Quick links to Purchase Orders, Dispensing, and Reports
- Sales performance summary
- Top moving products

### **3.2 Alerts Module**

- **Alert Types**:
  - Expiring / Expired Items
  - Low Stock
  - Over Stock
  - Stock Adjustments
- **Alert Details**:
  - Reason
  - Movement Type
  - Performed By
  - Move Date
  - Quantity
  - Expiry Date
  - Batch Number

### **3.3 Locations / Warehouse Management**

- Support for multiple warehouses/stores
- Fields:
  - Location Name
  - Location Type (Retail, Warehouse, Dispensary, etc.)
  - Full Address
  - Contact Person (optional)

### **3.4 User Management & Roles**

**Four Roles**:

1. **Admin** – Full access
2. **Accountants** – Finance, Reports, Wallet
3. **Operations** – Inventory, Procurement, Stock Adjustments
4. **Sales** – Dispensing, Sales History

**Additional Feature**: Roles & Permissions page (view/edit permissions per role)

---

### **3.5 Product Management**

- **Add Product** with following fields:
  - Type (Medication, Equipment, Cosmetics)
  - Pharmacotherapeutic Class \*
  - Generic Name \*
  - Medication Brand Name
  - Description
  - Strength/Dose
  - Dose Unit
  - Route
  - Dose Form (selectable list)
  - Order Unit
  - Dispense Unit
  - Conversion Factor
  - Country of Origin
  - Manufacturer
  - Supplier (linkable)
  - Unit Price

- **Bulk Operations**:
  - Download Excel Template / Export Products (with batch selection + filters)
  - Upload Products via Excel

- **Bin Card Report**:
  - Search Product
  - Select Store/Location
  - Date Range
  - Printable/PDF report showing:
    - Product Name, Description, Code
    - Detailed table: Date | Batch | Expiry | Supplier | In | Out | Balance | Performed By | Remark

---

### **3.6 Inventory Management**

- View all items with:
  - Code, Generic Name, Brand, Description, Current Quantity, Price, Supplier, Batch No., Expiry Date
- **Stock Adjustment**:
  - Quantity
  - Reason
  - Type (Increase / Decrease)
- Filter, Search, Export functionality
- All adjustments appear in Alerts

---

### **3.7 Procurement Module**

- **Suppliers Management** (CRUD)
  - Name, TIN, Phone, Email, Address, Bank Accounts
- **Goods Receiving (GRV)**
  - Select products from list (filter/search)
  - Create Purchase Order
  - Enter: Qty, Batch, Expiry Date, Price, Location
  - Calculate totals
- **GRV History**
- Purchase management for non-sale items (office supplies, etc.)

---

### **3.8 Sales & Dispensing**

- **Dispense Order**:
  - Select Location
  - Select Product → Choose Batch
  - Quantity
  - Price adjustment (for this sale only)
- Dispense Summary (editable quantities)
- Print Dispense Slip
- Sales History + Attachments

---

### **3.9 Wallet / Finance**

- Track sales (Cash & Credit)
- Outstanding balances
- Record payments
- Withholding Tax handling (Goods & Services)

---

### **3.10 Reports**

**Two Main Report Types**:

1. **Finance Report** (PDF)
   - Total Sales
   - Cost of Goods Sold (COGS)
   - Gross Profit
   - Revenue, Payments

2. **Sales Report** (PDF)
   - Performance by period
   - Date-wise revenue

**Common Features**:

- Filter by Location & Date Range
- Professional PDF with Logo + Signature block

---

### **3.11 Settings**

- General system settings

## NB - FOR THE SALE AND PURCHSE THERE WILL BE OPTIONAL WITH HOLDING TAX - AND HANDLING THE SERVICES AND GOODS TAXES

## **4. Non-Functional Requirements**

- Responsive design (Desktop + Tablet)
- Multi-user support with role-based permissions
- Data export (Excel & PDF eith logo styled )
- Audit trail for all stock movements
- Secure (User authentication)

tech stack- backend node.js ,frontend next.js,postgress sql (with docker)
