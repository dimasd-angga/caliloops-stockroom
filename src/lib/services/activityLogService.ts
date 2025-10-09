
import { firestore } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import type {
  UnifiedLog,
  InboundShipment,
  WarehouseLog,
  StockOpnameLog,
} from '../types';

const inboundCollection = collection(firestore, 'inboundShipments');
const warehouseLogCollection = collection(firestore, 'warehouseLogs');
const opnameLogCollection = collection(firestore, 'stockOpnameLogs');

export const subscribeToAllLogs = (
  storeId: string | null,
  callback: (logs: UnifiedLog[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  let allLogs: UnifiedLog[] = [];
  
  let inboundLogs: UnifiedLog[] = [];
  let warehouseLogs: UnifiedLog[] = [];
  let opnameLogs: UnifiedLog[] = [];

  const combineAndSortLogs = () => {
    // Combine logs from all sources
    const combined = [...inboundLogs, ...warehouseLogs, ...opnameLogs];
    // Sort by datetime descending
    combined.sort((a, b) => b.datetime.getTime() - a.datetime.getTime());
    allLogs = combined;
    callback(allLogs);
  };
  
  const inboundConstraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (storeId) {
    inboundConstraints.push(where('storeId', '==', storeId));
  }
  const qInbound = query(inboundCollection, ...inboundConstraints);
  const unsubInbound = onSnapshot(qInbound, (snapshot) => {
    inboundLogs = snapshot.docs.map((doc) => {
      const data = doc.data() as InboundShipment;
      return {
        id: `inbound-${doc.id}`,
        datetime: data.createdAt.toDate(),
        type: 'Inbound',
        sku: data.skuCode,
        storeId: data.storeId,
        details: `Shipment received for ${data.totalQuantity} ${data.packs.length > 1 ? 'items' : 'item'} from ${data.supplier} (PO: ${data.poNumber})`,
        user: data.createdBy,
        status: 'Received',
      };
    });
    combineAndSortLogs();
  }, onError);

  const warehouseConstraints: QueryConstraint[] = [orderBy('datetime', 'desc')];
  if (storeId) {
    warehouseConstraints.push(where('storeId', '==', storeId));
  }
  const qWarehouse = query(warehouseLogCollection, ...warehouseConstraints);
  const unsubWarehouse = onSnapshot(qWarehouse, (snapshot) => {
    warehouseLogs = snapshot.docs.map((doc) => {
      const data = doc.data() as WarehouseLog;
      return {
        id: `warehouse-${doc.id}`,
        datetime: data.datetime.toDate(),
        type: 'Warehouse',
        sku: data.skuName,
        storeId: data.storeId,
        details: `Item ${data.barcodeID} (${data.quantity} ${data.unit}) marked as ${data.action.toUpperCase()}`,
        user: data.user,
        status: data.action.toUpperCase(),
      };
    });
    combineAndSortLogs();
  }, onError);
  
  const opnameConstraints: QueryConstraint[] = [orderBy('datetime', 'desc')];
  if (storeId) {
    opnameConstraints.push(where('storeId', '==', storeId));
  }
  const qOpname = query(opnameLogCollection, ...opnameConstraints);
  const unsubOpname = onSnapshot(qOpname, (snapshot) => {
    opnameLogs = snapshot.docs.map((doc) => {
      const data = doc.data() as StockOpnameLog;
      return {
        id: `opname-${doc.id}`,
        datetime: data.datetime.toDate(),
        type: 'Opname',
        sku: data.skuCode,
        storeId: data.storeId,
        details: `Stock opname for ${data.skuName}. Found: ${data.totalOKPacks} pack of ${data.totalPacks} packs.`,
        user: data.user,
        status: data.status,
      };
    });
    combineAndSortLogs(); // Combine and sort every time any source updates
  }, onError);

  // Return a function that unsubscribes from all listeners
  return () => {
    unsubInbound();
    unsubWarehouse();
    unsubOpname();
  };
};
