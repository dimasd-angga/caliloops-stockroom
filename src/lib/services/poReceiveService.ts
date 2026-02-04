import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import type { POReceive, POReceiveItem, PurchaseOrderItem } from '../types';
import { getPOItems } from './purchaseOrderItemService';
import { addRefund } from './refundService';

const poReceivesCollection = collection(firestore, 'poReceives');
const poReceiveItemsCollection = collection(firestore, 'poReceiveItems');

/**
 * Initialize or get PO Receive record
 * Creates POReceive and copies all items from purchaseOrderItems to poReceiveItems
 */
export const initializePOReceive = async (
  poId: string,
  poNumber: string,
  storeId: string,
  supplierId: string,
  supplierName: string
): Promise<string> => {
  // Check if already exists
  const q = query(poReceivesCollection, where('poId', '==', poId));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    // Already exists, return existing ID
    return snapshot.docs[0].id;
  }

  // Get all PO items - only those with SKU mapped
  const allPoItems = await getPOItems(poId);
  const poItems = allPoItems.filter(item => item.skuId); // Only items with SKU

  if (poItems.length === 0) {
    throw new Error('No items with SKU found in this Purchase Order. Please map SKUs first in Items Details page.');
  }

  const batch = writeBatch(firestore);

  // Create POReceive record
  const poReceiveRef = doc(poReceivesCollection);
  const poReceiveData: Omit<POReceive, 'id'> = {
    poId,
    poNumber,
    storeId,
    supplierId,
    supplierName,
    status: 'IN_PROGRESS',
    totalItemsCount: poItems.length,
    totalReceivedItems: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  batch.set(poReceiveRef, poReceiveData);

  // Copy all items to poReceiveItems
  poItems.forEach((poItem) => {
    const receiveItemRef = doc(poReceiveItemsCollection);
    const receiveItemData: any = {
      poReceiveId: poReceiveRef.id,
      poId,
      poNumber,
      storeId,
      poItemId: poItem.id,
      serialNumber: poItem.serialNumber,
      itemCode: poItem.itemCode,
      itemName: poItem.itemName,
      specification: poItem.specification,
      quantity: poItem.quantity,
      unitPrice: poItem.unitPrice,
      discount: poItem.discount,
      amount: poItem.amount,
      hargaBarang: poItem.hargaBarang,
      costPerPcs: poItem.costPerPcs,
      modalBarang: poItem.modalBarang,
      qtyReceived: 0,
      qtyNotReceived: poItem.quantity, // Initially all not received
      qtyDamaged: 0,
      totalPcsFinal: 0,
      amountNotReceived: 0,
      amountDamaged: 0,
      hasReceivedInput: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Only add optional fields if they exist
    if (poItem.skuId) receiveItemData.skuId = poItem.skuId;
    if (poItem.skuCode) receiveItemData.skuCode = poItem.skuCode;
    if (poItem.skuName) receiveItemData.skuName = poItem.skuName;
    if (poItem.imageUrl) receiveItemData.imageUrl = poItem.imageUrl;

    batch.set(receiveItemRef, receiveItemData);
  });

  await batch.commit();
  return poReceiveRef.id;
};

/**
 * Get PO Receive by PO ID
 */
export const getPOReceiveByPOId = async (poId: string): Promise<POReceive | null> => {
  const q = query(poReceivesCollection, where('poId', '==', poId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as POReceive;
};

/**
 * Get all PO Receive Items for a PO Receive
 */
export const getPOReceiveItems = async (poReceiveId: string): Promise<POReceiveItem[]> => {
  const q = query(
    poReceiveItemsCollection,
    where('poReceiveId', '==', poReceiveId)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as POReceiveItem))
    .sort((a, b) => a.serialNumber - b.serialNumber);
};

/**
 * Update received quantity after inbound shipment is created
 * This is called from the inbound service after shipment is submitted
 */
export const updateReceivedQuantity = async (
  receiveItemId: string,
  additionalQty: number
): Promise<void> => {
  const itemRef = doc(firestore, 'poReceiveItems', receiveItemId);
  const itemDoc = await getDoc(itemRef);

  if (!itemDoc.exists()) {
    throw new Error('PO Receive Item not found');
  }

  const itemData = itemDoc.data() as POReceiveItem;

  const newQtyReceived = itemData.qtyReceived + additionalQty;
  const newQtyNotReceived = Math.max(
    0,
    itemData.quantity - newQtyReceived - itemData.qtyDamaged
  );
  const newTotalPcsFinal = newQtyReceived + newQtyNotReceived + itemData.qtyDamaged;

  // Calculate refund amount: (qty not received) × (total biaya / total order qty)
  const costPerUnit = itemData.quantity > 0 ? itemData.amount / itemData.quantity : 0;
  const newAmountNotReceived = newQtyNotReceived * costPerUnit;

  await updateDoc(itemRef, {
    qtyReceived: newQtyReceived,
    qtyNotReceived: newQtyNotReceived,
    totalPcsFinal: newTotalPcsFinal,
    amountNotReceived: newAmountNotReceived,
    hasReceivedInput: true,
    updatedAt: Timestamp.now(),
  });

  // Update totalReceivedItems count in POReceive
  await updatePOReceiveItemCount(itemData.poReceiveId);
};

/**
 * Update damaged quantity
 */
export const updateDamagedQuantity = async (
  receiveItemId: string,
  damagedQty: number
): Promise<void> => {
  const itemRef = doc(firestore, 'poReceiveItems', receiveItemId);
  const itemDoc = await getDoc(itemRef);

  if (!itemDoc.exists()) {
    throw new Error('PO Receive Item not found');
  }

  const itemData = itemDoc.data() as POReceiveItem;

  // Validate: total cannot exceed original quantity
  if (itemData.qtyReceived + damagedQty > itemData.quantity) {
    throw new Error('Total received + damaged quantity cannot exceed original quantity');
  }

  const newQtyNotReceived = Math.max(
    0,
    itemData.quantity - itemData.qtyReceived - damagedQty
  );
  const newTotalPcsFinal = itemData.qtyReceived + newQtyNotReceived + damagedQty;

  // Calculate refund amounts: (qty) × (total biaya / total order qty)
  const costPerUnit = itemData.quantity > 0 ? itemData.amount / itemData.quantity : 0;
  const newAmountNotReceived = newQtyNotReceived * costPerUnit;
  const newAmountDamaged = damagedQty * costPerUnit;

  await updateDoc(itemRef, {
    qtyDamaged: damagedQty,
    qtyNotReceived: newQtyNotReceived,
    totalPcsFinal: newTotalPcsFinal,
    amountNotReceived: newAmountNotReceived,
    amountDamaged: newAmountDamaged,
    updatedAt: Timestamp.now(),
  });
};

/**
 * Update count of items with receive input
 */
const updatePOReceiveItemCount = async (poReceiveId: string): Promise<void> => {
  const items = await getPOReceiveItems(poReceiveId);
  const itemsWithInput = items.filter((item) => item.hasReceivedInput).length;

  const poReceiveRef = doc(firestore, 'poReceives', poReceiveId);
  await updateDoc(poReceiveRef, {
    totalReceivedItems: itemsWithInput,
    updatedAt: Timestamp.now(),
  });
};

/**
 * Complete PO Receive (Done button)
 * Creates refunds for not received and damaged items
 */
export const completePOReceive = async (poReceiveId: string): Promise<void> => {
  const poReceiveRef = doc(firestore, 'poReceives', poReceiveId);
  const poReceiveDoc = await getDoc(poReceiveRef);

  if (!poReceiveDoc.exists()) {
    throw new Error('PO Receive not found');
  }

  const poReceive = { id: poReceiveDoc.id, ...poReceiveDoc.data() } as POReceive;

  // Get all items
  const items = await getPOReceiveItems(poReceiveId);

  // Validate: all items must have input
  const itemsWithoutInput = items.filter((item) => !item.hasReceivedInput);
  if (itemsWithoutInput.length > 0) {
    throw new Error(
      `${itemsWithoutInput.length} item(s) don't have receive input. Please complete all items.`
    );
  }

  // Calculate total refund amounts
  const totalRefundAmount = items.reduce(
    (sum, item) => sum + item.amountNotReceived + item.amountDamaged,
    0
  );

  // Create refund if there's any not received or damaged amount
  if (totalRefundAmount > 0) {
    const refundNotes = items
      .filter((item) => item.amountNotReceived > 0 || item.amountDamaged > 0)
      .map((item) => {
        const parts = [];
        if (item.amountNotReceived > 0) {
          parts.push(
            `Not Received: ${item.qtyNotReceived} pcs (¥${item.amountNotReceived.toFixed(2)})`
          );
        }
        if (item.amountDamaged > 0) {
          parts.push(`Damaged: ${item.qtyDamaged} pcs (¥${item.amountDamaged.toFixed(2)})`);
        }
        return `${item.itemCode} - ${item.itemName}: ${parts.join(', ')}`;
      })
      .join('\n');

    // Get PO details for refund
    const poDoc = await getDoc(doc(firestore, 'purchaseOrders', poReceive.poId));
    if (poDoc.exists()) {
      const poData = poDoc.data();

      await addRefund({
        storeId: poReceive.storeId,
        poId: poReceive.poId,
        poNumber: poReceive.poNumber,
        orderDate: poData.orderDate,
        orderNumber: poData.orderNumber,
        supplierId: poReceive.supplierId,
        supplierName: poReceive.supplierName,
        supplierCode: poData.supplierCode,
        chatSearch: poData.chatSearch,
        refundAmount: totalRefundAmount,
        notes: `Auto-created from PO Receive\n\n${refundNotes}`,
      });
    }
  }

  // Mark as completed
  await updateDoc(poReceiveRef, {
    status: 'COMPLETED',
    completedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
};

/**
 * Save progress (Save button)
 */
export const savePOReceiveProgress = async (poReceiveId: string): Promise<void> => {
  const poReceiveRef = doc(firestore, 'poReceives', poReceiveId);
  await updateDoc(poReceiveRef, {
    updatedAt: Timestamp.now(),
  });
};
