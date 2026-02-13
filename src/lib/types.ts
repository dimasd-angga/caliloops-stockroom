
import { Timestamp } from 'firebase/firestore';

export type InventoryItem = {
  id: string;
  name: string;
  stock: number;
  price: number;
  location: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
};

export type RecentSale = {
  id: string;
  name: string;
  email: string;
  amount: string;
};

export type Permissions = {
  // Inbound
  canGenerateBarcode: boolean;
  canReprintBarcode: boolean;
  canDeleteItemList: boolean;
  canEditItemDetails: boolean;
  canEditPackQuantity: boolean;
  canPrintAll: boolean;
  canPrintSelected: boolean;

  // Warehouse In/Out & Stock Opname
  canStartStockOpname: boolean;
  canMarkItemAsLost: boolean;
  canRestoreLostItem: boolean;
  
  // User & Role Management
  canManageUsers: boolean;
  canManageRoles: boolean;

  // Activity & Reporting
  canViewActivityLogs: boolean;
  canExportLogs: boolean;
  canClearLogs: boolean;

  // Master Data
  canManageSuppliers: boolean;
  canManagePurchaseOrders: boolean;
  canManageCouriers: boolean;
  canManageRefunds: boolean;
  canManageShipping: boolean; // New permission

  // General
  hasFullAccess: boolean;
};

export type Role = {
  id: string;
  name: string;
  permissions: Permissions;
};

export type Store = {
  id: string;
  name: string;
  location: string;
  createdAt: Timestamp;
  skuCount?: number;
};

export type Courier = {
  id: string;
  name: string;
  courierCode: string;
  warehouseAddress: string;
  marking: string;
  contactPerson: string;
  storeId: string;
  createdAt: Timestamp;
};

export type User = {
  id: string;
  name:string;
  email: string;
  roleId: string;
  storeId?: string;
};

export type UserWithRole = User & {
  role: Role | null;
  store?: Store | null;
}

export type Unit = 'pcs' | 'box' | 'carton' | 'pallet';

export type Pack = {
  id: string;
  quantity: number;
  unit: Unit;
  note?: string;
  barcodeId?: string;
  status?: 'in-stock' | 'out-of-stock' | 'lost'; // Add status to pack
  isPrinted?: boolean;
}

export type Sku = {
  id: string;
  skuName: string;
  skuCode: string;
  storeId: string;
  remainingQuantity: number;
  remainingPacks: number;
  createdAt?: Timestamp;
  lastAuditDate?: Timestamp;
  imageUrl?: string;
  keywords?: string[];
  // Shipping info (calculated, not stored in DB)
  shippingInfo?: Array<{
    quantity: number;
    poNumber: string;
    estimatedArrival: Date;
  }>;
}

export type Supplier = {
  id: string;
  name: string;
  supplierCode: string;
  description?: string;
  chatSearchName?: string;
  storeId: string;
  createdAt: Timestamp;
}

export type PurchaseOrder = {
  id: string;
  poNumber: string; 
  orderNumber?: string; 
  orderDate: Timestamp; 
  
  storeId: string;
  supplierId: string;
  supplierName: string; 
  supplierCode: string; 
  
  chatSearch: string; 
  
  totalPcs: number;
  totalRmb: number;
  exchangeRate: number;
  totalPembelianIdr?: number; // New optional field
  
  marking: string; 
  
  shippingCost?: number; 
  costPerPiece?: number;
  
  packageCount?: number;
  photoUrl?: string;
  trackingNumber: string[];
  shippingNote?: string;

  // Quantity tracking fields (new structure)
  qtyReceived?: number;       // Total qty diterima dari PO ini
  qtyNotReceived?: number;    // Total qty tidak diterima
  qtyDamaged?: number;        // Total qty rusak
  // Note: totalPcs = qtyReceived + qtyNotReceived + qtyDamaged

  // Old quantity fields (deprecated, kept for backward compatibility)
  totalPcsOldReceived?: number;
  totalPcsNewReceived?: number;
  totalPcsRefunded?: number;

  // Statuses
  status: 'INPUTTED' | 'IN SHIPPING (PARTIAL)' | 'IN SHIPPING' | 'RECEIVED (PARTIAL)' | 'RECEIVED' | 'DONE';
  isStockUpdated: boolean;
  
  // New confirmation fields
  isOldItemsInPurchaseMenu?: boolean;
  isNewItemsPdfCreated?: boolean; // New field
  isPrintoutCreated?: boolean; // New field
  isNewItemsUploaded?: boolean;
  isNewItemsAddedToPurchase?: boolean;

  // Refund - Now read-only from other systems
  hasRefund: boolean;
  refundAmountYuan?: number;
  isSupplierRefundApproved: boolean;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // For frontend joins
  supplier?: Supplier;
  refund?: Refund;
};

