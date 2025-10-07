
import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  increment,
  where,
  QueryConstraint,
  getDocs,
  limit,
} from 'firebase/firestore';
import type { Sku } from '../types';

const skusCollection = collection(firestore, 'skus');

export const subscribeToSkus = (
  storeId: string | null, // Can be null for superadmin to see all
  callback: (skus: Sku[]) => void,
  onError: (error: Error) => void
) => {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  // If a specific storeId is provided, add a where clause.
  // If storeId is null, the query will not be filtered by store, fetching all documents.
  if (storeId) {
    constraints.push(where('storeId', '==', storeId));
  }

  const q = query(skusCollection, ...constraints);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const skus = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Sku)
      );
      callback(skus);
    },
    (error) => {
      console.error('Error subscribing to SKUs: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};

export const checkSkuExists = async (skuCode: string, storeId: string): Promise<boolean> => {
    const q = query(
      skusCollection,
      where('skuCode', '==', skuCode),
      where('storeId', '==', storeId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  };

export const addSku = async (
  skuData: Omit<Sku, 'id' | 'createdAt' | 'remainingPacks' | 'remainingQuantity'>
): Promise<string> => {
  const newSku = {
    ...skuData,
    remainingPacks: 0,
    remainingQuantity: 0,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(skusCollection, newSku);
  return docRef.id;
};


export const updateSkuPackCount = async (skuId: string, packChange: number, quantityChange: number) => {
    if (!skuId) return;
    const skuRef = doc(firestore, 'skus', skuId);
    await updateDoc(skuRef, {
        remainingPacks: increment(packChange),
        remainingQuantity: increment(quantityChange)
    });
};

export const updateSkuDetails = async (skuId: string, data: Partial<Sku>) => {
    if (!skuId) return;
    const skuRef = doc(firestore, 'skus', skuId);
    const { id, skuCode, ...updateData } = data; // Prevent skuCode from being updated
    await updateDoc(skuRef, updateData);
};
