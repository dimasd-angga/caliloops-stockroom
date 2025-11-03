
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
  updateDoc,
  doc,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import type { PurchaseOrder, Supplier } from '../types';

const purchaseOrdersCollection = collection(firestore, 'purchaseOrders');
const suppliersCollection = collection(firestore, 'suppliers');


export const subscribeToPurchaseOrders = (
  storeId: string,
  callback: (purchaseOrders: PurchaseOrder[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(
    purchaseOrdersCollection, 
    where('storeId', '==', storeId), 
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
        try {
            const suppliersSnapshot = await getDocs(query(suppliersCollection, where('storeId', '==', storeId)));
            const suppliersMap = new Map(suppliersSnapshot.docs.map(doc => [doc.id, doc.data() as Supplier]));

            const purchaseOrders = snapshot.docs.map((doc) => {
                const poData = doc.data() as PurchaseOrder;
                const supplier = suppliersMap.get(poData.supplierId);
                return {
                    id: doc.id,
                    ...poData,
                    supplierName: supplier?.name || 'Unknown Supplier',
                    supplierCode: supplier?.supplierCode || 'N/A'
                }
            });
            callback(purchaseOrders);
        } catch (error: any) {
            onError(error);
        }
    },
    (error) => {
      console.error('Error subscribing to purchase orders: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};

export const getPurchaseOrderById = async (poId: string): Promise<PurchaseOrder | null> => {
    if (!poId) return null;
    const docRef = doc(firestore, 'purchaseOrders', poId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as PurchaseOrder) : null;
};

export const getPurchaseOrderWithSupplier = async (poId: string): Promise<(PurchaseOrder & { supplier?: Supplier }) | null> => {
    if (!poId) return null;
    const poDocRef = doc(firestore, 'purchaseOrders', poId);
    const poDocSnap = await getDoc(poDocRef);

    if (!poDocSnap.exists()) return null;

    const poData = { id: poDocSnap.id, ...poDocSnap.data() } as PurchaseOrder;

    if (poData.supplierId) {
        const supplierDocRef = doc(firestore, 'suppliers', poData.supplierId);
        const supplierDocSnap = await getDoc(supplierDocRef);
        if (supplierDocSnap.exists()) {
            poData.supplier = { id: supplierDocSnap.id, ...supplierDocSnap.data() } as Supplier;
        }
    }
    
    return poData;
};


export const findPOsByTrackingNumbers = async (storeId: string, trackingNumbers: string[]): Promise<PurchaseOrder[]> => {
    if (trackingNumbers.length === 0) return [];
    
    const chunks: string[][] = [];
    for (let i = 0; i < trackingNumbers.length; i += 30) {
        chunks.push(trackingNumbers.slice(i, i + 30));
    }
    
    const poResults: PurchaseOrder[] = [];
    const poIds = new Set<string>();
    
    for (const chunk of chunks) {
        const q = query(
            purchaseOrdersCollection,
            where('storeId', '==', storeId),
            where('trackingNumber', 'array-contains-any', chunk)
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            if (!poIds.has(doc.id)) {
                poResults.push({ id: doc.id, ...doc.data() } as PurchaseOrder);
                poIds.add(doc.id);
            }
        });
    }

    return poResults;
};

export const updatePOStatusAndShippingCost = async (poIds: string[], shippingCost: number) => {
    const batch = writeBatch(firestore);

    poIds.forEach(id => {
        const poRef = doc(firestore, 'purchaseOrders', id);
        batch.update(poRef, {
            shippingCost: shippingCost,
            status: 'SHIPPING'
        });
    });

    await batch.commit();
}


export const subscribeToPurchaseOrdersBySupplier = (
    storeId: string,
    supplierId: string,
    callback: (purchaseOrders: PurchaseOrder[]) => void,
    onError: (error: Error) => void
  ) => {
    const q = query(
      purchaseOrdersCollection,
      where('storeId', '==', storeId),
      where('supplierId', '==', supplierId),
      orderBy('createdAt', 'desc')
    );
  
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const purchaseOrders = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as PurchaseOrder)
        );
        callback(purchaseOrders);
      },
      (error) => {
        console.error('Error subscribing to POs by supplier: ', error);
        onError(error);
      }
    );
  
    return unsubscribe;
  };

export const addOrUpdatePurchaseOrder = async (
  poData: Partial<PurchaseOrder> & { storeId: string }
): Promise<string> => {
  
  if (poData.shippingCost && poData.totalPcs && poData.totalPcs > 0) {
    poData.costPerPiece = poData.shippingCost / poData.totalPcs;
  }

  let newStatus = poData.status || 'INPUTTED';
  if (poData.trackingNumber && poData.trackingNumber.length > 0 && newStatus === 'INPUTTED') {
      newStatus = 'SHIPPING';
  }
  
  const finalPoData = { ...poData, status: newStatus };


  if (poData.id) {
    const poRef = doc(firestore, 'purchaseOrders', poData.id);
    await updateDoc(poRef, {
      ...finalPoData,
      updatedAt: Timestamp.now(),
    });
    return poData.id;
  } else {
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    
    const newPO: Omit<PurchaseOrder, 'id' | 'supplier'> = {
        orderNumber: '',
        totalPcs: 0,
        totalRmb: 0,
        exchangeRate: 0,
        marking: '',
        chatSearch: '',
        trackingNumber: [],
        ...finalPoData, 
        poNumber,
        status: 'INPUTTED',
        isStockUpdated: false,
        shippingNote: '',
        isNewItemsUploaded: false,
        isNewItemsAddedToPurchase: false,
        totalPcsOldReceived: 0,
        totalPcsNewReceived: 0,
        totalPcsRefunded: 0,
        hasRefund: false,
        refundAmountYuan: 0,
        isSupplierRefundApproved: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    } as Omit<PurchaseOrder, 'id' | 'supplier'>;

    const docRef = await addDoc(purchaseOrdersCollection, newPO);
    return docRef.id;
  }
};
