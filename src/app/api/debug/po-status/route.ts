import { NextRequest, NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const poNumber = searchParams.get('poNumber');

  if (!poNumber) {
    return NextResponse.json({ error: 'poNumber parameter required' }, { status: 400 });
  }

  try {
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

    let poReceive = null;
    let receiveItems: any[] = [];

    if (!receiveSnapshot.empty) {
      const poReceiveDoc = receiveSnapshot.docs[0];
      poReceive = { id: poReceiveDoc.id, ...poReceiveDoc.data() };

      // Get receive items
      const receiveItemsCollection = collection(firestore, 'poReceiveItems');
      const itemsQuery = query(receiveItemsCollection, where('poReceiveId', '==', poReceive.id));
      const itemsSnapshot = await getDocs(itemsQuery);

      receiveItems = itemsSnapshot.docs.map((doc) => {
        const item = doc.data();
        return {
          itemCode: item.itemCode,
          itemName: item.itemName,
          skuId: item.skuId,
          skuCode: item.skuCode,
          quantity: item.quantity,
          qtyReceived: item.qtyReceived,
          qtyNotReceived: item.qtyNotReceived,
          qtyDamaged: item.qtyDamaged,
          hasReceivedInput: item.hasReceivedInput,
        };
      });
    }

    // 3. Calculate decision
    let decision = '';
    let shouldAppear = false;

    if (po.status === 'DONE') {
      decision = '✅ PO status is DONE → Should be SKIPPED';
      shouldAppear = false;
    } else if (po.status === 'RECEIVED') {
      decision = '✅ PO status is RECEIVED → Should be SKIPPED';
      shouldAppear = false;
    } else if (po.status === 'IN SHIPPING' || po.status === 'IN SHIPPING (PARTIAL)') {
      if (poReceive) {
        if (poReceive.status === 'COMPLETED') {
          decision = '✅ PO Receive is COMPLETED → Should be SKIPPED';
          shouldAppear = false;
        } else if (poReceive.status === 'IN_PROGRESS') {
          const totalNotReceived = receiveItems.reduce((sum, item) => sum + (item.qtyNotReceived || 0), 0);
          if (totalNotReceived === 0) {
            decision = '✅ Total qtyNotReceived = 0 → Should be SKIPPED';
            shouldAppear = false;
          } else {
            decision = `❌ Total qtyNotReceived = ${totalNotReceived} → Should APPEAR`;
            shouldAppear = true;
          }
        }
      } else {
        decision = '❌ No PO Receive → Should APPEAR (full qty)';
        shouldAppear = true;
      }
    } else {
      decision = `⚠️ PO status is ${po.status}`;
      shouldAppear = false;
    }

    return NextResponse.json({
      success: true,
      poNumber: po.poNumber,
      poStatus: po.status,
      poReceiveStatus: poReceive?.status || 'NOT_FOUND',
      poReceiveItemsCount: receiveItems.length,
      items: receiveItems,
      decision,
      shouldAppear,
      totalQtyNotReceived: receiveItems.reduce((sum, item) => sum + (item.qtyNotReceived || 0), 0),
    });
  } catch (error: any) {
    console.error('Error debugging PO:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
