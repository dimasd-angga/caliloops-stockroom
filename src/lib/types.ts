
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
  poNumber: string; // Auto-generated running number
  orderNumber?: string; // Manual input
  orderDate: Timestamp; // Manual input with date picker
  
  storeId: string;
  supplierId: string;
  supplierName: string; // Denormalized for display
  supplierCode: string; // Denormalized for display
  
  chatSearch: string; // Manual text input
  
  totalPcs: number;
  totalRmb: number;
  exchangeRate: number;
  
  marking: string; // Selected from Courier DB
  
  shippingCost?: number; 
  costPerPiece?: number;
  
  packageCount?: number;
  photoUrl?: string;
  trackingNumber: string[];
  shippingNote?: string;

  // New quantity tracking fields
  totalPcsOldReceived?: number;
  totalPcsNewReceived?: number;
  totalPcsRefunded?: number;

  // Statuses
  status: 'INPUTTED' | 'SHIPPING' | 'RECEIVED' | 'DONE';
  isStockUpdated: boolean;
  
  // New confirmation fields
  isOldItemsInPurchaseMenu?: boolean;
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
    noResi: string[]; // Changed from string to string[]
    tanggalStokDiterima: Timestamp;
    harga: number; // Shipping cost

    // Auto-calculated fields
    linkedPoNumbers: string[];
    calculatedTotalPcs: number;
    calculatedTotalRmb: number;
    combinedPhotoLink?: string;
    costPerPiece: number;

    createdAt: Timestamp;
    createdBy: string;
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
