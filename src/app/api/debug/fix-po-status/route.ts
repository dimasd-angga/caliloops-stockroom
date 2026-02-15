import { NextRequest, NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poNumber } = body;

    if (!poNumber) {
      return NextResponse.json({ error: 'poNumber required' }, { status: 400 });
    }

    // 1. Find the PO
    const posCollection = collection(firestore, 'purchaseOrders');
    const q = query(posCollection, where('poNumber', '==', poNumber));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ error: 'PO not found' }, { status: 404 });
    }

    const poDoc = snapshot.docs[0];
    const po = { id: poDoc.id, ...poDoc.data() };

    // 2. Check PO Receive
    const poReceivesCollection = collection(firestore, 'poReceives');
    const receiveQuery = query(poReceivesCollection, where('poId', '==', po.id));
    const receiveSnapshot = await getDocs(receiveQuery);

    if (receiveSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'No PO Receive found - cannot update status',
      });
    }

    const poReceive = receiveSnapshot.docs[0].data();

    // 3. Update PO status if receive is completed but PO is not DONE
    if (poReceive.status === 'COMPLETED' && po.status !== 'DONE') {
      const poRef = doc(firestore, 'purchaseOrders', po.id);
      await updateDoc(poRef, {
        status: 'DONE',
        updatedAt: Timestamp.now(),
      });

      return NextResponse.json({
        success: true,
        message: `Updated ${poNumber} status from ${po.status} to DONE`,
        oldStatus: po.status,
        newStatus: 'DONE',
      });
    } else if (poReceive.status === 'COMPLETED' && po.status === 'DONE') {
      return NextResponse.json({
        success: true,
        message: `${poNumber} is already DONE`,
        oldStatus: 'DONE',
        newStatus: 'DONE',
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `PO Receive status is ${poReceive.status}, not COMPLETED. Cannot set PO to DONE.`,
        poReceiveStatus: poReceive.status,
      });
    }
  } catch (error: any) {
    console.error('Error fixing PO:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
