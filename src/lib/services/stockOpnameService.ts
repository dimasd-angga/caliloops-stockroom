
import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  writeBatch,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  increment,
  QueryConstraint,
  arrayRemove,
  limit,
  runTransaction,
} from 'firebase/firestore';
import type { StockOpnameLog, Barcode, InboundShipment, Sku } from '../types';
import { updateBarcode } from './inboundService';
import { updateSkuPackCount } from './skuService';


const stockOpnameLogsCollection = collection(firestore, 'stockOpnameLogs');
const barcodesCollection = collection(firestore, 'barcodes');
const shipmentsCollection = collection(firestore, 'inboundShipments');
const skusCollection = collection(firestore, 'skus');

export const subscribeToStockOpnameLogs = (
  storeId: string | null,
  callback: (logs: StockOpnameLog[]) => void,
  onError: (error: Error) => void,
  skuCode?: string,
) => {
  const constraints: QueryConstraint[] = [orderBy('datetime', 'desc')];
  if (storeId) {
    constraints.push(where('storeId', '==', storeId));
  }
  if (skuCode) {
    constraints.push(where('skuCode', '==', skuCode));
  }
  const q = query(stockOpnameLogsCollection, ...constraints);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as StockOpnameLog)
      );
      callback(logs);
    },
    (error) => {
      console.error('Error subscribing to stock opname logs: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};

export const addStockOpnameLog = async (
  logData: Omit<StockOpnameLog, 'id' | 'datetime'>
): Promise<string> => {
  const batch = writeBatch(firestore);
  const newLogRef = doc(stockOpnameLogsCollection);

  const newLog = {
    ...logData,
    datetime: Timestamp.now(),
  };
  batch.set(newLogRef, newLog);

  // Find the SKU to update its lastAuditDate
  const skuQuery = query(
    skusCollection,
    where('skuCode', '==', logData.skuCode),
    where('storeId', '==', logData.storeId),
    limit(1)
  );

  const skuSnapshot = await getDocs(skuQuery);
  if (!skuSnapshot.empty) {
    const skuDoc = skuSnapshot.docs[0];
    batch.update(skuDoc.ref, { lastAuditDate: Timestamp.now() });
  }

  await batch.commit();
  return newLogRef.id;
};


export const confirmSingleLostPack = async (log: StockOpnameLog, barcodeToConfirm: string): Promise<void> => {
  if (!log.notOkBarcodes || !log.notOkBarcodes.includes(barcodeToConfirm)) {
    throw new Error("Barcode not found in this discrepancy log.");
  }

  const barcodeQuery = query(
    barcodesCollection,
    where('barcodeID', '==', barcodeToConfirm),
    where('storeId', '==', log.storeId),
    limit(1)
  );
  
  const barcodeSnapshot = await getDocs(barcodeQuery);
  if (barcodeSnapshot.empty) {
    throw new Error(`Barcode with ID ${barcodeToConfirm} not found in store ${log.storeId}.`);
  }
  const barcodeDocRef = barcodeSnapshot.docs[0].ref;
  const barcode = { id: barcodeDocRef.id, ...barcodeSnapshot.docs[0].data() } as Barcode;

  // Use the generic updateBarcode function to handle the status change and all related updates
  await updateBarcode(barcode.id, { status: 'lost' });

  // Now, just update the opname log to remove the confirmed barcode
  const logRef = doc(firestore, 'stockOpnameLogs', log.id);
  const opnameLogDoc = await getDoc(logRef);
  if(opnameLogDoc.exists()) {
    const currentLogData = opnameLogDoc.data() as StockOpnameLog;
    const updatedNotOkBarcodes = currentLogData.notOkBarcodes.filter((b: string) => b !== barcodeToConfirm);
    
    const logUpdate: any = {
      notOkBarcodes: updatedNotOkBarcodes
    };

    if (updatedNotOkBarcodes.length === 0) {
      logUpdate.discrepancyStatus = 'confirmed';
    }
    
    await updateDoc(logRef, logUpdate);
  }
}
