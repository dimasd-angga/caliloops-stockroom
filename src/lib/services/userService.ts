
import { firestore, auth } from '@/lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  getDocs,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import type { User, UserWithRole, Role, Store } from '../types';

const usersCollection = collection(firestore, 'users');
const rolesCollection = collection(firestore, 'roles');
const storesCollection = collection(firestore, 'stores');


export const getUserWithRole = async (userId: string): Promise<UserWithRole | null> => {
    const userDocRef = doc(firestore, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
        return null;
    }

    const userData = { id: userDocSnap.id, ...userDocSnap.data() } as User;
    
    let roleData: Role | null = null;
    if (userData.roleId) {
        const roleDocRef = doc(firestore, 'roles', userData.roleId);
        const roleDocSnap = await getDoc(roleDocRef);
        roleData = roleDocSnap.exists() ? { id: roleDocSnap.id, ...roleDocSnap.data() } as Role : null;
    }

    let storeData: Store | null = null;
    if (userData.storeId) {
        const storeDocRef = doc(firestore, 'stores', userData.storeId);
        const storeDocSnap = await getDoc(storeDocRef);
        storeData = storeDocSnap.exists() ? { id: storeDocSnap.id, ...storeDocSnap.data() } as Store : null;
    }
    
    return { ...userData, role: roleData, store: storeData };
}

export const subscribeToUsersWithRoles = (
  callback: (users: UserWithRole[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(usersCollection);

  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
      try {
        const rolesSnapshot = await getDocs(rolesCollection);
        const roles = rolesSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Role)
        );
        const rolesMap = new Map(roles.map((role) => [role.id, role]));

        const storesSnapshot = await getDocs(storesCollection);
        const stores = storesSnapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as Store)
        );
        const storesMap = new Map(stores.map((store) => [store.id, store]));

        const users = snapshot.docs.map((doc) => {
          const userData = { id: doc.id, ...doc.data() } as User;
          return {
            ...userData,
            role: rolesMap.get(userData.roleId) || null,
            store: storesMap.get(userData.storeId || '') || null,
          };
        });
        callback(users);
      } catch (error: any) {
        console.error("Error fetching related user data:", error);
        onError(error);
      }
    },
    (error) => {
      console.error('Error subscribing to users: ', error);
      onError(error);
    }
  );

  return unsubscribe;
};

export const addUser = async (user: Omit<User, 'id'>, password: string): Promise<string> => {
  // IMPORTANT: To prevent the admin from being logged out, we create a temporary
  // Firebase app instance just for this user creation operation.
  const tempAppName = `temp-user-creation-${Date.now()}`;
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  
  const tempApp = initializeApp(firebaseConfig, tempAppName);
  const tempAuth = getAuth(tempApp);

  try {
    const userCredential = await createUserWithEmailAndPassword(tempAuth, user.email, password);
    const authUid = userCredential.user.uid;

    // Now create the user document in Firestore with the UID from Auth
    const userDocRef = doc(firestore, 'users', authUid);
    await setDoc(userDocRef, user);

    return authUid;
  } catch(error) {
    // Rethrow the error so the UI can catch it
    throw error;
  } finally {
    // Clean up the temporary app instance
    await deleteApp(tempApp);
  }
};


export const updateUser = async (
  id: string,
  user: Partial<Omit<User, 'id'>>
): Promise<void> => {
  const userDoc = doc(firestore, 'users', id);
  await updateDoc(userDoc, user);
};

export const deleteUser = async (id: string): Promise<void> => {
    // Note: This only deletes the Firestore record.
    // In a real app, you would need a backend function to delete the user from Firebase Auth.
  const userDoc = doc(firestore, 'users', id);
  await deleteDoc(userDoc);
};
