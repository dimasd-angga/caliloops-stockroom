
import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp, doc, getDoc, getDocs,
} from 'firebase/firestore';
import type { Store } from '../types';

const storesCollection = collection(firestore, 'stores');

export const subscribeToStores = (
  callback: (stores: Store[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(storesCollection, orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const stores = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Store)
      );
      callback(stores);
    },
    (error) => {
      console.error('Error subscribing to stores: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};

export const addStore = async (
  storeData: Omit<Store, 'id' | 'createdAt'>
): Promise<string> => {
  const newStore = {
    ...storeData,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(storesCollection, newStore);
  return docRef.id;
};

export const getStoreById = async (storeId: string): Promise<Store | null> => {
  try {
    const storeDoc = doc(firestore, 'stores', storeId);
    const storeSnap = await getDoc(storeDoc);

    if (storeSnap.exists()) {
      return { id: storeSnap.id, ...storeSnap.data() } as Store;
    }
    return null;
  } catch (error) {
    console.error('Error fetching store:', error);
    return null;
  }
};

export const getAllStores = async (): Promise<Store[]> => {
  try {
    const q = query(storesCollection, orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
  } catch (error) {
    console.error('Error fetching stores:', error);
    return [];
  }
};
