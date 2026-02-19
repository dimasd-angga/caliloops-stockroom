import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

/**
 * Debug utility to check PO status and why it appears in shipping estimates
 */
export async function debugPOStatus(poNumber: string) {
  console.group(`🔍 Debugging PO: ${poNumber}`);

  try {
    // 1. Find the PO
    const posCollection = collection(firestore, 'purchaseOrders');
    const q = query(posCollection, where('poNumber', '==', poNumber));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.error('❌ PO not found!');
      console.groupEnd();
      return;
    }

    const poDoc = snapshot.docs[0];
    const po = { id: poDoc.id, ...poDoc.data() };

    console.log('📋 PO Data:', {
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      storeId: po.storeId,
      supplierId: po.supplierId,
      supplierName: po.supplierName,
    });

    // 2. Check PO Receive
    const poReceivesCollection = collection(firestore, 'poReceives');
    const receiveQuery = query(poReceivesCollection, where('poId', '==', po.id));
    const receiveSnapshot = await getDocs(receiveQuery);

    if (receiveSnapshot.empty) {
      console.log('⚠️ No PO Receive found for this PO');
    } else {
      const poReceiveDoc = receiveSnapshot.docs[0];
      const poReceive = { id: poReceiveDoc.id, ...poReceiveDoc.data() };

      console.log('📦 PO Receive Data:', {
        id: poReceive.id,
        status: poReceive.status,
        totalItemsCount: poReceive.totalItemsCount,
        totalReceivedItems: poReceive.totalReceivedItems,
        completedAt: poReceive.completedAt,
      });

      // 3. Check PO Receive Items
      const receiveItemsCollection = collection(firestore, 'poReceiveItems');
      const itemsQuery = query(receiveItemsCollection, where('poReceiveId', '==', poReceive.id));
      const itemsSnapshot = await getDocs(itemsQuery);

      console.log(`📝 PO Receive Items (${itemsSnapshot.size} items):`);
      itemsSnapshot.docs.forEach((itemDoc, index) => {
        const item = itemDoc.data();
        console.log(`  Item ${index + 1}:`, {
          itemCode: item.itemCode,
          itemName: item.itemName,
          skuId: item.skuId,
          skuCode: item.skuCode,
          quantity: item.quantity,
          qtyReceived: item.qtyReceived,
          qtyNotReceived: item.qtyNotReceived,
          qtyDamaged: item.qtyDamaged,
          hasReceivedInput: item.hasReceivedInput,
        });
      });
    }

    // 4. Decision logic
    console.log('\n🎯 Decision Logic:');

    if (po.status === 'DONE') {
      console.log('✅ PO status is DONE → Should be SKIPPED');
    } else if (po.status === 'RECEIVED') {
      console.log('✅ PO status is RECEIVED → Should be SKIPPED');
    } else if (po.status === 'IN SHIPPING' || po.status === 'IN SHIPPING (PARTIAL)') {
      console.log('⚠️ PO status is IN SHIPPING → Should check further');

      if (!receiveSnapshot.empty) {
        const poReceive = receiveSnapshot.docs[0].data();
        if (poReceive.status === 'COMPLETED') {
          console.log('✅ PO Receive is COMPLETED → Should be SKIPPED');
        } else if (poReceive.status === 'IN_PROGRESS') {
          console.log('⚠️ PO Receive is IN_PROGRESS → Should check qtyNotReceived');

          // Calculate total qtyNotReceived
          const receiveItemsCollection = collection(firestore, 'poReceiveItems');
          const itemsQuery = query(receiveItemsCollection, where('poReceiveId', '==', receiveSnapshot.docs[0].id));
          const itemsSnapshot = await getDocs(itemsQuery);

          const totalNotReceived = itemsSnapshot.docs.reduce((sum, doc) => {
            return sum + (doc.data().qtyNotReceived || 0);
          }, 0);

          if (totalNotReceived === 0) {
            console.log('✅ Total qtyNotReceived = 0 → Should be SKIPPED');
          } else {
            console.log(`❌ Total qtyNotReceived = ${totalNotReceived} → Should APPEAR in estimate`);
          }
        }
      } else {
        console.log('❌ No PO Receive → Should APPEAR in estimate (full qty)');
      }
    } else {
      console.log(`⚠️ PO status is ${po.status} → Check if should be included`);
    }

  } catch (error) {
    console.error('❌ Error during debug:', error);
  }

  console.groupEnd();
}
