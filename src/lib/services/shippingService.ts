
import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  where,
  QueryConstraint,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import type { Shipping } from '../types';

const shippingCollection = collection(firestore, 'shipping');

export const subscribeToShipping = (
  storeId: string,
  callback: (shippings: Shipping[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(
    shippingCollection,
    where('storeId', '==', storeId),
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const shippings = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Shipping)
      );
      callback(shippings);
    },
    (error) => {
      console.error('Error subscribing to shipping data: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};


export const getAllShipping = async (storeId: string): Promise<Shipping[]> => {
    if (!storeId) return [];
    const q = query(
      shippingCollection,
      where('storeId', '==', storeId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shipping));
}

export const addShipping = async (
  shippingData: Omit<Shipping, 'id' | 'createdAt'>
): Promise<string> => {
  const newShipping = {
    ...shippingData,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(shippingCollection, newShipping);
  return docRef.id;
};

export const updateShipping = async (
    id: string,
    shippingUpdate: Partial<Omit<Shipping, 'id' | 'createdAt'>>
): Promise<void> => {
    const shippingDoc = doc(firestore, 'shipping', id);
    await updateDoc(shippingDoc, shippingUpdate);
};

export const deleteShipping = async (id: string): Promise<void> => {
    const shippingDoc = doc(firestore, 'shipping', id);
    await deleteDoc(shippingDoc);
};
