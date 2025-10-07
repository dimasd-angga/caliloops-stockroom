'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Moon, Sun, Store } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Icons } from '../icons';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { UserContext } from '@/app/dashboard/layout';
import type { Store as StoreType } from '@/lib/types';
import { subscribeToStores } from '@/lib/services/storeService';

export function DashboardHeader() {
  const { setTheme, theme } = useTheme();
  const router = useRouter();
  const { user, selectedStoreId, setSelectedStoreId } = React.useContext(UserContext);
  const [stores, setStores] = React.useState<StoreType[]>([]);

  React.useEffect(() => {
    // Only fetch all stores if it's the global superadmin
    if (user?.email === 'superadmin@caliloops.com' && !user.storeId) {
        const unsubscribe = subscribeToStores(
            (storeData) => setStores(storeData),
            (error) => console.error("Failed to fetch stores for header dropdown", error)
        );
        return () => unsubscribe();
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out: ', error);
      // You could add a toast here for the user
    }
  };
  
  const getInitials = (name: string | undefined | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
      <Link
        href="/dashboard"
        className="hidden items-center gap-2 text-lg font-semibold sm:flex"
      >
        <Icons.logo className="h-6 w-6" />
        <span>Caliloops</span>
      </Link>
      <SidebarTrigger className="sm:hidden" />
      <div className="flex-1" />
      {/* Show store selector only for global superadmin */}
      {user?.email === 'superadmin@caliloops.com' && !user.storeId && (
        <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <Select
                value={selectedStoreId || 'all'}
                onValueChange={(value) => setSelectedStoreId(value === 'all' ? null : value)}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Store" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    {stores.map(store => (
                        <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      )}
      <div className="hidden items-center gap-2 text-sm font-medium text-muted-foreground sm:flex">
        <span>Welcome, {user?.name || 'User'}</span>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
            <Avatar>
              <AvatarImage src="https://placehold.co/32x32" alt={user?.name || ''} />
              <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user?.name || 'My Account'}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleLogout} className="cursor-pointer">
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
