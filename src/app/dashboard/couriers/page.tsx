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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { Courier } from '@/lib/types';
import { subscribeToCouriers, addCourier, updateCourier, deleteCourier } from '@/lib/services/courierService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PlusCircle, Loader2, Bike, AlertTriangle, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { UserContext } from '@/app/dashboard/layout';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';

const ROWS_PER_PAGE = 10;

export default function CouriersPage() {
  const { toast } = useToast();
  const { user, permissions, selectedStoreId } = React.useContext(UserContext);
  const [couriers, setCouriers] = React.useState<Courier[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [currentCourier, setCurrentCourier] = React.useState<Partial<Courier> | null>(null);

  // Delete Confirmation State
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [courierToDelete, setCourierToDelete] = React.useState<Courier | null>(null);


  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);

  const storeId = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

  React.useEffect(() => {
    if (!storeId) {
      setCouriers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToCouriers(
      storeId,
      (courierData) => {
        setCouriers(courierData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching couriers:", error);
        toast({
          title: 'Error fetching couriers',
          description: error.message,
          variant: 'destructive',
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [toast, storeId]);

  const openModal = (courier: Partial<Courier> | null = null) => {
    setCurrentCourier(courier || {});
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setCurrentCourier(null);
    setIsModalOpen(false);
  };

  const handleSaveCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions?.canManageCouriers && !permissions?.hasFullAccess) {
      toast({ title: 'Permission Denied', variant: 'destructive' });
      return;
    }
    if (!currentCourier || !currentCourier.name || !currentCourier.courierCode) {
      toast({ title: 'Courier Name and Code are required.', variant: 'destructive' });
      return;
    }
    if (!storeId) {
        toast({ title: 'No store selected', description: 'Please select a store to add a courier to.', variant: 'destructive' });
        return;
    }

    setIsSaving(true);
    try {
        const dataToSave: Partial<Omit<Courier, 'id' | 'createdAt'>> = {
            name: currentCourier.name,
            courierCode: currentCourier.courierCode,
            warehouseAddress: currentCourier.warehouseAddress || '',
            marking: currentCourier.marking || '',
            contactPerson: currentCourier.contactPerson || '',
            storeId,
        };

        if (currentCourier.id) {
            await updateCourier(currentCourier.id, dataToSave);
            toast({ title: 'Courier updated successfully!' });
        } else {
            await addCourier(dataToSave as Omit<Courier, 'id' | 'createdAt'>);
            toast({ title: 'Courier created successfully!' });
        }
        closeModal();
    } catch (error) {
      console.error(error);
      toast({ title: `Error ${currentCourier.id ? 'updating' : 'creating'} courier`, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteDialog = (courier: Courier) => {
    setCourierToDelete(courier);
    setIsDeleteAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!courierToDelete) return;
    try {
      await deleteCourier(courierToDelete.id);
      toast({ title: 'Courier deleted successfully' });
      setIsDeleteAlertOpen(false);
      setCourierToDelete(null);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error deleting courier', variant: 'destructive' });
    }
  };


  // Pagination Logic
  const totalPages = Math.ceil(couriers.length / ROWS_PER_PAGE);
  const paginatedCouriers = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return couriers.slice(startIndex, endIndex);
  }, [couriers, currentPage]);

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
            <Bike /> Courier Management
          </h1>
          <p className="text-muted-foreground">
            Manage your company's couriers for the selected store.
          </p>
        </div>
        {(permissions?.canManageCouriers || permissions?.hasFullAccess) && (
            <Button disabled={!canPerformActions} onClick={() => openModal()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Courier
            </Button>
        )}
      </div>

       {!storeId && (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Store Selected</AlertTitle>
                <AlertDescription>
                    Please select a store from the header dropdown to view and manage couriers.
                </AlertDescription>
            </Alert>
       )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Courier Name</TableHead>
                <TableHead>Courier Code</TableHead>
                <TableHead>Warehouse Address</TableHead>
                <TableHead>Marking</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : paginatedCouriers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No couriers found. Add a new courier to get started.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCouriers.map((courier) => (
                  <TableRow key={courier.id}>
                    <TableCell className="font-medium">{courier.name}</TableCell>
                    <TableCell>{courier.courierCode}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{courier.warehouseAddress}</TableCell>
                    <TableCell className="text-muted-foreground">{courier.marking}</TableCell>
                    <TableCell className="text-muted-foreground">{courier.contactPerson}</TableCell>
                    <TableCell>
                      {courier.createdAt?.toDate().toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                        {(permissions?.canManageCouriers || permissions?.hasFullAccess) && (
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openModal(courier)}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => openDeleteDialog(courier)}
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
                    {Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, couriers.length)}
                </strong>{' '}
                to <strong>{Math.min(currentPage * ROWS_PER_PAGE, couriers.length)}</strong> of{' '}
                <strong>{couriers.length}</strong> couriers
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
        <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleSaveCourier}>
            <DialogHeader>
                <DialogTitle>{currentCourier?.id ? 'Edit' : 'Add New'} Courier</DialogTitle>
                <DialogDescription>
                {currentCourier?.id ? 'Update the details for this courier.' : 'Create a new courier for your currently selected store.'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                    <Label htmlFor="courier-name">Courier Name</Label>
                    <Input
                        id="courier-name"
                        value={currentCourier?.name || ''}
                        onChange={(e) => setCurrentCourier(prev => ({...prev, name: e.target.value}))}
                        placeholder="e.g., JNE Express"
                        disabled={isSaving}
                        required
                    />
                    </div>
                    <div className="grid gap-2">
                    <Label htmlFor="courier-code">Courier Code</Label>
                    <Input
                        id="courier-code"
                        value={currentCourier?.courierCode || ''}
                        onChange={(e) => setCurrentCourier(prev => ({...prev, courierCode: e.target.value}))}
                        placeholder="e.g., JNE"
                        disabled={isSaving}
                        required
                    />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="warehouse-address">Warehouse Address</Label>
                    <Textarea
                        id="warehouse-address"
                        value={currentCourier?.warehouseAddress || ''}
                        onChange={(e) => setCurrentCourier(prev => ({...prev, warehouseAddress: e.target.value}))}
                        placeholder="e.g., Jl. Tomang Raya No. 11"
                        disabled={isSaving}
                    />
                </div>
                    <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                    <Label htmlFor="marking">Marking</Label>
                    <Input
                        id="marking"
                        value={currentCourier?.marking || ''}
                        onChange={(e) => setCurrentCourier(prev => ({...prev, marking: e.target.value}))}
                        placeholder="e.g., TGR"
                        disabled={isSaving}
                    />
                    </div>
                    <div className="grid gap-2">
                    <Label htmlFor="contact-person">Contact Person</Label>
                    <Input
                        id="contact-person"
                        value={currentCourier?.contactPerson || ''}
                        onChange={(e) => setCurrentCourier(prev => ({...prev, contactPerson: e.target.value}))}
                        placeholder="e.g., Budi (0812...)"
                        disabled={isSaving}
                    />
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" type="button" onClick={closeModal} disabled={isSaving}>
                Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Courier
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
                      This action cannot be undone. This will permanently delete the courier "{courierToDelete?.name}".
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
