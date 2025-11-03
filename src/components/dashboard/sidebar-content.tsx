
'use client';

import Link from 'next/link';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  useSidebar,
} from '@/components/ui/sidebar';
import { Icons } from '@/components/icons';
import {
  ArrowDownToLine,
  Warehouse,
  ClipboardList,
  History,
  Users,
  ArrowRightLeft,
  Store,
  Truck,
  FileText,
  Bike,
  DollarSign,
  Ship,
} from 'lucide-react';
import { UserContext } from '@/app/dashboard/layout';
import type { Permissions } from '@/lib/types';


export function DashboardSidebarContent() {
  const pathname = usePathname();
  const { permissions, loading, user } = React.useContext(UserContext);
  const { setOpenMobile } = useSidebar();


  const links = [
    { href: '/dashboard/inbound', label: 'Inbound', icon: ArrowDownToLine, requiredPermission: 'canGenerateBarcode' },
    { href: '/dashboard/warehouse-io', label: 'Warehouse In/Out', icon: ArrowRightLeft, requiredPermission: 'canGenerateBarcode' },
    { href: '/dashboard/stock-opname', label: 'Stock Opname', icon: ClipboardList, requiredPermission: 'canStartStockOpname' },
    { href: '/dashboard/activity-logging', label: 'Activity Logging', icon: History, requiredPermission: 'canViewActivityLogs' },
    { href: '/dashboard/suppliers', label: 'Suppliers', icon: Truck, requiredPermission: 'canManageSuppliers' },
    { href: '/dashboard/purchase-orders', label: 'Purchase Orders', icon: FileText, requiredPermission: 'canManagePurchaseOrders' },
    { href: '/dashboard/couriers', label: 'Couriers', icon: Bike, requiredPermission: 'canManageCouriers' },
    { href: '/dashboard/refunds', label: 'Refund Management', icon: DollarSign, requiredPermission: 'canManageRefunds' },
    { href: '/dashboard/shipping', label: 'Shipping', icon: Ship, requiredPermission: 'canManageShipping' },
    { href: '/dashboard/user-access', label: 'User Access & Role', icon: Users, requiredPermission: 'canManageUsers' },
    { href: '/dashboard/stores', label: 'Store Management', icon: Store, requiredPermission: 'canManageUsers' },
  ];

  if (loading || !permissions || !user) return null; // or a loading skeleton

  const availableLinks = links.filter(link => {
    // A user with a storeId is a store-level user. They cannot manage other users/stores regardless of their role name.
    if (user.storeId && (link.requiredPermission === 'canManageUsers' || link.requiredPermission === 'canManageRoles')) {
        return false;
    }

    const requiredPermission = link.requiredPermission as keyof Permissions;
    // Check for full access or the specific permission
    return permissions.hasFullAccess || permissions[requiredPermission];
  });


  return (
    <>
      <SidebarHeader>
        <Link href="/dashboard" onClick={() => setOpenMobile(false)}>
          <div className="flex items-center gap-2">
            <Icons.logo className="w-8 h-8 text-primary" />
            <span className="font-semibold text-lg">Caliloops</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="pt-4 px-2">
        <SidebarMenu>
          {availableLinks.map((link) => (
            <SidebarMenuItem key={link.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(link.href)}
                tooltip={{ children: link.label }}
              >
                <Link href={link.href} onClick={() => setOpenMobile(false)}>
                  <link.icon />
                  <span>{link.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
