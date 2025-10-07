
'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  PlusCircle,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { User, UserWithRole, Role, Store, Permissions } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  subscribeToUsersWithRoles,
  addUser,
  updateUser,
  deleteUser,
} from '@/lib/services/userService';
import {
    subscribeToRoles,
    addRole,
    updateRole,
    deleteRole as deleteRoleService,
} from '@/lib/services/roleService';
import { subscribeToStores } from '@/lib/services/storeService';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { UserContext } from '@/app/dashboard/layout';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const ROWS_PER_PAGE = 10;
const defaultPermissions: Permissions = {
    canGenerateBarcode: false,
    canReprintBarcode: false,
    canDeleteItemList: false,
    canEditItemDetails: false,
    canEditPackQuantity: false,
    canPrintAll: false,
    canPrintSelected: false,
    canFlagItemAsLost: false,
    canRestoreLostItem: false,
    canManageUsers: false,
    canManageRoles: false,
    canViewActivityLogs: false,
    canExportLogs: false,
    canClearLogs: false,
    hasFullAccess: false,
  };

const permissionCategories = {
    "Inbound & Barcodes": [
        { id: "canGenerateBarcode", label: "Can Generate Barcode & Create SKU" },
        { id: "canReprintBarcode", label: "Can Reprint Barcode" },
        { id: "canPrintAll", label: "Can use 'Print All'" },
        { id: "canPrintSelected", label: "Can use 'Print Selected'" },
        { id: "canDeleteItemList", label: "Can Delete Item List (Not Implemented)" },
        { id: "canEditItemDetails", label: "Can Edit SKU Details" },
        { id: "canEditPackQuantity", label: "Can Edit Pack Quantity (Not Implemented)" },
    ],
    "Stock Opname & Warehouse": [
        { id: "canFlagItemAsLost", label: "Can Flag Item as Lost / Start Audit" },
        { id: "canRestoreLostItem", label: "Can Restore a Lost Item" },
    ],
    "Activity & Reporting": [
        { id: "canViewActivityLogs", label: "Can View Activity Logs" },
        { id: "canExportLogs", label: "Can Export Logs" },
        { id: "canClearLogs", label: "Can Clear Logs (Not Implemented)" },
    ],
    "Administration": [
        { id: "canManageUsers", label: "Can Manage Users" },
        { id: "canManageRoles", label: "Can Manage Roles" },
    ],
    "Global": [
        { id: "hasFullAccess", label: "Full Access (God Mode)" },
    ]
};

