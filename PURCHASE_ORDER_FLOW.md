# Purchase Order Complete Flow Documentation

## Overview
This document explains the complete flow from creating a Purchase Order (PO) to receiving items and managing inventory in the stockroom system.

---

## Complete Flow: From PO Creation to Stock Receipt

### 1. CREATE PURCHASE ORDER
**Location**: `/dashboard/purchase-orders` → "Create PO" button

**Steps:**
1. Click "Create PO" button
2. Fill in PO details:
   - PO Number (e.g., PO0001383)
   - Order Date
   - Supplier (select from dropdown)
   - Exchange Rate (CNY to IDR)
   - Cost Per Piece (shipping cost per item)
   - Marking (container/package identifier)
   - Tracking Numbers (optional)
3. Click "Create"

**Result:**
- PO created with status: `INPUTTED`
- System calculates: `totalPembelianIdr` (will be calculated after items are added)
- PO appears in Purchase Orders list

---

### 2. ADD ITEMS TO PURCHASE ORDER
**Location**: `/dashboard/purchase-orders/[id]/items`

**Methods to Add Items:**

#### Method A: Excel Upload (Recommended for bulk)
1. Click "Upload Excel" button
2. Download template if needed (序号, 货号, 货品名称, 规格, 数量, 单价, 优惠, 金额)
3. Upload your Excel file with item details
4. Choose "Replace" (remove old items) or "Append" (add to existing)
5. System automatically calculates for each item:
   - `hargaBarang` = `unitPrice` × `exchangeRate`
   - `costPerPcs` = from PO's `costPerPiece`
   - `modalBarang` = `hargaBarang` + `costPerPcs`

#### Method B: Manual Entry
1. Click "Add Row" button
2. Fill in item details manually
3. System auto-calculates the same fields

**SKU Mapping (Critical Step):**
1. For each item, click the SKU dropdown in the "SKU" column
2. Search and select the matching SKU from your inventory
3. System automatically saves when you select an SKU
4. The item now has: `skuId`, `skuCode`, `skuName`, and `imageUrl` (if SKU has photo)

**Important Notes:**
- SKU mappings are saved **immediately** when you select them
- Other field changes (like quantity, price) are **auto-saved after 1 second** (debounced)
- Click "Save Items" button to:
  - Wait for all pending saves to complete
  - Refresh the view to show latest state
  - Confirm all changes are persisted
  - **Prompt to update PO status to IN SHIPPING** (if items have SKU mappings)

**Status Update Prompt:**
After saving items with SKU mappings, you'll be asked:
- "Update PO Status to IN SHIPPING?"
- Benefits of changing to IN SHIPPING:
  - Items appear in Inbound under "Items in Shipping"
  - Shows estimated arrival date
  - Warehouse staff can see incoming stock
- You can click "Yes" to update immediately, or "Not Now" to change manually later

**Result:**
- All items are saved in `purchaseOrderItems` collection
- Items with SKU mapping are ready for PO Receive flow
- Items without SKU mapping cannot be received (will be filtered out in PO Receive)
- Optionally, PO status updated to `IN SHIPPING` for better visibility

---

### 3. UPDATE PO STATUS (Manual)
**Location**: `/dashboard/purchase-orders/[id]` → "Edit" button

**Status Progression:**
1. `INPUTTED` → Initial state after PO creation
2. `IN SHIPPING` → Items are being shipped from supplier
3. `IN SHIPPING (PARTIAL)` → Some items arrived, some still shipping
4. `RECEIVED` → All items physically arrived at warehouse
5. `RECEIVED (PARTIAL)` → Some items processed in PO Receive
6. `DONE` → All items received and processed

**When to Change Status:**
- Change to `IN SHIPPING` when supplier confirms shipment
- Change to `RECEIVED` when physical goods arrive at warehouse
- System will automatically change to `DONE` when PO Receive is completed

**Impact of Status Changes:**
- When PO is `IN SHIPPING` or `IN SHIPPING (PARTIAL)`:
  - Items appear in **Inbound SKU Details** under "Items in Shipping" section
  - Shows: Quantity, PO Number, Estimated Arrival (Order Date + 1 month)
  - This gives warehouse staff visibility of incoming stock

