
'use client';

import type { ReactNode } from 'react';
import * as React from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { DashboardSidebarContent } from '@/components/dashboard/sidebar-content';
import { DashboardHeader } from '@/components/dashboard/header';
import { ThemeProvider } from '@/components/theme-provider';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { getUserWithRole } from '@/lib/services/userService';
import type { UserContextType, UserWithRole, Permissions } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const defaultPermissions: Permissions = {
  canGenerateBarcode: false,
  canReprintBarcode: false,
  canDeleteItemList: false,
  canEditItemDetails: false,
  canEditPackQuantity: false,
  canPrintAll: false,
  canPrintSelected: false,
  canStartStockOpname: false,
  canMarkItemAsLost: false,
  canRestoreLostItem: false,
  canManageUsers: false,
  canManageRoles: false,
  canViewActivityLogs: false,
  canExportLogs: false,
  canClearLogs: false,
  hasFullAccess: false,
};

const godModePermissions: Permissions = {
    canGenerateBarcode: true,
    canReprintBarcode: true,
    canDeleteItemList: true,
    canEditItemDetails: true,
    canEditPackQuantity: true,
    canPrintAll: true,
    canPrintSelected: true,
    canStartStockOpname: true,
    canMarkItemAsLost: true,
    canRestoreLostItem: true,
    canManageUsers: true,
    canManageRoles: true,
    canViewActivityLogs: true,
    canExportLogs: true,
    canClearLogs: true,
    hasFullAccess: true,
  };

const superAdminStorePermissions: Permissions = {
  ...godModePermissions,
  canManageUsers: false,
  canManageRoles: false,
};

export const UserContext = React.createContext<UserContextType>({
  user: null,
  loading: true,
  permissions: defaultPermissions,
  selectedStoreId: null,
  setSelectedStoreId: () => {},
});

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = React.useState<UserWithRole | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [permissions, setPermissions] = React.useState<Permissions>(defaultPermissions);
  const [selectedStoreId, setSelectedStoreId] = React.useState<string | null>(() => {
    // Load from localStorage on initial mount
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedStoreId');
    }
    return null;
  });
  const router = useRouter();

  // Persist selectedStoreId to localStorage whenever it changes
  React.useEffect(() => {
    if (selectedStoreId) {
      localStorage.setItem('selectedStoreId', selectedStoreId);
    } else {
      localStorage.removeItem('selectedStoreId');
    }
  }, [selectedStoreId]);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseAuthUser | null) => {
      if (firebaseUser) {
        if (firebaseUser.email === 'superadmin@caliloops.com') {
            const godUser: UserWithRole = {
                id: firebaseUser.uid,
                email: firebaseUser.email,
                name: 'Super Admin',
                roleId: 'god',
                role: { id: 'god', name: 'God Mode', permissions: godModePermissions }
            };
            setUser(godUser);
            setPermissions(godModePermissions);
            setLoading(false);
            return;
        }

        try {
          const appUser = await getUserWithRole(firebaseUser.uid);
          setUser(appUser);
          
          if (appUser?.role?.name === 'Super Admin') {
            if (appUser.storeId) {
              setPermissions(superAdminStorePermissions);
            } else {
              setPermissions(godModePermissions);
            }
          } else if (appUser?.role?.permissions) {
            setPermissions(appUser.role.permissions);
          } else {
            setPermissions(defaultPermissions);
          }
        } catch (error) {
          console.error("Failed to fetch user role", error);
          setUser(null);
          setPermissions(defaultPermissions);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setPermissions(defaultPermissions);
        setLoading(false);
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);
  
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // The redirect is handled in the effect
  }

  return (
    <UserContext.Provider value={{ user, loading, permissions, selectedStoreId, setSelectedStoreId }}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <SidebarProvider>
          <div className="flex h-screen w-full flex-col">
            <DashboardHeader />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar>
                <DashboardSidebarContent />
              </Sidebar>
              <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                <SidebarInset>{children}</SidebarInset>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </ThemeProvider>
    </UserContext.Provider>
  );
}