export type Refund = {
    id: string;
    storeId: string;
    
    poId: string;
    poNumber: string;
    orderDate: Timestamp;
    orderNumber?: string;
    supplierId: string;
    supplierName: string;
    supplierCode: string;
    chatSearch: string;
    
    refundAmount: number;
    notes?: string;
    
    isSupplierApproved: boolean;
    isDeducted: boolean;
    deductedDate?: Timestamp;

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type Shipping = {
    id: string;
    storeId: string;

    marking: string;
    kodeStorage?: string;
    kodeKontainer?: string;
    jumlahKoli: number;
    noResi: string[];
    tanggalStokDiterima: Timestamp | null;
    harga: number;

    // Auto-calculated fields
    linkedPoNumbers: string[];
    calculatedTotalPcs: number;
    calculatedTotalRmb: number;
    combinedPhotoLink?: string;
    costPerPiece: number;

    // New fields for status and payment
    status: 'SHIPPING' | 'RECEIVED';
    isPaid: boolean;
    paidDate: Timestamp | null;

    createdAt: Timestamp;
    createdBy: string;
}

export type PurchaseOrderItem = {
    id: string;
    poId: string;
    poNumber: string;
    storeId: string;

    // From Excel (Chinese columns)
    serialNumber: number; // 序号
    itemCode: string; // 货号
    itemName: string; // 货品名称
    specification: string; // 规格
    quantity: number; // 数量/Quantity
    unitPrice: number; // 单价 (in Yuan)
    discount: number; // 优惠（元）
    amount: number; // 金额（元）

    // SKU Mapping & Calculations
    skuId?: string; // Selected SKU ID
    skuCode?: string; // SKU Code
    skuName?: string; // SKU Name
    imageUrl?: string; // Product photo URL
    hargaBarang: number; // Auto-calculated: unitPrice * exchangeRate
    costPerPcs: number; // From PO
    modalBarang: number; // Auto-calculated: hargaBarang + costPerPcs

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type POReceive = {
    id: string;
    poId: string;
    poNumber: string;
    storeId: string;
    supplierId: string;
    supplierName: string;

    status: 'IN_PROGRESS' | 'COMPLETED';

    totalItemsCount: number;
    totalReceivedItems: number; // How many items have receive input

    createdAt: Timestamp;
    updatedAt: Timestamp;
    completedAt?: Timestamp;
}

export type POReceiveItem = {
    id: string;
    poReceiveId: string;
    poId: string;
    poNumber: string;
    storeId: string;
    poItemId: string; // Reference to purchaseOrderItems

    // Original PO Item Data (copied from purchaseOrderItems)
    serialNumber: number;
    itemCode: string;
    itemName: string;
    specification: string;
    quantity: number; // Original ordered quantity
    unitPrice: number;
    discount: number;
    amount: number;
    skuId?: string;
    skuCode?: string;
    skuName?: string;
    imageUrl?: string; // Product photo
    hargaBarang: number;
    costPerPcs: number;
    modalBarang: number;

    // Receive Data (user input)
    qtyReceived: number; // 收到的数量
    qtyNotReceived: number; // 没收到的数量 (auto calculated)
    qtyDamaged: number; // 坏掉的数量

    // Calculated fields
    totalPcsFinal: number; // qtyReceived + qtyNotReceived + qtyDamaged
    amountNotReceived: number; // qtyNotReceived * unitPrice
    amountDamaged: number; // qtyDamaged * unitPrice

    // Status tracking
    hasReceivedInput: boolean; // Has user clicked "Input Terima"?

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type DraftInboundShipment = {
    id: string;
    poReceiveItemId: string;
    storeId: string;
    skuId: string;
    skuCode: string;
    poId: string;
    poNumber: string;
    supplierId: string;
    supplierName: string;
    packs: Array<{
        quantity: number;
        unit: Unit;
        note: string;
    }>;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type InboundShipment = {
  id:string;
  skuId: string;
  skuName: string;
  skuCode: string;
  storeId: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId: string;
  poNumber: string;
  packs: Pack[];
  totalQuantity: number;
  createdBy: string; // The name of the user who created it
  createdAt: Timestamp;
  updatedAt: Timestamp;
};


export type Barcode = {
    id: string;
    inboundShipmentId: string;
    packId: string;
    skuId: string;
    storeId: string;
    skuName: string;
    skuCode: string;
    barcodeID: string;
    quantity: number;
    unit: Unit;
    status: 'in-stock' | 'out-of-stock' | 'lost';
    isPrinted: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    supplier?: string; // This is now supplierName
    poNumber?: string;
};

export type WarehouseLog = {
    id: string;
    datetime: Timestamp;
    user: string;
    barcodeID: string;
    skuName: string;
    quantity: number;
    unit: Unit;
    action: 'in' | 'out';
    storeId: string;
    adminImageURL?: string | null;
};

export type StockOpnameLog = {
    id: string;
    user: string;
    skuName: string;
    skuCode: string;
    storeId: string;
    datetime: Timestamp;
    totalPacks: number;
    totalPcs: number;
    totalOKPacks: number;
    totalOKPcs: number;
    totalNotOKPacks: number;
    totalNotOKPcs: number;
    status: 'OK' | 'NOT OK';
    notOkBarcodes: string[];
    discrepancyStatus: 'pending' | 'confirmed';
};
    
export type UnifiedLog = {
    id: string;
    datetime: Date;
    type: 'Inbound' | 'Warehouse' | 'Opname';
    sku: string;
    storeId: string;
    details: string;
    user: string;
    status: string | null;
};

// Add a new context type for the current user
export type UserContextType = {
  user: UserWithRole | null;
  loading: boolean;
  permissions: Permissions;
  selectedStoreId: string | null;
  setSelectedStoreId: (storeId: string | null) => void;
};
