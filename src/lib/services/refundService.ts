
import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  where,
  deleteDoc,
} from 'firebase/firestore';
import type { Refund } from '../types';

const refundsCollection = collection(firestore, 'refunds');

export const subscribeToRefunds = (
  storeId: string,
  callback: (refunds: Refund[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(
    refundsCollection, 
    where('storeId', '==', storeId), 
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const refunds = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Refund)
      );
      callback(refunds);
    },
    (error) => {
      console.error('Error subscribing to refunds: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};

export const addRefund = async (
  refundData: Omit<Refund, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const newRefund = {
    ...refundData,
    deductedDate: refundData.deductedDate || null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(refundsCollection, newRefund);
  return docRef.id;
};

export const updateRefund = async (
  id: string,
  refundUpdate: Partial<Omit<Refund, 'id' | 'createdAt'>>
): Promise<void> => {
  const refundDoc = doc(firestore, 'refunds', id);
  const updateData = {
    ...refundUpdate,
    deductedDate: refundUpdate.deductedDate || null,
    updatedAt: Timestamp.now(),
  };
  await updateDoc(refundDoc, updateData);
};

export const deleteRefund = async (id: string): Promise<void> => {
    const refundDoc = doc(firestore, 'refunds', id);
    await deleteDoc(refundDoc);
};
