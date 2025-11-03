
import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  writeBatch,
  Timestamp,
  serverTimestamp,
  where,
  getDocs,
  orderBy,
  documentId,
  limit,
  getDoc,
  increment,
  runTransaction,
  QueryConstraint,
} from 'firebase/firestore';
import type { InboundShipment, Barcode, Unit, Pack, Sku } from '../types';
import { updateSkuPackCount } from './skuService';

const inboundShipmentsCollection = collection(firestore, 'inboundShipments');
const barcodesCollection = collection(firestore, 'barcodes');
const skusCollection = collection(firestore, 'skus');

// --- InboundShipment ---
export const subscribeToInboundShipments = (
  callback: (shipments: InboundShipment[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(inboundShipmentsCollection, orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const shipments = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as InboundShipment)
      );
      callback(shipments);
    },
    (error) => {
      console.error('Error subscribing to inbound shipments: ', error);
      onError(error);
    }
  );

  return unsubscribe;
}

export const addInboundShipment = async (
  shipmentData: Omit<InboundShipment, 'id' | 'createdAt' | 'updatedAt' | 'totalQuantity' | 'packs'>,
  packsData: { quantity: number; unit: Unit; note?: string; }[]
) => {
    const batch = writeBatch(firestore);
    const shipmentRef = doc(inboundShipmentsCollection);
    const skuRef = doc(skusCollection, shipmentData.skuId);

    const packs: Pack[] = packsData.map(pack => ({
        id: doc(collection(firestore, 'temp')).id,
        status: 'in-stock',
        isPrinted: false,
        ...pack
    }));
    
    const totalQuantity = packs.reduce((sum, pack) => sum + pack.quantity, 0);

    const newShipment: Omit<InboundShipment, 'id'> = {
        ...shipmentData,
        packs,
        totalQuantity,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };
    batch.set(shipmentRef, newShipment);

    // Helper function to calculate ITF-14 check digit
    const calculateCheckDigit = (code: string): string => {
        const digits = code.split('').map(Number);
        let sum = 0;
        for (let i = 0; i < digits.length; i++) {
            sum += digits[i] * (i % 2 === 0 ? 3 : 1);
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit.toString();
    };

    // Barcode Generation for each pack
    packs.forEach((pack, index) => {
        const barcodeRef = doc(barcodesCollection);
        
        // Generate a 13-digit base from timestamp and index
        const time = new Date().getTime();
        const baseId = (time + index).toString(); // Ensure uniqueness for batch
        const thirteenDigits = baseId.slice(-13).padStart(13, '0');
        
        // Calculate and append check digit for ITF-14
        const checkDigit = calculateCheckDigit(thirteenDigits);
        const barcodeID = thirteenDigits + checkDigit;

        const newBarcode: Omit<Barcode, 'id'> = {
            inboundShipmentId: shipmentRef.id,
            packId: pack.id,
            skuId: shipmentData.skuId,
            storeId: shipmentData.storeId,
            skuName: shipmentData.skuName,
            skuCode: shipmentData.skuCode,
            barcodeID,
            quantity: pack.quantity,
            unit: pack.unit,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            status: 'in-stock',
            isPrinted: false,
        };
        batch.set(barcodeRef, newBarcode);
    });

    // Update SKU remaining quantity and packs
    const skuDoc = await getDoc(skuRef);
    if (skuDoc.exists()) {
        batch.update(skuRef, { 
            remainingQuantity: increment(totalQuantity),
            remainingPacks: increment(packs.length),
        });
    }

    await batch.commit();
    return shipmentRef.id;
};

export const getShipmentsBySku = async (skuId: string): Promise<InboundShipment[]> => {
  const q = query(inboundShipmentsCollection, where('skuId', '==', skuId), orderBy('createdAt', 'desc'));
  const shipmentSnapshot = await getDocs(q);
  const shipments = shipmentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InboundShipment));

  if (shipments.length === 0) {
      return [];
  }

  // Get all pack IDs from all shipments
  const packIds = shipments.flatMap(s => s.packs.map(p => p.id));

  if (packIds.length === 0) {
      return shipments;
  }

  // FIX: Batch queries in groups of 30 (Firestore 'in' limit)
  const batchSize = 30;
  const barcodesMap = new Map<string, Barcode>();

  try {
      for (let i = 0; i < packIds.length; i += batchSize) {
          const batch = packIds.slice(i, i + batchSize);
          const barcodesQuery = query(barcodesCollection, where('packId', 'in', batch));
          const barcodeSnapshot = await getDocs(barcodesQuery);

          barcodeSnapshot.forEach(doc => {
              const barcode = { id: doc.id, ...doc.data() } as Barcode;
              barcodesMap.set(barcode.packId, barcode);
          });
      }

      // Attach barcodeId and status to each pack
      shipments.forEach(shipment => {
          shipment.packs.forEach(pack => {
              const barcode = barcodesMap.get(pack.id);
              if (barcode) {
                  pack.barcodeId = barcode.id;
                  pack.status = barcode.status;
                  pack.isPrinted = barcode.isPrinted;
              }
          });
      });
  } catch (error) {
      console.error('Error fetching barcodes:', error);
      // Continue without barcodes if query fails
  }

  return shipments;
}

