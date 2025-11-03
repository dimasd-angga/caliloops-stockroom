
import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  where,
} from 'firebase/firestore';
import type { Courier } from '../types';

const couriersCollection = collection(firestore, 'couriers');

export const subscribeToCouriers = (
  storeId: string,
  callback: (couriers: Courier[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(
    couriersCollection, 
    where('storeId', '==', storeId), 
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const couriers = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Courier)
      );
      callback(couriers);
    },
    (error) => {
      console.error('Error subscribing to couriers: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};

export const addCourier = async (
  courierData: Omit<Courier, 'id' | 'createdAt'>
): Promise<string> => {
  const newCourier = {
    ...courierData,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(couriersCollection, newCourier);
  return docRef.id;
};
