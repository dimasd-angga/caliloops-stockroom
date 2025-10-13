
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
}

export type InboundShipment = {
  id:string;
  skuId: string;
  skuName: string;
  skuCode: string;
  storeId: string;
  supplier: string;
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
    supplier?: string;
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