export const deleteShipment = async (id: string): Promise<void> => {
    // Also delete associated barcodes
    const q = query(barcodesCollection, where('inboundShipmentId', '==', id));
    const barcodeSnapshot = await getDocs(q);
    const batch = writeBatch(firestore);
    barcodeSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    const shipmentDoc = doc(firestore, 'inboundShipments', id);
    batch.delete(shipmentDoc);
    await batch.commit();
};


// --- Barcode ---
export const subscribeToBarcodesForPack = (
  packId: string,
  callback: (barcodes: Barcode[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(barcodesCollection, where('packId', '==', packId));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const barcodes = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Barcode)
      );
      callback(barcodes);
    },
    (error) => {
      console.error("Error subscribing to barcodes: ", error);
      onError(error);
    }
  );

  return unsubscribe;
};

const enrichBarcodesWithShipmentData = async (barcodes: Barcode[]): Promise<Barcode[]> => {
    if (barcodes.length === 0) return barcodes;
  
    const shipmentIds = [...new Set(barcodes.map(b => b.inboundShipmentId))];
    if (shipmentIds.length === 0) return barcodes;
  
    const shipmentsSnapshot = await getDocs(query(inboundShipmentsCollection, where(documentId(), 'in', shipmentIds)));
    const shipmentsMap = new Map<string, InboundShipment>();
    shipmentsSnapshot.forEach(doc => {
      shipmentsMap.set(doc.id, { id: doc.id, ...doc.data() } as InboundShipment);
    });
  
    return barcodes.map(barcode => {
      const shipment = shipmentsMap.get(barcode.inboundShipmentId);
      if (shipment) {
        return {
          ...barcode,
          supplier: shipment.supplierName,
          poNumber: shipment.poNumber,
        };
      }
      return barcode;
    });
};

export const getBarcodesBySkuId = async (skuId: string, storeId: string): Promise<Barcode[]> => {
    const q = query(
        barcodesCollection, 
        where('skuId', '==', skuId), 
        where('storeId', '==', storeId),
        where('status', '==', 'in-stock')
    );
    const querySnapshot = await getDocs(q);
    const barcodes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Barcode));
    return enrichBarcodesWithShipmentData(barcodes);
}

export const getBarcodesForShipment = async (shipmentId: string): Promise<Barcode[]> => {
    const q = query(barcodesCollection, where('inboundShipmentId', '==', shipmentId));
    const querySnapshot = await getDocs(q);
    const barcodes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Barcode));
    return enrichBarcodesWithShipmentData(barcodes);
}

export const getBarcodesBySkuCode = async (skuCode: string, storeId: string): Promise<Barcode[]> => {
    const q = query(barcodesCollection, where('skuCode', '==', skuCode), where('storeId', '==', storeId));
    const querySnapshot = await getDocs(q);
    const barcodes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Barcode));
    return enrichBarcodesWithShipmentData(barcodes);
}

