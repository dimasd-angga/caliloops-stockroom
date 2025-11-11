
'use client';

import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/lib/types';
import { subscribeToSuppliers, addSupplier, updateSupplier, deleteSupplier } from '@/lib/services/supplierService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
import { PlusCircle, Loader2, Truck, AlertTriangle, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { UserContext } from '@/app/dashboard/layout';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


const ROWS_PER_PAGE = 10;

export default function SuppliersPage() {
  const { toast } = useToast();
  const { user, permissions, selectedStoreId } = React.useContext(UserContext);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [currentSupplier, setCurrentSupplier] = React.useState<Partial<Supplier> | null>(null);

  // Delete Confirmation State
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [supplierToDelete, setSupplierToDelete] = React.useState<Supplier | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);

  const storeId = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

  React.useEffect(() => {
    if (!storeId) {
      setSuppliers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToSuppliers(
      storeId,
      (supplierData) => {
        setSuppliers(supplierData);
        setLoading(false);
      },
      (error) => {
        toast({
          title: 'Error fetching suppliers',
          description: error.message,
          variant: 'destructive',
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [toast, storeId]);

  const openModal = (supplier: Partial<Supplier> | null = null) => {
    setCurrentSupplier(supplier || {});
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setCurrentSupplier(null);
    setIsModalOpen(false);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions?.canManageSuppliers && !permissions?.hasFullAccess) {
      toast({ title: 'Permission Denied', variant: 'destructive' });
      return;
    }
    if (!currentSupplier || !currentSupplier.name || !currentSupplier.supplierCode) {
      toast({ title: 'Supplier Name and Code are required.', variant: 'destructive' });
      return;
    }
    if (!storeId) {
        toast({ title: 'No store selected', description: 'Please select a store to add a supplier to.', variant: 'destructive' });
        return;
    }

    setIsSaving(true);
    try {
        if(currentSupplier.id) {
            await updateSupplier(currentSupplier.id, {
                name: currentSupplier.name,
                supplierCode: currentSupplier.supplierCode,
                description: currentSupplier.description,
                chatSearchName: currentSupplier.chatSearchName
            });
            toast({ title: 'Supplier updated successfully!' });
        } else {
            await addSupplier({ 
                name: currentSupplier.name, 
                supplierCode: currentSupplier.supplierCode,
                description: currentSupplier.description,
                chatSearchName: currentSupplier.chatSearchName,
                storeId 
              });
              toast({ title: 'Supplier created successfully!' });
        }
      closeModal();
    } catch (error) {
      toast({ title: `Error ${currentSupplier.id ? 'updating' : 'creating'} supplier`, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteDialog = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setIsDeleteAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await deleteSupplier(supplierToDelete.id);
      toast({ title: 'Supplier deleted successfully' });
      setIsDeleteAlertOpen(false);
      setSupplierToDelete(null);
    } catch (error) {
      toast({ title: 'Error deleting supplier', variant: 'destructive' });
    }
  };

  // Pagination Logic
  const totalPages = Math.ceil(suppliers.length / ROWS_PER_PAGE);
  const paginatedSuppliers = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return suppliers.slice(startIndex, endIndex);
  }, [suppliers, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPaginationItems = () => {
    const items = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (totalPages > maxPagesToShow && endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
        items.push(<PaginationItem key="first"><PaginationLink onClick={() => handlePageChange(1)}>1</PaginationLink></PaginationItem>);
        if (startPage > 2) {
            items.push(<PaginationItem key="start-ellipsis"><PaginationEllipsis /></PaginationItem>);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        items.push(
            <PaginationItem key={i}>
                <PaginationLink onClick={() => handlePageChange(i)} isActive={currentPage === i}>{i}</PaginationLink>
            </PaginationItem>
        );
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            items.push(<PaginationItem key="end-ellipsis"><PaginationEllipsis /></PaginationItem>);
        }
        items.push(<PaginationItem key="last"><PaginationLink onClick={() => handlePageChange(totalPages)}>{totalPages}</PaginationLink></PaginationItem>);
    }
    return items;
  };
  
  const canPerformActions = user?.email === 'superadmin@caliloops.com' ? !!selectedStoreId : !!user?.storeId;


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck /> Supplier Management
          </h1>
          <p className="text-muted-foreground">
            Manage your company's suppliers for the selected store.
          </p>
        </div>
        {(permissions?.canManageSuppliers || permissions?.hasFullAccess) && (
             <Button disabled={!canPerformActions} onClick={() => openModal()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Supplier
            </Button>
        )}
      </div>

       {!storeId && (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Store Selected</AlertTitle>
                <AlertDescription>
                    Please select a store from the header dropdown to view and manage suppliers.
                </AlertDescription>
            </Alert>
       )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier Name</TableHead>
                <TableHead>Supplier Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Chat Search Name</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : paginatedSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No suppliers found. Add a new supplier to get started.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.supplierCode}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{supplier.description}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.chatSearchName}</TableCell>
                    <TableCell>
                      {supplier.createdAt?.toDate().toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                        {(permissions?.canManageSuppliers || permissions?.hasFullAccess) && (
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openModal(supplier)}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => openDeleteDialog(supplier)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
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
            <div className="text-sm text-muted-foreground">
                Showing{' '}
                <strong>
                    {Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, suppliers.length)}
                </strong>{' '}
                to <strong>{Math.min(currentPage * ROWS_PER_PAGE, suppliers.length)}</strong> of{' '}
                <strong>{suppliers.length}</strong> suppliers
            </div>
            {totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} aria-disabled={currentPage === 1} />
                        </PaginationItem>
                        {getPaginationItems()}
                        <PaginationItem>
                            <PaginationNext onClick={() => handlePageChange(currentPage + 1)} aria-disabled={currentPage === totalPages} />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </CardFooter>
      </Card>
      
      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
            <form onSubmit={handleSaveSupplier}>
            <DialogHeader>
                <DialogTitle>{currentSupplier?.id ? 'Edit' : 'Add New'} Supplier</DialogTitle>
                <DialogDescription>
                {currentSupplier?.id ? 'Update the details for this supplier.' : 'Create a new supplier for your currently selected store.'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                    <Label htmlFor="supplier-name">Supplier Name</Label>
                    <Input
                        id="supplier-name"
                        value={currentSupplier?.name || ''}
                        onChange={(e) => setCurrentSupplier(prev => ({...prev, name: e.target.value}))}
                        placeholder="e.g., Global Tech"
                        disabled={isSaving}
                        required
                    />
                    </div>
                    <div className="grid gap-2">
                    <Label htmlFor="supplier-code">Supplier Code</Label>
                    <Input
                        id="supplier-code"
                        value={currentSupplier?.supplierCode || ''}
                        onChange={(e) => setCurrentSupplier(prev => ({...prev, supplierCode: e.target.value}))}
                        placeholder="e.g., SUP-001"
                        disabled={isSaving}
                        required
                    />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                        id="description"
                        value={currentSupplier?.description || ''}
                        onChange={(e) => setCurrentSupplier(prev => ({...prev, description: e.target.value}))}
                        placeholder="e.g., Imports high-quality electronics"
                        disabled={isSaving}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="chat-search">Chat Search Name (Optional)</Label>
                    <Input
                        id="chat-search"
                        value={currentSupplier?.chatSearchName || ''}
                        onChange={(e) => setCurrentSupplier(prev => ({...prev, chatSearchName: e.target.value}))}
                        placeholder="e.g., globaltech_official"
                        disabled={isSaving}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" type="button" onClick={closeModal} disabled={isSaving}>
                Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Supplier
                </Button>
            </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the supplier "{supplierToDelete?.name}".
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDelete} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>Delete</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
