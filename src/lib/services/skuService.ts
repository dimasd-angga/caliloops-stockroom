
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

export const getSkuById = async (skuId: string): Promise<Sku | null> => {
  try {
    const skuRef = doc(firestore, 'skus', skuId);
    const skuDoc = await getDoc(skuRef);

    if (skuDoc.exists()) {
      return { id: skuDoc.id, ...skuDoc.data() } as Sku;
    }
    return null;
  } catch (error) {
    console.error('Error fetching SKU by ID:', error);
    return null;
  }
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

export const getAllSkusByStore = async (storeId: string): Promise<Sku[]> => {
  const q = query(
    skusCollection,
    where('storeId', '==', storeId),
    orderBy('skuCode', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Sku));
};

// Search SKUs by keyword (searches in skuCode, skuName, and keywords array)
export const searchSkus = async (storeId: string, searchTerm: string, limitCount: number = 20): Promise<Sku[]> => {
  if (!searchTerm || searchTerm.length < 3) {
    return [];
  }

  const lowerSearch = searchTerm.toLowerCase();

  // Fetch ALL SKUs for the store (no limit) to ensure we find all matches
  // Since Firestore doesn't support case-insensitive or partial text search,
  // we need to fetch all SKUs and filter client-side
  const q = query(
    skusCollection,
    where('storeId', '==', storeId)
  );

  const snapshot = await getDocs(q);
  const allSkus = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Sku));

  // Client-side filtering with ranking
  const matches = allSkus
    .map((sku) => {
      const skuCodeLower = sku.skuCode.toLowerCase();
      const skuNameLower = sku.skuName.toLowerCase();

      // Exact match gets highest priority
      if (skuCodeLower === lowerSearch || skuNameLower === lowerSearch) {
        return { sku, score: 100 };
      }

      // Starts with match gets high priority
      if (skuCodeLower.startsWith(lowerSearch) || skuNameLower.startsWith(lowerSearch)) {
        return { sku, score: 50 };
      }

      // Contains match gets medium priority
      const skuCodeMatch = skuCodeLower.includes(lowerSearch);
      const skuNameMatch = skuNameLower.includes(lowerSearch);
      const keywordsMatch = sku.keywords?.some(k => k.toLowerCase().includes(lowerSearch)) || false;

      if (skuCodeMatch || skuNameMatch || keywordsMatch) {
        return { sku, score: skuCodeMatch ? 30 : (skuNameMatch ? 20 : 10) };
      }

      return null;
    })
    .filter((match): match is { sku: Sku; score: number } => match !== null)
    .sort((a, b) => b.score - a.score) // Sort by relevance
    .slice(0, limitCount)
    .map(m => m.sku);

  return matches;
};
