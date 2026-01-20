import { firestore } from '@/lib/firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    Timestamp,
    where,
    doc,
    updateDoc,
    deleteDoc,
} from 'firebase/firestore';
import type { Courier } from '../types';

const couriersCollection = collection(firestore, 'couriers');

export const subscribeToCouriers = (
    storeId: string,
    callback: (couriers: Courier[]) => void,
    onError: (error: Error) => void
) => {
    console.log('[courierService] subscribeToCouriers called with storeId:', storeId);
    console.log('[courierService] Firestore instance:', firestore);
    console.log('[courierService] Couriers collection path:', couriersCollection.path);

    const q = query(
        couriersCollection,
        where('storeId', '==', storeId),
        orderBy('createdAt', 'desc')
    );

    console.log('[courierService] Query created:', {
        storeId,
        constraints: 'where(storeId == ' + storeId + '), orderBy(createdAt, desc)'
    });

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            console.log('[courierService] Snapshot received:', {
                empty: snapshot.empty,
                size: snapshot.size,
                docs: snapshot.docs.length,
                metadata: snapshot.metadata
            });

            if (snapshot.empty) {
                console.warn('[courierService] Snapshot is empty - no couriers found for storeId:', storeId);
            }

            const couriers = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                console.log('[courierService] Processing courier doc:', {
                    id: docSnap.id,
                    storeId: data.storeId,
                    name: data.name
                });
                return { id: docSnap.id, ...data } as Courier;
            });

            console.log('[courierService] Mapped couriers:', couriers.length, couriers);
            callback(couriers);
        },
        (error) => {
            console.error('[courierService] Error in snapshot listener:', error);
            console.error('[courierService] Error details:', {
                message: error.message,
                code: error.code,
                name: error.name,
                stack: error.stack
            });
            onError(error);
        }
    );

    console.log('[courierService] Snapshot listener attached');
    return unsubscribe;
};

export const addCourier = async (
    courierData: Omit<Courier, 'id' | 'createdAt'>
): Promise<string> => {
    const newCourier = {
        ...courierData,
        createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(couriersCollection, newCourier);
    return docRef.id;
};

export const updateCourier = async (id: string, data: Partial<Omit<Courier, 'id' | 'createdAt'>>) => {
    const courierDoc = doc(firestore, 'couriers', id);
    await updateDoc(courierDoc, data);
};

export const deleteCourier = async (id: string) => {
    const courierDoc = doc(firestore, 'couriers', id);
    await deleteDoc(courierDoc);
};
