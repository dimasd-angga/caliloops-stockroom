
import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
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
