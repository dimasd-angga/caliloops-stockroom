
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
  poNumbers: string;
}[]> => {
  console.log('[getSkusInShipping] Starting export for storeId:', storeId);

  // First, get all POs with IN SHIPPING status
  const posCollection = collection(firestore, 'purchaseOrders');
  const posQuery = query(
    posCollection,
    where('storeId', '==', storeId),
    where('status', 'in', ['IN SHIPPING', 'IN SHIPPING (PARTIAL)'])
  );
  const posSnapshot = await getDocs(posQuery);

  console.log('[getSkusInShipping] Found POs with IN SHIPPING status:', posSnapshot.size);

  if (posSnapshot.empty) {
    console.log('[getSkusInShipping] No POs found with IN SHIPPING status');
    return [];
  }

  const posInShipping = posSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
  console.log('[getSkusInShipping] PO Numbers:', posInShipping.map(po => po.poNumber));
  console.log('[getSkusInShipping] PO Details:', posInShipping.map(po => ({
    poNumber: po.poNumber,
    status: po.status,
    id: po.id
  })));

  // Group by SKU and aggregate - now considering PO Receive status
  const skuMap = new Map<string, {
    skuName: string;
    totalQty: number;
    poSet: Set<string>;
  }>();

  // Process each PO and account for receive status
  for (const po of posInShipping) {
    console.log(`[getSkusInShipping] Processing PO: ${po.poNumber}, Status: ${po.status}`);

    // Skip if PO status is DONE or RECEIVED
    if (po.status === 'DONE' || po.status === 'RECEIVED') {
      console.log(`[getSkusInShipping] Skipping PO ${po.poNumber} - status is ${po.status}`);
      continue;
    }

    // Check if PO Receive exists
    const poReceive = await getPOReceiveByPOId(po.id);
    console.log(`[getSkusInShipping] PO ${po.poNumber} - PO Receive exists:`, !!poReceive, 'Status:', poReceive?.status);

    // Skip if PO Receive is COMPLETED
    if (poReceive && poReceive.status === 'COMPLETED') {
      console.log(`[getSkusInShipping] Skipping PO ${po.poNumber} - PO Receive is COMPLETED`);
      continue;
    }

    // Get items for this PO
    const itemsQuery = query(
      poItemsCollection,
      where('storeId', '==', storeId),
      where('poId', '==', po.id)
    );
    const itemsSnapshot = await getDocs(itemsQuery);

    console.log(`[getSkusInShipping] PO ${po.poNumber} - Found ${itemsSnapshot.size} items`);

    if (itemsSnapshot.empty) {
      console.log(`[getSkusInShipping] Skipping PO ${po.poNumber} - no items found`);
      continue;
    }

    const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrderItem));
    const itemsWithSku = items.filter(item => item.skuCode);
    console.log(`[getSkusInShipping] PO ${po.poNumber} - Items with SKU: ${itemsWithSku.length}/${items.length}`);

    // If PO Receive is IN_PROGRESS, only count qtyNotReceived
    if (poReceive && poReceive.status === 'IN_PROGRESS') {
      const receiveItems = await getPOReceiveItems(poReceive.id);
      console.log(`[getSkusInShipping] PO ${po.poNumber} - Processing ${receiveItems.length} receive items`);

      // Create a map of poItemId -> latest purchaseOrderItem for SKU data
      const itemMap = new Map(items.map(item => [item.id, item]));
      console.log(`[getSkusInShipping] Created itemMap with ${itemMap.size} entries`);

      // Process each receive item (which includes qty not received info)
      receiveItems.forEach(receiveItem => {
        console.log(`[getSkusInShipping] Processing receiveItem: ${receiveItem.itemCode}, poItemId: ${receiveItem.poItemId}`);

        // Get the latest SKU data from purchaseOrderItems
        const latestItem = itemMap.get(receiveItem.poItemId);
        console.log(`[getSkusInShipping] latestItem found:`, !!latestItem, 'latestItem.skuCode:', latestItem?.skuCode, 'receiveItem.skuCode:', receiveItem.skuCode);

        const skuCode = latestItem?.skuCode || receiveItem.skuCode;
        const skuName = latestItem?.skuName || receiveItem.skuName;

        if (!skuCode) {
          console.log(`[getSkusInShipping] Skipping receive item ${receiveItem.itemCode} - no SKU code (latestItem: ${!!latestItem})`);
          return;
        }
        if (receiveItem.qtyNotReceived === 0) {
          console.log(`[getSkusInShipping] Skipping ${skuCode} (item: ${receiveItem.itemCode}) - qtyNotReceived is 0`);
          return;
        }

        console.log(`[getSkusInShipping] ✓ Adding ${skuCode}: ${receiveItem.qtyNotReceived} pcs (not received) from item ${receiveItem.itemCode}`);
        const existing = skuMap.get(skuCode);
        if (existing) {
          existing.totalQty += receiveItem.qtyNotReceived;
          existing.poSet.add(po.poNumber);
          console.log(`[getSkusInShipping] Updated existing SKU ${skuCode}, new totalQty: ${existing.totalQty}`);
        } else {
          skuMap.set(skuCode, {
            skuName: skuName || '',
            totalQty: receiveItem.qtyNotReceived,
            poSet: new Set([po.poNumber]),
          });
          console.log(`[getSkusInShipping] Added new SKU ${skuCode} with qty ${receiveItem.qtyNotReceived}`);
        }
      });
    } else {
      // No PO Receive or not started yet - count full original quantity
      console.log(`[getSkusInShipping] PO ${po.poNumber} - No PO Receive or not started, counting full quantities`);
      items.forEach(item => {
        if (!item.skuCode) {
          console.log(`[getSkusInShipping] Skipping item ${item.itemCode} - no SKU code`);
          return;
        }

        console.log(`[getSkusInShipping] Adding ${item.skuCode}: ${item.quantity} pcs`);
        const existing = skuMap.get(item.skuCode);
        if (existing) {
          existing.totalQty += item.quantity;
          existing.poSet.add(po.poNumber);
        } else {
          skuMap.set(item.skuCode, {
            skuName: item.skuName || '',
            totalQty: item.quantity,
            poSet: new Set([po.poNumber]),
          });
        }
      });
    }
  }

  console.log(`[getSkusInShipping] Final SKU map size: ${skuMap.size}`);
  console.log(`[getSkusInShipping] SKU codes:`, Array.from(skuMap.keys()));

  // Convert to array and format
  const result = Array.from(skuMap.entries()).map(([skuCode, data]) => ({
    skuCode,
    skuName: data.skuName,
    totalPack: data.poSet.size, // Number of unique POs
    totalQty: data.totalQty,
    totalPcs: data.totalQty, // Same as totalQty for now
    poNumbers: Array.from(data.poSet).sort().join(', '),
  }));

  console.log(`[getSkusInShipping] Returning ${result.length} SKUs`);

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
