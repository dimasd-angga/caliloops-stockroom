
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
} from 'firebase/firestore';
import type { Supplier } from '../types';

const suppliersCollection = collection(firestore, 'suppliers');

export const subscribeToSuppliers = (
  storeId: string,
  callback: (suppliers: Supplier[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(
    suppliersCollection, 
    where('storeId', '==', storeId), 
    orderBy('name', 'asc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const suppliers = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Supplier)
      );
      callback(suppliers);
    },
    (error) => {
      console.error('Error subscribing to suppliers: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};

export const addSupplier = async (
  supplierData: Omit<Supplier, 'id' | 'createdAt'>
): Promise<string> => {
  const newSupplier = {
    ...supplierData,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(suppliersCollection, newSupplier);
  return docRef.id;
};
