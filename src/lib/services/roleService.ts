
import { firestore } from '@/lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import type { Role } from '../types';

const rolesCollection = collection(firestore, 'roles');

export const subscribeToRoles = (
  callback: (roles: Role[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(rolesCollection);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const roles = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Role)
      );
      // Filter out the 'god' role from being displayed/managed in the UI
      callback(roles.filter(role => role.id !== 'god'));
    },
    (error) => {
      console.error('Error subscribing to roles: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};

export const addRole = async (role: Omit<Role, 'id'>): Promise<string> => {
  // Ensure we don't try to add a role with the 'god' id
  if ((role as any).id === 'god') {
      throw new Error("Cannot create role with reserved ID 'god'.");
  }
  const docRef = await addDoc(rolesCollection, role);
  return docRef.id;
};

export const updateRole = async (
  id: string,
  role: Partial<Omit<Role, 'id'>>
): Promise<void> => {
    // Prevent updating the 'god' role from the UI
    if (id === 'god') {
        throw new Error("The 'God Mode' role cannot be modified.");
    }
  const roleDoc = doc(firestore, 'roles', id);
  await updateDoc(roleDoc, role);
};

export const deleteRole = async (id: string): Promise<void> => {
    // Prevent deleting the 'god' role
    if (id === 'god') {
        throw new Error("The 'God Mode' role cannot be deleted.");
    }
  const roleDoc = doc(firestore, 'roles', id);
  await deleteDoc(roleDoc);
};