export const getBarcodesByBarcodeIds = async (barcodeDocumentIds: string[], storeId: string): Promise<Barcode[]> => {
    if (barcodeDocumentIds.length === 0) return [];
    
    // Firestore 'in' queries are limited to 30 values.
    const chunks: string[][] = [];
    for (let i = 0; i < barcodeDocumentIds.length; i += 30) {
        chunks.push(barcodeDocumentIds.slice(i, i + 30));
    }
    
    const results: Barcode[] = [];
    
    for (const chunk of chunks) {
        const q = query(
            barcodesCollection, 
            where(documentId(), 'in', chunk),
            where('storeId', '==', storeId)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(doc => {
            results.push({ id: doc.id, ...doc.data() } as Barcode);
        });
    }

    return enrichBarcodesWithShipmentData(results);
}


export const getBarcode = async (id: string, storeId: string): Promise<Barcode | null> => {
    const docRef = doc(firestore, 'barcodes', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists() && docSnap.data().storeId === storeId) {
        let barcodeData = { id: docSnap.id, ...docSnap.data() } as Barcode;
        
        // Enrich with shipment data
        const enrichedBarcodes = await enrichBarcodesWithShipmentData([barcodeData]);
        barcodeData = enrichedBarcodes[0];

        return barcodeData;
    }
    return null;
}

export const getBarcodeByBarcodeID = async (barcodeID: string): Promise<Barcode | null> => {
    const q = query(barcodesCollection, where('barcodeID', '==', barcodeID), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        let barcodeData = { id: docSnap.id, ...docSnap.data() } as Barcode;
        const enrichedBarcodes = await enrichBarcodesWithShipmentData([barcodeData]);
        return enrichedBarcodes[0];
    }
    return null;
};


export const updateBarcode = async (id: string, barcodeUpdate: Partial<Omit<Barcode, 'id'>>): Promise<void> => {
  const barcodeDocRef = doc(firestore, 'barcodes', id);

  await runTransaction(firestore, async (transaction) => {
    // --- 1. ALL READS MUST COME FIRST ---
    const barcodeDoc = await transaction.get(barcodeDocRef);
    if (!barcodeDoc.exists()) {
      throw new Error("Barcode to update not found");
    }
    const originalBarcode = barcodeDoc.data() as Barcode;

    let shipmentRef: any = null;
    let shipmentData: InboundShipment | null = null;
    if (originalBarcode.inboundShipmentId) {
      shipmentRef = doc(inboundShipmentsCollection, originalBarcode.inboundShipmentId);
      const shipmentDoc = await transaction.get(shipmentRef);
      if (shipmentDoc.exists()) {
        shipmentData = shipmentDoc.data() as InboundShipment;
      }
    }
    
    const skuRef = originalBarcode.skuId ? doc(skusCollection, originalBarcode.skuId) : null;
    let skuDoc = null;
    if (skuRef) {
        // Read the SKU document as part of the initial read phase.
        skuDoc = await transaction.get(skuRef);
    }

    // --- 2. ALL WRITES COME AFTER ALL READS ---
    
    // First, update the barcode document itself.
    transaction.update(barcodeDocRef, { ...barcodeUpdate, updatedAt: Timestamp.now() });

    // If the status is changing, we need to update other documents.
    if (barcodeUpdate.status && originalBarcode.status !== barcodeUpdate.status) {
      const oldStatus = originalBarcode.status;
      const newStatus = barcodeUpdate.status;

      // Update the pack status within the InboundShipment document.
      if (shipmentRef && shipmentData) {
          const packs = shipmentData.packs.map(pack => 
              pack.id === originalBarcode.packId 
              ? { ...pack, status: newStatus } 
              : pack
          );
          transaction.update(shipmentRef, { packs });
      }
      
      // Update the SKU's remaining pack and quantity counts.
      if (skuRef && skuDoc && skuDoc.exists()) { // Check if skuDoc was read successfully
          let packIncrement = 0;
          let quantityIncrement = 0;

          if (oldStatus === 'in-stock' && (newStatus === 'out-of-stock' || newStatus === 'lost')) {
              packIncrement = -1;
              quantityIncrement = -originalBarcode.quantity;
          } else if ((oldStatus === 'out-of-stock' || oldStatus === 'lost') && newStatus === 'in-stock') {
              packIncrement = 1;
              quantityIncrement = originalBarcode.quantity;
          }
          
          if (packIncrement !== 0 || quantityIncrement !== 0) {
               transaction.update(skuRef, { 
                  remainingPacks: increment(packIncrement),
                  remainingQuantity: increment(quantityIncrement) 
              });
          }
      }
    }
  });
};


export const markBarcodesAsPrinted = async (barcodeIds: string[], storeId: string) => {
    if (barcodeIds.length === 0) return;

    // Use a transaction to ensure atomicity and security
    await runTransaction(firestore, async (transaction) => {
        // Perform all reads first.
        const barcodeRefs = barcodeIds.map(id => doc(barcodesCollection, id));
        const barcodeDocs = await Promise.all(barcodeRefs.map(ref => transaction.get(ref)));

        // Now, perform all validations and prepare writes.
        for (let i = 0; i < barcodeDocs.length; i++) {
            const barcodeDoc = barcodeDocs[i];
            const barcodeRef = barcodeRefs[i];

            if (!barcodeDoc.exists() || barcodeDoc.data().storeId !== storeId) {
                // If a barcode doesn't exist or doesn't belong to the user's store, throw an error.
                // This prevents users from marking barcodes in other stores as printed.
                throw new Error(`Permission denied or barcode not found: ${barcodeRef.id}`);
            }
            
            // Queue the write operation.
            transaction.update(barcodeRef, { isPrinted: true });
        }
    });
};


export const deleteBarcode = async (id: string): Promise<void> => {
  const barcodeDoc = doc(firestore, 'barcodes', id);
  await deleteDoc(barcodeDoc);
};