export default function UsersPage() {
  const { user: loggedInUser, permissions: loggedInUserPermissions } = React.useContext(UserContext);
  const [users, setUsers] = React.useState<UserWithRole[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [stores, setStores] = React.useState<Store[]>([]);

  const [loadingUsers, setLoadingUsers] = React.useState(true);
  const [loadingRoles, setLoadingRoles] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = React.useState(false);
  const [isSavingUser, setIsSavingUser] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<Partial<UserWithRole> | null>(null);
  const [password, setPassword] = React.useState('');

  // Role Modal State
  const [isRoleModalOpen, setIsRoleModalOpen] = React.useState(false);
  const [isSavingRole, setIsSavingRole] = React.useState(false);
  const [currentRole, setCurrentRole] = React.useState<Partial<Role> | null>(null);


  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Pagination state
  const [usersCurrentPage, setUsersCurrentPage] = React.useState(1);
  const [rolesCurrentPage, setRolesCurrentPage] = React.useState(1);

  React.useEffect(() => {
    if (refreshKey === 0) {
      setLoadingUsers(true);
      setLoadingRoles(true);
    }
    const unsubscribeUsers = subscribeToUsersWithRoles(
      (usersData) => {
        setUsers(usersData);
        setLoadingUsers(false);
        setIsRefreshing(false);
      },
      (error) => {
        toast({ title: 'Error fetching users', description: error.message, variant: 'destructive' });
        setLoadingUsers(false);
        setIsRefreshing(false);
      }
    );

    const unsubscribeRoles = subscribeToRoles(
        (rolesData) => {
            setRoles(rolesData);
            setLoadingRoles(false);
        },
        (error) => {
            toast({ title: 'Error fetching roles', variant: 'destructive' });
            setLoadingRoles(false);
        }
    );

    const unsubscribeStores = subscribeToStores(
        (storesData) => setStores(storesData),
        (error) => toast({ title: 'Error fetching stores', variant: 'destructive' })
    );

    return () => {
        unsubscribeUsers();
        unsubscribeRoles();
        unsubscribeStores();
    };
  }, [toast, refreshKey]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((oldKey) => oldKey + 1);
  };

  // User Modal Handlers
  const openUserModal = (user: Partial<UserWithRole> | null = null) => {
    setCurrentUser(user || { name: '', email: '', roleId: '', storeId: '' });
    setPassword('');
    setIsUserModalOpen(true);
  };
  const closeUserModal = () => setIsUserModalOpen(false);

  // Role Modal Handlers
  const openRoleModal = (role: Partial<Role> | null = null) => {
    setCurrentRole(role || { name: '', permissions: defaultPermissions });
    setIsRoleModalOpen(true);
  };
  const closeRoleModal = () => setIsRoleModalOpen(false);

  const handleSaveUser = async () => {
    if (!currentUser || !currentUser.name || !currentUser.email || !currentUser.roleId) {
        toast({ title: 'Please fill all required fields', variant: 'destructive'});
        return;
    }
    setIsSavingUser(true);
    try {
        const userData: Partial<User> = { name: currentUser.name, email: currentUser.email, roleId: currentUser.roleId, storeId: currentUser.storeId || '' };
        if (currentUser.id) {
            await updateUser(currentUser.id, userData);
            toast({ title: 'User updated successfully!' });
        } else {
            if (!password) {
                toast({ title: 'Please enter a password for the new user', variant: 'destructive'});
                setIsSavingUser(false);
                return;
            }
            await addUser(userData as Omit<User, 'id'>, password);
            toast({ title: 'User added successfully!' });
        }
        closeUserModal();
    } catch (error: any) {
        toast({ title: `Error ${currentUser.id ? 'updating' : 'adding'} user`, description: error.message, variant: 'destructive' });
    } finally {
        setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === loggedInUser?.id) { toast({ title: "You cannot delete yourself.", variant: "destructive" }); return; }
    try {
      await deleteUser(userId);
      toast({ title: 'User deleted successfully!' });
    } catch (error) {
      toast({ title: 'Error deleting user', variant: 'destructive' });
    }
  };

  const handleSaveRole = async () => {
    if (!currentRole || !currentRole.name || !currentRole.permissions) {
        toast({ title: 'Role name and permissions are required.', variant: 'destructive' });
        return;
    }
    setIsSavingRole(true);
    try {
        const roleData: Omit<Role, 'id'> = { name: currentRole.name, permissions: currentRole.permissions };
        if (currentRole.id) {
            await updateRole(currentRole.id, roleData);
            toast({ title: 'Role updated successfully!' });
        } else {
            await addRole(roleData);
            toast({ title: 'Role created successfully!' });
        }
        closeRoleModal();
    } catch (error: any) {
        toast({ title: `Error ${currentRole.id ? 'updating' : 'creating'} role`, description: error.message, variant: 'destructive' });
    } finally {
        setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
        await deleteRoleService(roleId);
        toast({ title: 'Role deleted successfully.' });
    } catch (error: any) {
        toast({ title: 'Error deleting role', description: error.message, variant: 'destructive' });
    }
  };

  const handlePermissionChange = (perm: keyof Permissions, checked: boolean) => {
    setCurrentRole(prev => {
        if (!prev || !prev.permissions) return null;

        const newPermissions = { ...prev.permissions, [perm]: checked };

        if (perm === 'hasFullAccess' && checked) {
            // If hasFullAccess is checked, check all other permissions
            Object.keys(newPermissions).forEach(key => {
                newPermissions[key as keyof Permissions] = true;
            });
        }
        
        if (perm === 'hasFullAccess' && !checked) {
            // If hasFullAccess is unchecked, uncheck all other permissions
             Object.keys(newPermissions).forEach(key => {
                newPermissions[key as keyof Permissions] = false;
            });
        }

        // If another permission is unchecked, uncheck hasFullAccess
        if (perm !== 'hasFullAccess' && !checked) {
            newPermissions.hasFullAccess = false;
        }

        return { ...prev, permissions: newPermissions };
    });
  };
  

  const loading = loadingUsers || loadingRoles;

  // Pagination Logic
  const usersTotalPages = Math.ceil(users.length / ROWS_PER_PAGE);
  const paginatedUsers = React.useMemo(() => users.slice((usersCurrentPage - 1) * ROWS_PER_PAGE, usersCurrentPage * ROWS_PER_PAGE), [users, usersCurrentPage]);
  const handleUserPageChange = (page: number) => { if (page >= 1 && page <= usersTotalPages) setUsersCurrentPage(page); };
  
  const rolesTotalPages = Math.ceil(roles.length / ROWS_PER_PAGE);
  const paginatedRoles = React.useMemo(() => roles.slice((rolesCurrentPage - 1) * ROWS_PER_PAGE, rolesCurrentPage * ROWS_PER_PAGE), [roles, rolesCurrentPage]);
  const handleRolePageChange = (page: number) => { if (page >= 1 && page <= rolesTotalPages) setRolesCurrentPage(page); };

  const getPaginationItems = (currentPage: number, totalPages: number) => {
    const items = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (totalPages > maxPagesToShow && endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    if (startPage > 1) { items.push(<PaginationItem key="first"><PaginationLink onClick={() => currentPage === usersCurrentPage ? handleUserPageChange(1) : handleRolePageChange(1)}>1</PaginationLink></PaginationItem>); if (startPage > 2) { items.push(<PaginationItem key="start-ellipsis"><PaginationEllipsis /></PaginationItem>); } }
    for (let i = startPage; i <= endPage; i++) { items.push(<PaginationItem key={i}><PaginationLink onClick={() => currentPage === usersCurrentPage ? handleUserPageChange(i) : handleRolePageChange(i)} isActive={currentPage === i}>{i}</PaginationLink></PaginationItem>); }
    if (endPage < totalPages) { if (endPage < totalPages - 1) { items.push(<PaginationItem key="end-ellipsis"><PaginationEllipsis /></PaginationItem>); } items.push(<PaginationItem key="last"><PaginationLink onClick={() => currentPage === usersCurrentPage ? handleUserPageChange(totalPages) : handleRolePageChange(totalPages)}>{totalPages}</PaginationLink></PaginationItem>); }
    return items;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Access & Role Management</h1>
          <p className="text-muted-foreground">Manage all users and their assigned roles in the system.</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
        </Button>
      </div>

      <Tabs defaultValue="users">
        <div className="flex items-center justify-between">
            <TabsList>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="roles">Roles</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
                 {(loggedInUserPermissions?.canManageUsers || loggedInUserPermissions?.hasFullAccess) && (
                    <Button size="sm" onClick={() => openUserModal()}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add User
                    </Button>
                )}
                {(loggedInUserPermissions?.canManageRoles || loggedInUserPermissions?.hasFullAccess) && (
                    <Button size="sm" onClick={() => openRoleModal()}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Role
                    </Button>
                )}
            </div>
        </div>
        <TabsContent value="users">
            <Card>
                <CardContent className="pt-6">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {loadingUsers ? (<TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                    ) : paginatedUsers.length === 0 ? (<TableRow><TableCell colSpan={5} className="h-24 text-center">No users found.</TableCell></TableRow>
                    ) : (
                        paginatedUsers.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell><Badge variant={user.role?.name === 'God Mode' || user.email === 'superadmin@caliloops.com' ? 'destructive' : 'secondary'}>{user.email === 'superadmin@caliloops.com' ? 'Super Admin' : user.role?.name || 'No Role'}</Badge></TableCell>
                            <TableCell>{user.store?.name || 'N/A'}</TableCell>
                            <TableCell>
                            {(loggedInUserPermissions?.canManageUsers || loggedInUserPermissions?.hasFullAccess) && user.email !== 'superadmin@caliloops.com' && (
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onSelect={() => openUserModal(user)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleDeleteUser(user.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            </TableCell>
                        </TableRow>
                        ))
                    )}
                    </TableBody>
                </Table>
                </CardContent>
                <CardFooter className="flex items-center justify-between pt-6">
                    <div className="text-sm text-muted-foreground">Showing <strong>{Math.min((usersCurrentPage - 1) * ROWS_PER_PAGE + 1, users.length)}</strong> to <strong>{Math.min(usersCurrentPage * ROWS_PER_PAGE, users.length)}</strong> of <strong>{users.length}</strong> users</div>
                    {usersTotalPages > 1 && (<Pagination><PaginationContent><PaginationItem><PaginationPrevious onClick={() => handleUserPageChange(usersCurrentPage - 1)} aria-disabled={usersCurrentPage === 1} /></PaginationItem>{getPaginationItems(usersCurrentPage, usersTotalPages)}<PaginationItem><PaginationNext onClick={() => handleUserPageChange(usersCurrentPage + 1)} aria-disabled={usersCurrentPage === usersTotalPages} /></PaginationItem></PaginationContent></Pagination>)}
                </CardFooter>
            </Card>
        </TabsContent>
        <TabsContent value="roles">
             <Card>
                <CardContent className="pt-6">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Role Name</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {loadingRoles ? (<TableRow><TableCell colSpan={3} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                    ) : paginatedRoles.length === 0 ? (<TableRow><TableCell colSpan={3} className="h-24 text-center">No roles found.</TableCell></TableRow>
                    ) : (
                        paginatedRoles.map((role) => (
                        <TableRow key={role.id}>
                            <TableCell className="font-medium">{role.name}</TableCell>
                            <TableCell>{users.filter(u => u.roleId === role.id).length}</TableCell>
                            <TableCell>
                            {(loggedInUserPermissions?.canManageRoles || loggedInUserPermissions?.hasFullAccess) && (
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onSelect={() => openRoleModal(role)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleDeleteRole(role.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            </TableCell>
                        </TableRow>
                        ))
                    )}
                    </TableBody>
                </Table>
                </CardContent>
                 <CardFooter className="flex items-center justify-between pt-6">
                    <div className="text-sm text-muted-foreground">Showing <strong>{Math.min((rolesCurrentPage - 1) * ROWS_PER_PAGE + 1, roles.length)}</strong> to <strong>{Math.min(rolesCurrentPage * ROWS_PER_PAGE, roles.length)}</strong> of <strong>{roles.length}</strong> roles</div>
                    {rolesTotalPages > 1 && (<Pagination><PaginationContent><PaginationItem><PaginationPrevious onClick={() => handleRolePageChange(rolesCurrentPage - 1)} aria-disabled={rolesCurrentPage === 1} /></PaginationItem>{getPaginationItems(rolesCurrentPage, rolesTotalPages)}<PaginationItem><PaginationNext onClick={() => handleRolePageChange(rolesCurrentPage + 1)} aria-disabled={rolesCurrentPage === rolesTotalPages} /></PaginationItem></PaginationContent></Pagination>)}
                </CardFooter>
            </Card>
        </TabsContent>
      </Tabs>
      
      {/* User Management Modal */}
      <Dialog open={isUserModalOpen} onOpenChange={closeUserModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{currentUser?.id ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>{currentUser?.id ? 'Update user details and role.' : 'Create a new user and assign a role.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label htmlFor="name">Name</Label><Input id="name" value={currentUser?.name || ''} onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value })} disabled={isSavingUser}/></div>
            <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={currentUser?.email || ''} onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })} disabled={isSavingUser || !!currentUser?.id}/></div>
            {!currentUser?.id && (<div className="grid gap-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isSavingUser}/></div>)}
            <div className="grid gap-2"><Label htmlFor="role">Role</Label><Select value={currentUser?.roleId || ''} onValueChange={(value) => setCurrentUser({ ...currentUser, roleId: value })} disabled={isSavingUser}><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent>{roles.map(role => (<SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>))}</SelectContent></Select></div>
            <div className="grid gap-2"><Label htmlFor="store">Store</Label><Select value={currentUser?.storeId || 'no-store'} onValueChange={(value) => setCurrentUser({ ...currentUser, storeId: value === 'no-store' ? '' : value })} disabled={isSavingUser}><SelectTrigger><SelectValue placeholder="Select a store (optional)" /></SelectTrigger><SelectContent><SelectItem value="no-store">No Store</SelectItem>{stores.map(store => (<SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>))}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={closeUserModal} disabled={isSavingUser}>Cancel</Button><Button onClick={handleSaveUser} disabled={isSavingUser}>{isSavingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Management Modal */}
      <Dialog open={isRoleModalOpen} onOpenChange={closeRoleModal}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>{currentRole?.id ? 'Edit Role' : 'Add Role'}</DialogTitle>
                <DialogDescription>Define the role name and its permissions within the system.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="role-name">Role Name</Label>
                    <Input id="role-name" value={currentRole?.name || ''} onChange={(e) => setCurrentRole({ ...currentRole, name: e.target.value })} disabled={isSavingRole} />
                </div>
                <Separator />
                <div>
                    <Label>Permissions</Label>
                    <div className="space-y-4 mt-2">
                        {Object.entries(permissionCategories).map(([category, perms]) => (
                            <div key={category}>
                                <h4 className="font-medium text-sm mb-2">{category}</h4>
                                <div className="space-y-2 pl-2">
                                {perms.map((perm) => (
                                    <div key={perm.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={perm.id}
                                            checked={currentRole?.permissions?.[perm.id as keyof Permissions] || false}
                                            onCheckedChange={(checked) => handlePermissionChange(perm.id as keyof Permissions, Boolean(checked))}
                                            disabled={isSavingRole}
                                        />
                                        <Label htmlFor={perm.id} className="font-normal">{perm.label}</Label>
                                    </div>
                                ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={closeRoleModal} disabled={isSavingRole}>Cancel</Button>
                <Button onClick={handleSaveRole} disabled={isSavingRole}>{isSavingRole ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Role'}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    