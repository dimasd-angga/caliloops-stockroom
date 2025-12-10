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
    doc,
    updateDoc,
    deleteDoc,
} from 'firebase/firestore';
import type { Supplier } from '../types';

const suppliersCollection = collection(firestore, 'suppliers');

export const subscribeToSuppliers = (
    storeId: string,
    callback: (suppliers: Supplier[]) => void,
    onError: (error: Error) => void
) => {
    console.log('[supplierService] subscribeToSuppliers called with storeId:', storeId);
    console.log('[supplierService] Firestore instance:', firestore);
    console.log('[supplierService] Suppliers collection path:', suppliersCollection.path);

    const q = query(
        suppliersCollection,
        where('storeId', '==', storeId),
        orderBy('name', 'asc')
    );

    console.log('[supplierService] Query created:', {
        storeId,
        constraints: 'where(storeId == ' + storeId + '), orderBy(name, asc)'
    });

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            console.log('[supplierService] Snapshot received:', {
                empty: snapshot.empty,
                size: snapshot.size,
                docs: snapshot.docs.length,
                metadata: snapshot.metadata
            });

            if (snapshot.empty) {
                console.warn('[supplierService] Snapshot is empty - no suppliers found for storeId:', storeId);
            }

            const suppliers = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                console.log('[supplierService] Processing supplier doc:', {
                    id: docSnap.id,
                    storeId: data.storeId,
                    name: data.name
                });
                return { id: docSnap.id, ...data } as Supplier;
            });

            console.log('[supplierService] Mapped suppliers:', suppliers.length, suppliers);
            callback(suppliers);
        },
        (error) => {
            console.error('[supplierService] Error in snapshot listener:', error);
            console.error('[supplierService] Error details:', {
                message: error.message,
                code: error.code,
                name: error.name,
                stack: error.stack
            });
            onError(error);
        }
    );

    console.log('[supplierService] Snapshot listener attached');
    return unsubscribe;
};

export const addSupplier = async (
    supplierData: Omit<Supplier, 'id' | 'createdAt'>
): Promise<string> => {
    const newSupplier = {
        ...supplierData,
        createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(suppliersCollection, newSupplier);
    return docRef.id;
};

export const updateSupplier = async (id: string, data: Partial<Omit<Supplier, 'id' | 'createdAt'>>) => {
    const supplierDoc = doc(firestore, 'suppliers', id);
    await updateDoc(supplierDoc, data);
};

export const deleteSupplier = async (id: string) => {
    const supplierDoc = doc(firestore, 'suppliers', id);
    await deleteDoc(supplierDoc);
};
