
import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  where,
  updateDoc,
  doc,
  getDoc,
  writeBatch,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import type { PurchaseOrderItem, PurchaseOrder, POReceive, POReceiveItem } from '../types';
import { getPOReceiveByPOId, getPOReceiveItems } from './poReceiveService';
import { getAllSkusByStore } from './skuService';

const poItemsCollection = collection(firestore, 'purchaseOrderItems');

export const subscribeToPOItems = (
  poId: string,
  callback: (items: PurchaseOrderItem[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(
    poItemsCollection,
    where('poId', '==', poId),
    orderBy('serialNumber', 'asc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as PurchaseOrderItem)
      );
      callback(items);
    },
    (error) => {
      console.error('Error subscribing to PO items: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};

export const getPOItems = async (poId: string): Promise<PurchaseOrderItem[]> => {
  const q = query(
    poItemsCollection,
    where('poId', '==', poId),
    orderBy('serialNumber', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PurchaseOrderItem));
};

export const getPOItemsCount = async (poId: string): Promise<number> => {
  const q = query(
    poItemsCollection,
    where('poId', '==', poId)
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
};

/**
 * Get aggregated SKU data from all PO items in shipping status
 * Returns data grouped by SKU with total quantities and PO numbers
 * Updated to account for PO Receive progress (only counts qty not yet received)
 */
export const getSkusInShipping = async (storeId: string): Promise<{
  skuCode: string;
  skuName: string;
  totalPack: number;
  totalQty: number;
  totalPcs: number;
  qtyReceived: number;
  qtyNotReceived: number;
  qtyDamaged: number;
  poNumbers: string;
}[]> => {
  // Get ALL POs for the store (not just status = IN SHIPPING)
  // We'll calculate dynamic status and filter afterwards
  const posCollection = collection(firestore, 'purchaseOrders');
  const posQuery = query(
    posCollection,
    where('storeId', '==', storeId)
  );
  const posSnapshot = await getDocs(posQuery);

  if (posSnapshot.empty) {
    return [];
  }

  // Get shipping data to calculate dynamic status
  const shippingCollection = collection(firestore, 'shipping');
  const shippingQuery = query(shippingCollection, where('storeId', '==', storeId));
  const shippingSnapshot = await getDocs(shippingQuery);

  const resiStatusMap = new Map<string, 'RECEIVED' | 'SHIPPING'>();
  shippingSnapshot.docs.forEach(doc => {
    const shippingData = doc.data() as any;
    const resiList = Array.isArray(shippingData.noResi) ? shippingData.noResi : [shippingData.noResi].filter(Boolean);
    resiList.forEach(resi => {
      resiStatusMap.set(resi, shippingData.status);
    });
  });

  // Calculate dynamic status for each PO and filter for IN SHIPPING
  const posInShipping: PurchaseOrder[] = [];

  for (const doc of posSnapshot.docs) {
    const poData = { id: doc.id, ...doc.data() } as PurchaseOrder;

    // Skip if already DONE
    if (poData.status === 'DONE') {
      continue;
    }

    const poTrackingNumbers = poData.trackingNumber || [];
    const totalResiInPo = poTrackingNumbers.length;

    let dynamicStatus: PurchaseOrder['status'] = poData.status;

    if (totalResiInPo > 0) {
      const associatedShippingStatuses = poTrackingNumbers.map(tn => resiStatusMap.get(tn)).filter(Boolean);
      const receivedCount = associatedShippingStatuses.filter(s => s === 'RECEIVED').length;

      if (receivedCount === totalResiInPo) {
        dynamicStatus = 'RECEIVED';
      } else if (receivedCount > 0) {
        dynamicStatus = 'RECEIVED (PARTIAL)';
      } else if (associatedShippingStatuses.length === totalResiInPo) {
        dynamicStatus = 'IN SHIPPING';
      } else if (associatedShippingStatuses.length > 0) {
        dynamicStatus = 'IN SHIPPING (PARTIAL)';
      }
    }

    // Only include POs with IN SHIPPING status (calculated)
    if (dynamicStatus === 'IN SHIPPING' || dynamicStatus === 'IN SHIPPING (PARTIAL)') {
      posInShipping.push(poData);
    }
  }

  if (posInShipping.length === 0) {
    return [];
  }

  // Group by SKU and aggregate - now considering PO Receive status
  const skuMap = new Map<string, {
    skuName: string;
    totalQty: number;
    qtyReceived: number;
    qtyNotReceived: number;
    qtyDamaged: number;
    poSet: Set<string>;
  }>();

  // Process each PO and account for receive status
  for (const po of posInShipping) {
    // Skip if PO status is DONE or RECEIVED
    if (po.status === 'DONE' || po.status === 'RECEIVED') {
      continue;
    }

    // Check if PO Receive exists
    const poReceive = await getPOReceiveByPOId(po.id);

    // Skip if PO Receive is COMPLETED
    if (poReceive && poReceive.status === 'COMPLETED') {
      continue;
    }

    // Get items for this PO
    const itemsQuery = query(
      poItemsCollection,
      where('storeId', '==', storeId),
      where('poId', '==', po.id)
    );
    const itemsSnapshot = await getDocs(itemsQuery);

    if (itemsSnapshot.empty) {
      continue;
    }

    const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrderItem));

    // If PO Receive is IN_PROGRESS, use receive item data for status
    if (poReceive && poReceive.status === 'IN_PROGRESS') {
      const receiveItems = await getPOReceiveItems(poReceive.id);

      // Create a map of poItemId -> latest purchaseOrderItem for SKU data
      const itemMap = new Map(items.map(item => [item.id, item]));

      // Process each receive item - INCLUDE ALL ITEMS (no qtyNotReceived filter)
      receiveItems.forEach(receiveItem => {
        // Get the latest SKU data from purchaseOrderItems
        const latestItem = itemMap.get(receiveItem.poItemId);
        const skuCode = latestItem?.skuCode || receiveItem.skuCode;
        const skuName = latestItem?.skuName || receiveItem.skuName;

        if (!skuCode) {
          return;
        }

        // Include ALL items regardless of qtyNotReceived
        const existing = skuMap.get(skuCode);
        if (existing) {
          existing.totalQty += receiveItem.quantity;
          existing.qtyReceived += receiveItem.qtyReceived;
          existing.qtyNotReceived += receiveItem.qtyNotReceived;
          existing.qtyDamaged += receiveItem.qtyDamaged;
          existing.poSet.add(po.poNumber);
        } else {
          skuMap.set(skuCode, {
            skuName: skuName || '',
            totalQty: receiveItem.quantity,
            qtyReceived: receiveItem.qtyReceived,
            qtyNotReceived: receiveItem.qtyNotReceived,
            qtyDamaged: receiveItem.qtyDamaged,
            poSet: new Set([po.poNumber]),
          });
        }
      });
    } else {
      // No PO Receive or not started yet - count full original quantity
      items.forEach(item => {
        if (!item.skuCode) {
          return;
        }

        const existing = skuMap.get(item.skuCode);
        if (existing) {
          existing.totalQty += item.quantity;
          existing.qtyReceived += 0;
          existing.qtyNotReceived += item.quantity; // All pending
          existing.qtyDamaged += 0;
          existing.poSet.add(po.poNumber);
        } else {
          skuMap.set(item.skuCode, {
            skuName: item.skuName || '',
            totalQty: item.quantity,
            qtyReceived: 0,
            qtyNotReceived: item.quantity, // All pending
            qtyDamaged: 0,
            poSet: new Set([po.poNumber]),
          });
        }
      });
    }
  }

  // Convert to array and format
  const result = Array.from(skuMap.entries()).map(([skuCode, data]) => ({
    skuCode,
    skuName: data.skuName,
    totalPack: data.poSet.size, // Number of unique POs
    totalQty: data.totalQty,
    totalPcs: data.totalQty, // Same as totalQty for now
    qtyReceived: data.qtyReceived,
    qtyNotReceived: data.qtyNotReceived,
    qtyDamaged: data.qtyDamaged,
    poNumbers: Array.from(data.poSet).sort().join(', '),
  }));

  // Sort by SKU code
  return result.sort((a, b) => a.skuCode.localeCompare(b.skuCode));
};

export const savePOItems = async (
  poId: string,
  poNumber: string,
  storeId: string,
  items: Omit<PurchaseOrderItem, 'id' | 'poId' | 'poNumber' | 'storeId' | 'createdAt' | 'updatedAt'>[],
  replaceExisting: boolean = false
): Promise<void> => {
  const batch = writeBatch(firestore);

  // If replace, delete all existing items first
  if (replaceExisting) {
    const existingItemsQuery = query(poItemsCollection, where('poId', '==', poId));
    const existingItems = await getDocs(existingItemsQuery);
    existingItems.forEach((doc) => {
      batch.delete(doc.ref);
    });
  }

  // Add new items
  items.forEach((item) => {
    const newItemRef = doc(poItemsCollection);
    batch.set(newItemRef, {
      ...item,
      poId,
      poNumber,
      storeId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });

  await batch.commit();
};

export const updatePOItem = async (
  itemId: string,
  data: Partial<Omit<PurchaseOrderItem, 'id' | 'createdAt'>>
): Promise<void> => {
  const itemRef = doc(firestore, 'purchaseOrderItems', itemId);

  // Filter out undefined values (Firestore doesn't accept undefined, only null)
  const cleanData: any = {};
  Object.keys(data).forEach(key => {
    const value = (data as any)[key];
    if (value !== undefined) {
      cleanData[key] = value;
    }
  });

  await updateDoc(itemRef, {
    ...cleanData,
    updatedAt: Timestamp.now(),
  });
};

export const addPOItem = async (
  item: Omit<PurchaseOrderItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const docRef = await addDoc(poItemsCollection, {
    ...item,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const deletePOItem = async (itemId: string): Promise<void> => {
  const itemRef = doc(firestore, 'purchaseOrderItems', itemId);
  await deleteDoc(itemRef);
};

export const deleteAllPOItems = async (poId: string): Promise<void> => {
  const q = query(poItemsCollection, where('poId', '==', poId));
  const snapshot = await getDocs(q);

  const batch = writeBatch(firestore);
  snapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
};

export const bulkUpdatePOItems = async (
  items: { id: string; data: Partial<Omit<PurchaseOrderItem, 'id' | 'createdAt'>> }[]
): Promise<void> => {
  const batch = writeBatch(firestore);

  items.forEach(({ id, data }) => {
    const itemRef = doc(firestore, 'purchaseOrderItems', id);
    batch.update(itemRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  });

  await batch.commit();
};

/**
 * Get shipping PO information for a specific SKU
 * Returns PO details where status is 'IN SHIPPING' or 'IN SHIPPING (PARTIAL)'
 */
export const getShippingPOsForSku = async (
  skuId: string,
  storeId: string
): Promise<Array<{ po: PurchaseOrder; totalQuantity: number }>> => {
  // First, find all PO items with this SKU
  const itemsQuery = query(
    poItemsCollection,
    where('skuId', '==', skuId),
    where('storeId', '==', storeId)
  );
  const itemsSnapshot = await getDocs(itemsQuery);

  if (itemsSnapshot.empty) {
    return [];
  }

  // Get unique PO IDs
  const poIds = [...new Set(itemsSnapshot.docs.map(doc => doc.data().poId))];

  // Fetch PO details and filter by shipping status
  const posCollection = collection(firestore, 'purchaseOrders');
  const results: Array<{ po: PurchaseOrder; totalQuantity: number }> = [];

  for (const poId of poIds) {
    const poRef = doc(posCollection, poId);
    const poDoc = await getDoc(poRef);

    if (poDoc.exists()) {
      const poData = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

      // Check if there's a PO Receive record for this PO first
      const poReceive = await getPOReceiveByPOId(poId);

      // IMPORTANT: Skip if PO Receive is COMPLETED (qty settled via refund, no more pending qty)
      if (poReceive && poReceive.status === 'COMPLETED') {
        continue; // Skip this PO regardless of PO status
      }

      // IMPORTANT: Skip if PO status is DONE (receiving completed, nothing pending)
      if (poData.status === 'DONE') {
        continue; // Skip this PO
      }

      // IMPORTANT: Skip if PO status is RECEIVED (fully received)
      if (poData.status === 'RECEIVED') {
        continue; // Skip this PO
      }

      // Only include if status is IN SHIPPING (items still in transit)
      if (poData.status === 'IN SHIPPING' || poData.status === 'IN SHIPPING (PARTIAL)') {
        let quantityToShow = 0;

        if (poReceive && poReceive.status === 'IN_PROGRESS') {
          // PO Receive IN_PROGRESS: Show only qty not received yet
          const allReceiveItems = await getPOReceiveItems(poReceive.id);

          // Filter receive items for this SKU
          const receiveItemsForSku = allReceiveItems.filter(item => item.skuId === skuId);

          // Calculate total qty not received for this SKU
          quantityToShow = receiveItemsForSku.reduce((sum, item) => sum + item.qtyNotReceived, 0);

          // If all items received (qtyNotReceived = 0), don't show this row
          if (quantityToShow === 0) {
            continue; // Skip this PO
          }
        } else if (!poReceive) {
          // No PO Receive yet: Show original quantity from PO items (all qty still pending)
          const itemsForThisPO = itemsSnapshot.docs
            .filter(doc => doc.data().poId === poId)
            .map(doc => doc.data() as PurchaseOrderItem);

          quantityToShow = itemsForThisPO.reduce((sum, item) => sum + item.quantity, 0);
        }

        // Only add to results if there's quantity to show
        if (quantityToShow > 0) {
          results.push({ po: poData, totalQuantity: quantityToShow });
        }
      }
    }
  }

  return results;
};

/**
 * Get all PO information for a specific SKU with estimated arrival dates
 * Returns all POs regardless of status
 */
export const getAllPOsForSku = async (
  skuId: string,
  storeId: string
): Promise<Array<{ poId: string; poNumber: string; totalQuantity: number; estimatedArrival: Date }>> => {
  // First, find all PO items with this SKU
  const itemsQuery = query(
    poItemsCollection,
    where('skuId', '==', skuId),
    where('storeId', '==', storeId)
  );
  const itemsSnapshot = await getDocs(itemsQuery);

  if (itemsSnapshot.empty) {
    return [];
  }

  // Group by PO ID
  const poDataMap = new Map<string, { poId: string; items: PurchaseOrderItem[] }>();

  itemsSnapshot.docs.forEach(doc => {
    const item = doc.data() as PurchaseOrderItem;
    if (!poDataMap.has(item.poId)) {
      poDataMap.set(item.poId, { poId: item.poId, items: [] });
    }
    poDataMap.get(item.poId)!.items.push(item);
  });

  // Fetch PO details for each unique PO
  const posCollection = collection(firestore, 'purchaseOrders');
  const results: Array<{ poId: string; poNumber: string; totalQuantity: number; estimatedArrival: Date }> = [];

  for (const [poId, data] of poDataMap.entries()) {
    const poRef = doc(posCollection, poId);
    const poDoc = await getDoc(poRef);

    if (poDoc.exists()) {
      const poData = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

      // Check if there's a PO Receive record for this PO
      const poReceive = await getPOReceiveByPOId(poId);

      // IMPORTANT: Skip if PO Receive is COMPLETED (qty settled via refund, no more pending qty)
      if (poReceive && poReceive.status === 'COMPLETED') {
        continue;
      }

      // IMPORTANT: Skip if PO status is DONE (receiving completed, nothing pending)
      if (poData.status === 'DONE') {
        continue;
      }

      // IMPORTANT: Skip if PO status is RECEIVED (fully received)
      if (poData.status === 'RECEIVED') {
        continue;
      }

      // Calculate quantity to show
      let quantityToShow = 0;

      if (poReceive && poReceive.status === 'IN_PROGRESS') {
        // PO Receive IN_PROGRESS: Show only qty not received yet
        const allReceiveItems = await getPOReceiveItems(poReceive.id);
        const receiveItemsForSku = allReceiveItems.filter(item => item.skuId === skuId);
        quantityToShow = receiveItemsForSku.reduce((sum, item) => sum + item.qtyNotReceived, 0);

        // If all items received (qtyNotReceived = 0), don't show this row
        if (quantityToShow === 0) {
          continue;
        }
      } else {
        // No PO Receive yet: Show original quantity from PO items (all qty still pending)
        quantityToShow = data.items.reduce((sum, item) => sum + item.quantity, 0);
      }

      // Calculate estimated arrival: order date + 1 month
      const orderDate = poData.orderDate.toDate();
      const estimatedArrival = new Date(orderDate);
      estimatedArrival.setMonth(estimatedArrival.getMonth() + 1);

      results.push({
        poId: poData.id,
        poNumber: poData.poNumber,
        totalQuantity: quantityToShow,
        estimatedArrival
      });
    }
  }

  // Sort by estimated arrival date (earliest first)
  results.sort((a, b) => a.estimatedArrival.getTime() - b.estimatedArrival.getTime());

  return results;
};

/**
 * Get ALL SKUs with warehouse and shipping data
 * Returns all SKUs with:
 * - Remaining packs/pcs in warehouse (not scanned out)
 * - Total pcs still in shipping (from POs not DONE)
 * - PO numbers for items in shipping
 */
export const getAllSkusWithShippingData = async (storeId: string): Promise<{
  skuCode: string;
  skuName: string;
  remainingPacks: number;
  remainingPcs: number;
  totalPcsInShipping: number;
  poNumbers: string;
}[]> => {
  // Get ALL SKUs for the store
  const allSkus = await getAllSkusByStore(storeId);

  if (allSkus.length === 0) {
    return [];
  }

  // Get shipping data for all SKUs
  const shippingData = await getSkusInShipping(storeId);

  // Create a map of SKU code to shipping data for quick lookup
  const shippingMap = new Map<string, { totalPcs: number; poNumbers: string }>();
  shippingData.forEach(item => {
    shippingMap.set(item.skuCode, {
      totalPcs: item.qtyNotReceived, // Use qtyNotReceived as the actual qty still in shipping
      poNumbers: item.poNumbers,
    });
  });

  // Combine all SKUs with their shipping data
  const result = allSkus.map(sku => {
    const shipping = shippingMap.get(sku.skuCode);

    return {
      skuCode: sku.skuCode,
      skuName: sku.skuName,
      remainingPacks: sku.remainingPacks || 0,
      remainingPcs: sku.remainingQuantity || 0,
      totalPcsInShipping: shipping?.totalPcs || 0,
      poNumbers: shipping?.poNumbers || '',
    };
  });

  // Sort by SKU code
  return result.sort((a, b) => a.skuCode.localeCompare(b.skuCode));
};