---

### 4. PO RECEIVE - INSPECT & RECORD ITEMS
**Location**: `/dashboard/purchase-orders/[id]` → Actions → "PO Receive"

**Purpose**: Record what was actually received, damaged, or missing

**Flow:**

#### Step 4.1: Initialize PO Receive
- System automatically creates `POReceive` record
- Copies all items with SKU mapping from `purchaseOrderItems` to `poReceiveItems`
- Items **without SKU** are excluded (they cannot be received into inventory)
- Status: `IN_PROGRESS`

#### Step 4.2: Process Each Item
For each item in the table, you have two actions:

**A. Input Terima (Input Received) - Green Button**
1. Click "Input Terima" button
2. Modal opens with:
   - Supplier (auto-filled from PO)
   - PO Number (auto-filled from PO)
   - Quantity per Pack form
3. Enter the packs received:
   - Quantity (number)
   - Unit (pcs/box/carton/pallet)
   - Note (optional)
4. Can add multiple packs
5. Two actions available:
   - **Save**: Saves draft locally (survives page refresh)
   - **Submit Shipment**:
     - Creates `InboundShipment` in Firestore
     - Generates barcodes for each pack
     - Updates `qtyReceived` in `poReceiveItems`
     - Updates `totalReceivedItems` count in `POReceive`
     - Deletes draft
     - Modal closes

**B. Input Rusak (Input Damaged) - Orange Button**
1. Click "Input Rusak" button
2. Modal shows:
   - Current quantities
   - Max allowed damaged qty
   - Preview of calculations
3. Enter damaged quantity
4. Click "Save"
5. System updates:
   - `qtyDamaged` in `poReceiveItems`
   - `amountDamaged` (damaged qty × unit price)
   - Recalculates `qtyNotReceived` and `totalPcsFinal`

#### Step 4.3: Complete PO Receive
When all items are processed:
1. Click "Done" button (only enabled when all items have receive input)
2. System validates: all items must have `hasReceivedInput = true`
3. System automatically:
   - Creates **Refund** record for:
     - All not received items (`qtyNotReceived` × `unitPrice`)
     - All damaged items (`qtyDamaged` × `unitPrice`)
   - Sets `POReceive.status = COMPLETED`
   - Sets `POReceive.completedAt = now()`
4. Redirects back to Purchase Orders list

**Result:**
- Inbound shipments created with barcodes
- Damaged quantities recorded
- Refunds auto-created for supplier
- PO Receive marked as complete

---

### 5. INBOUND MANAGEMENT - VIEW & PRINT BARCODES
**Location**: `/dashboard/inbound`

**Purpose**: Manage inventory for each SKU, print barcode labels

**Flow:**

#### Step 5.1: View SKU List
- Shows all SKUs in your store
- Search by SKU code or name
- Displays remaining packs and quantity

#### Step 5.2: View SKU Details
Click "View Details" on any SKU to see:

**A. Items in Shipping Section** (NEW!)
- Only appears if there are POs with status `IN SHIPPING` containing this SKU
- Shows for each shipping PO:
  - Quantity in pieces
  - PO Number
  - Estimated Arrival Date (Order Date + 1 month)
- This helps warehouse staff know what's coming

**B. Inbound Shipments Table**
- Lists all inbound shipments for this SKU
- Shows:
  - PO Number
  - Supplier
  - Pack quantity and unit
  - Status (in-stock/lost)
  - Printed status
  - Shipment date
- Actions available:
  - **View Barcode**: Preview and print single barcode
  - **Print Selected**: Print multiple selected barcodes
  - **Print All**: Print all unprintedbarcode labels
  - **Start Audit**: Begin stock opname for this SKU

#### Step 5.3: Print Barcode Labels
1. Select packs to print (or click "Print All")
2. System generates PDF with barcode labels
3. Each label shows:
   - Barcode (ITF format)
   - SKU Code
   - PO Number & Supplier
   - Quantity & Unit
4. Download PDF
5. Print on label printer (configured size: 20mm × 50mm landscape)
6. System marks barcodes as `isPrinted = true`

