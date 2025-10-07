
import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  QueryConstraint,
  where,
} from 'firebase/firestore';
import type { WarehouseLog } from '../types';
import { updateSkuPackCount } from './skuService';

const warehouseLogsCollection = collection(firestore, 'warehouseLogs');

export const subscribeToWarehouseLogs = (
  storeId: string | null,
  callback: (logs: WarehouseLog[]) => void,
  onError: (error: Error) => void
) => {
  const constraints: QueryConstraint[] = [orderBy('datetime', 'desc')];
  if (storeId) {
    constraints.push(where('storeId', '==', storeId));
  }

  const q = query(warehouseLogsCollection, ...constraints);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as WarehouseLog)
      );
      callback(logs);
    },
    (error) => {
      console.error('Error subscribing to warehouse logs: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};

export const addWarehouseLog = async (
  logData: Omit<WarehouseLog, 'id' | 'datetime'>
): Promise<string> => {
  const newLog = {
    ...logData,
    datetime: Timestamp.now(),
  };
  const docRef = await addDoc(warehouseLogsCollection, newLog);
  return docRef.id;
};
