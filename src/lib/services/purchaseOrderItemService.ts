
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
import type { PurchaseOrderItem } from '../types';

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
  await updateDoc(itemRef, {
    ...data,
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
