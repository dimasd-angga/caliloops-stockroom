
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
  startAfter,
  getDoc,
  DocumentSnapshot,
  DocumentData,
  setDoc,
  getCountFromServer,
} from 'firebase/firestore';
import type { Sku, Store } from '../types';

const skusCollection = collection(firestore, 'skus');

export const getPaginatedSkus = async (
  storeId: string,
  pageSize: number,
  searchTerm: string = '',
  startAfterDoc: DocumentSnapshot<DocumentData> | null = null
) => {
  const baseConstraints: QueryConstraint[] = [where('storeId', '==', storeId)];
  
  if (searchTerm) {
    const endAt = searchTerm + '\uf8ff';
    baseConstraints.push(where('skuCode', '>=', searchTerm));
    baseConstraints.push(where('skuCode', '<=', endAt));
  }

  // Query for the total count
  const countQuery = query(skusCollection, ...baseConstraints);
  const countSnapshot = await getCountFromServer(countQuery);
  const totalCount = countSnapshot.data().count;
  
  // Query for the paginated documents
  const docConstraints: QueryConstraint[] = [...baseConstraints];
  
  // Conditional orderBy. Firestore doesn't allow inequality filters on one field and orderBy on another.
  if (searchTerm) {
      docConstraints.push(orderBy('skuCode', 'asc'));
  } else {
      docConstraints.push(orderBy('createdAt', 'desc'));
  }

  if (startAfterDoc) {
    docConstraints.push(startAfter(startAfterDoc));
  }
  docConstraints.push(limit(pageSize));

  const docsQuery = query(skusCollection, ...docConstraints);
  const snapshot = await getDocs(docsQuery);

  const skus = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sku));
  
  return {
    skus,
    last: snapshot.docs[snapshot.docs.length - 1] || null,
    totalCount: totalCount,
  };
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

export const subscribeToSkus = (
    storeId: string | null,
    callback: (skus: Sku[]) => void,
    onError: (error: Error) => void
  ) => {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
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
        console.error('Error subscribing to skus: ', error);
        onError(error);
      }
    );
  
    return unsubscribe;
  };
