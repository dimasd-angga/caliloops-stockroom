
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
  deleteDoc,
  increment,
} from 'firebase/firestore';
import type { PurchaseOrder, Shipping, Supplier, Refund } from '../types';

const purchaseOrdersCollection = collection(firestore, 'purchaseOrders');
const suppliersCollection = collection(firestore, 'suppliers');
const shippingCollection = collection(firestore, 'shipping');
const refundsCollection = collection(firestore, 'refunds');


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
    async (poSnapshot) => {
        try {
            // Fetch all necessary related data in parallel
            const [suppliersSnapshot, shippingSnapshot, refundSnapshot] = await Promise.all([
                getDocs(query(suppliersCollection, where('storeId', '==', storeId))),
                getDocs(query(shippingCollection, where('storeId', '==', storeId))),
                getDocs(query(refundsCollection, where('storeId', '==', storeId)))
            ]);

            const suppliersMap = new Map(suppliersSnapshot.docs.map(doc => [doc.id, doc.data() as Supplier]));
            
            const shippingData = shippingSnapshot.docs.map(doc => doc.data() as Shipping);
            const allShippingResi = new Set(shippingData.flatMap(s => Array.isArray(s.noResi) ? s.noResi : [s.noResi]).filter(Boolean));


            const refundsMap = new Map<string, Refund>();
            refundSnapshot.forEach(doc => {
                const refund = doc.data() as Refund;
                refundsMap.set(refund.poId, refund);
            });


            const purchaseOrders = poSnapshot.docs.map((doc) => {
                const poData = doc.data() as PurchaseOrder;
                const supplier = suppliersMap.get(poData.supplierId);
                const refund = refundsMap.get(doc.id);
                
                // --- Dynamic Status Logic ---
                let dynamicStatus: PurchaseOrder['status'] = poData.status; 
                const poTrackingNumbers = poData.trackingNumber || [];
                
                if (poTrackingNumbers.length > 0) {
                    const foundResiCount = poTrackingNumbers.filter(tn => allShippingResi.has(tn)).length;
                    
                    if (foundResiCount === 0) {
                        dynamicStatus = 'INPUTTED';
                    } else if (foundResiCount < poTrackingNumbers.length) {
                        dynamicStatus = 'IN SHIPPING (PARTIAL)';
                    } else {
                        dynamicStatus = 'IN SHIPPING';
                    }
                } else {
                    dynamicStatus = 'INPUTTED';
                }

                // --- Calculate total shipping cost for this PO ---
                let totalShippingCost = 0;
                if (poData.trackingNumber && poData.trackingNumber.length > 0) {
                    shippingData.forEach(shippingEntry => {
                        const resiList = Array.isArray(shippingEntry.noResi) ? shippingEntry.noResi : [shippingEntry.noResi].filter(Boolean);
                        const hasMatchingResi = resiList.some(resi => poData.trackingNumber.includes(resi));
                        if (hasMatchingResi) {
                            totalShippingCost += shippingEntry.harga || 0;
                        }
                    });
                }


                return {
                    id: doc.id,
                    ...poData,
                    status: dynamicStatus, 
                    shippingCost: totalShippingCost, // Override with calculated shipping cost
                    supplierName: supplier?.name || 'Unknown Supplier',
                    supplierCode: supplier?.supplierCode || 'N/A',
                    hasRefund: !!refund,
                    refundAmountYuan: refund?.refundAmount || 0,
                    isSupplierRefundApproved: refund?.isSupplierApproved || false,
                }
            });

            callback(purchaseOrders);
        } catch (error: any) {
            console.error('Error processing purchase orders subscription:', error);
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

export const getPurchaseOrderWithDetails = async (poId: string): Promise<(PurchaseOrder & { supplier?: Supplier, refund?: Refund }) | null> => {
    if (!poId) return null;
    const poDocRef = doc(firestore, 'purchaseOrders', poId);
    
    // Fetch PO and its potential refund simultaneously
    const [poDocSnap, refundSnapshot] = await Promise.all([
        getDoc(poDocRef),
        getDocs(query(refundsCollection, where('poId', '==', poId)))
    ]);

    if (!poDocSnap.exists()) return null;

    const poData = { id: poDocSnap.id, ...poDocSnap.data() } as PurchaseOrder;

    // Attach supplier if it exists
    if (poData.supplierId) {
        const supplierDocRef = doc(firestore, 'suppliers', poData.supplierId);
        const supplierDocSnap = await getDoc(supplierDocRef);
        if (supplierDocSnap.exists()) {
            poData.supplier = { id: supplierDocSnap.id, ...supplierDocSnap.data() } as Supplier;
        }
    }

    // Attach refund if it exists
    if (!refundSnapshot.empty) {
        const refundDoc = refundSnapshot.docs[0];
        poData.refund = { id: refundDoc.id, ...refundDoc.data() } as Refund;
    }

    // Calculate total shipping cost
    if (poData.trackingNumber && poData.trackingNumber.length > 0 && poData.storeId) {
        const shippingQuery = query(
            shippingCollection,
            where('storeId', '==', poData.storeId),
            where('noResi', 'array-contains-any', poData.trackingNumber)
        );
        const shippingSnapshot = await getDocs(shippingQuery);
        let totalShippingCost = 0;
        shippingSnapshot.forEach(shippingDoc => {
            const shippingEntry = shippingDoc.data() as Shipping;
            // Ensure noResi is an array before checking
            const resiList = Array.isArray(shippingEntry.noResi) ? shippingEntry.noResi : [shippingEntry.noResi].filter(Boolean);
            if (resiList.some(resi => poData.trackingNumber.includes(resi))) {
                 totalShippingCost += shippingEntry.harga || 0;
            }
        });
        poData.shippingCost = totalShippingCost;
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
        // We no longer set status to 'SHIPPING' here, as it's now dynamic.
        // We also no longer set a single shippingCost, as it is now aggregated.
        // This function could be deprecated or changed to only trigger a re-evaluation if needed.
        // For now, we'll just update the updatedAt timestamp to trigger a refresh on the client.
        batch.update(poRef, {
            updatedAt: Timestamp.now(),
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
  
  const totalPembelian = (poData.totalRmb || 0) * (poData.exchangeRate || 0);
  const totalOngkir = poData.shippingCost || 0;
  
  if (poData.totalPcs && poData.totalPcs > 0) {
    poData.costPerPiece = (totalPembelian + totalOngkir) / poData.totalPcs;
  } else {
    poData.costPerPiece = 0;
  }
  
  const finalPoData = { ...poData };

  if (poData.id) {
    const poRef = doc(firestore, 'purchaseOrders', poData.id);
    await updateDoc(poRef, {
      ...finalPoData,
      updatedAt: Timestamp.now(),
    });
    return poData.id;
  } else {
    const newPO: Omit<PurchaseOrder, 'id' | 'supplier' | 'refund'> = {
        orderNumber: '',
        totalPcs: 0,
        totalRmb: 0,
        exchangeRate: 0,
        marking: '',
        chatSearch: '',
        trackingNumber: [],
        ...finalPoData, 
        poNumber: poData.poNumber || '',
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
    } as Omit<PurchaseOrder, 'id' | 'supplier' | 'refund'>;

    const docRef = await addDoc(purchaseOrdersCollection, newPO);
    return docRef.id;
  }
};


export const deletePurchaseOrder = async (id: string): Promise<void> => {
    const poDoc = doc(firestore, 'purchaseOrders', id);
    await deleteDoc(poDoc);
  };