**Result:**
- Physical barcode labels ready to stick on packages
- Inventory tracked by barcode
- Ready for warehouse operations (picking, packing, shipping, stock opname)

---

## Data Flow Summary

### Collections & Relationships

```
purchaseOrders (PO)
  ↓
  └─ purchaseOrderItems (PO Items)
       ├─ skuId → links to SKUs
       ↓
       └─ (copied to) poReceiveItems
            ↓
            ├─ Input Terima → creates InboundShipment
            │   └─ InboundShipment → generates Barcodes
            │        └─ Barcode → printed labels
            │
            ├─ Input Rusak → updates qtyDamaged
            │
            └─ Done → creates Refund (if needed)
```

### Key Connections

1. **PO Items ↔ SKUs**:
   - Mapped in Items page
   - Enables inventory tracking

2. **PO Status ↔ Shipping Info**:
   - When PO status = `IN SHIPPING`
   - Items appear in Inbound SKU Details

3. **PO Receive ↔ Inbound Shipments**:
   - "Input Terima" creates inbound shipments
   - Links: `poReceiveItemId` in draft, `purchaseOrderId` in shipment

4. **Inbound Shipments ↔ Barcodes**:
   - Each pack gets a unique barcode
   - Used for warehouse operations

5. **PO Receive ↔ Refunds**:
   - Auto-created when PO Receive is completed
   - Tracks amounts to claim from supplier

---

## Important Rules & Validations

### Items Page
- ✅ SKU selections auto-save immediately
- ✅ Field changes auto-save after 1 second
- ✅ "Save Items" button ensures all changes are persisted
- ❌ Cannot proceed to PO Receive without SKU mappings

### PO Receive
- ❌ Only items WITH SKU mapping are shown
- ❌ Cannot click "Done" until all items have receive input
- ✅ Draft shipments survive page refresh
- ✅ Refunds auto-created for missing/damaged items

### Inbound Management
- ✅ Barcodes can only be reprinted with special permission
- ✅ "Items in Shipping" only shows for IN_SHIPPING POs
- ✅ Stock opname updates SKU quantities

---

## Troubleshooting

### SKU selections not saving?
- Wait 1-2 seconds after selecting (system auto-saves)
- Click "Save Items" to force refresh
- Check browser console for errors

### Items not showing in PO Receive?
- Verify items have SKU mapped in Items page
- Only items with `skuId` field are copied to PO Receive

### Shipping info not appearing in Inbound?
- Check PO status is `IN SHIPPING` or `IN SHIPPING (PARTIAL)`
- Verify items have SKU mapping
- Refresh the SKU details page

### Cannot complete PO Receive?
- Ensure all items have been processed (Input Terima or Input Rusak)
- Check for error messages about missing input
- Verify you have proper permissions

---

## Best Practices

1. **Map SKUs Early**: Map all SKUs in Items page before changing PO status
2. **Update Status Promptly**: Change to IN_SHIPPING when supplier ships
3. **Use Drafts**: Use "Save" in Input Terima to save progress without committing
4. **Double-Check Quantities**: Verify received quantities match physical goods
5. **Print Labels Immediately**: Print barcodes right after receiving items
6. **Complete PO Receive**: Don't leave PO Receive incomplete - finish same day

---

## Technical Notes

### Auto-Calculations
- `hargaBarang` = `unitPrice` × `exchangeRate`
- `modalBarang` = `hargaBarang` + `costPerPiece`
- `qtyNotReceived` = `quantity` - `qtyReceived` - `qtyDamaged`
- `totalPcsFinal` = `qtyReceived` + `qtyNotReceived` + `qtyDamaged`
- `amountNotReceived` = `qtyNotReceived` × `unitPrice`
- `amountDamaged` = `qtyDamaged` × `unitPrice`

### Estimated Arrival
- Calculated as: `orderDate` + 1 month
- Used for planning and warehouse capacity

### Barcode Format
- Type: ITF (Interleaved 2 of 5)
- Encoding: Auto-generated unique ID
- Label size: 20mm × 50mm landscape
- Contains: SKU, PO Number, Supplier, Quantity

---

**Last Updated**: 2026-01-20
**Version**: 1.0
