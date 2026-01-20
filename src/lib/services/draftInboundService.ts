import { firestore } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  Timestamp,
  deleteDoc,
} from 'firebase/firestore';
import type { DraftInboundShipment, Unit } from '../types';

const draftInboundCollection = collection(firestore, 'draftInboundShipments');

type DraftPackData = {
  quantity: number;
  unit: Unit;
  note: string;
};

/**
 * Save or update a draft inbound shipment
 */
export const saveDraftInbound = async (
  poReceiveItemId: string,
  storeId: string,
  skuId: string,
  skuCode: string,
  poId: string,
  poNumber: string,
  supplierId: string,
  supplierName: string,
  packs: DraftPackData[]
): Promise<string> => {
  // Use poReceiveItemId as the document ID for easy lookup
  const draftRef = doc(draftInboundCollection, poReceiveItemId);

  const draftData: Omit<DraftInboundShipment, 'id'> = {
    poReceiveItemId,
    storeId,
    skuId,
    skuCode,
    poId,
    poNumber,
    supplierId,
    supplierName,
    packs,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(draftRef, draftData, { merge: true });
  return poReceiveItemId;
};

/**
 * Get a draft by poReceiveItemId
 */
export const getDraftByReceiveItemId = async (
  poReceiveItemId: string
): Promise<DraftInboundShipment | null> => {
  const draftRef = doc(draftInboundCollection, poReceiveItemId);
  const draftDoc = await getDoc(draftRef);

  if (!draftDoc.exists()) {
    return null;
  }

  return { id: draftDoc.id, ...draftDoc.data() } as DraftInboundShipment;
};

/**
 * Delete a draft (when shipment is submitted)
 */
export const deleteDraft = async (poReceiveItemId: string): Promise<void> => {
  const draftRef = doc(draftInboundCollection, poReceiveItemId);
  await deleteDoc(draftRef);
};

/**
 * Get all drafts for a PO
 */
export const getDraftsByPO = async (poId: string): Promise<DraftInboundShipment[]> => {
  const q = query(draftInboundCollection, where('poId', '==', poId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DraftInboundShipment));
};
