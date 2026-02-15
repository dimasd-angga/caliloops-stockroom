import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';

/**
 * Force update PO status to DONE if PO Receive is COMPLETED
 */
export async function fixPOStatusIfCompleted(poNumber: string) {
  console.group(`🔧 Fixing PO Status: ${poNumber}`);

  try {
    // 1. Find the PO
    const posCollection = collection(firestore, 'purchaseOrders');
    const q = query(posCollection, where('poNumber', '==', poNumber));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.error('❌ PO not found!');
      console.groupEnd();
      return { success: false, message: 'PO not found' };
    }

    const poDoc = snapshot.docs[0];
    const po = { id: poDoc.id, ...poDoc.data() };

    console.log('📋 Current PO Status:', po.status);

    // 2. Check PO Receive
    const poReceivesCollection = collection(firestore, 'poReceives');
    const receiveQuery = query(poReceivesCollection, where('poId', '==', po.id));
    const receiveSnapshot = await getDocs(receiveQuery);

    if (receiveSnapshot.empty) {
      console.log('⚠️ No PO Receive found - cannot update status');
      console.groupEnd();
      return { success: false, message: 'No PO Receive found' };
    }

    const poReceive = receiveSnapshot.docs[0].data();
    console.log('📦 PO Receive Status:', poReceive.status);

    // 3. Update PO status if receive is completed but PO is not DONE
    if (poReceive.status === 'COMPLETED' && po.status !== 'DONE') {
      const poRef = doc(firestore, 'purchaseOrders', po.id);
      await updateDoc(poRef, {
        status: 'DONE',
        updatedAt: Timestamp.now(),
      });

      console.log('✅ Updated PO status from', po.status, 'to DONE');
      console.groupEnd();
      return {
        success: true,
        message: `Updated ${poNumber} status from ${po.status} to DONE`,
        oldStatus: po.status,
        newStatus: 'DONE'
      };
    } else if (poReceive.status === 'COMPLETED' && po.status === 'DONE') {
      console.log('✅ PO status is already DONE - no update needed');
      console.groupEnd();
      return {
        success: true,
        message: `${poNumber} is already DONE`,
        oldStatus: 'DONE',
        newStatus: 'DONE'
      };
    } else {
      console.log('⚠️ PO Receive is not COMPLETED - cannot set PO to DONE');
      console.groupEnd();
      return {
        success: false,
        message: `PO Receive status is ${poReceive.status}, not COMPLETED`,
      };
    }

  } catch (error) {
    console.error('❌ Error during fix:', error);
    console.groupEnd();
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}
