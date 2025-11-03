
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
import type { Courier } from '@/lib/types';
import { subscribeToCouriers, addCourier } from '@/lib/services/courierService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PlusCircle, Loader2, Bike, AlertTriangle } from 'lucide-react';
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
  const [newCourierName, setNewCourierName] = React.useState('');
  const [newCourierCode, setNewCourierCode] = React.useState('');
  const [newWarehouseAddress, setNewWarehouseAddress] = React.useState('');
  const [newMarking, setNewMarking] = React.useState('');
  const [newContactPerson, setNewContactPerson] = React.useState('');


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

  const resetModal = () => {
    setNewCourierName('');
    setNewCourierCode('');
    setNewWarehouseAddress('');
    setNewMarking('');
    setNewContactPerson('');
    setIsModalOpen(false);
  };

  const handleSaveCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions?.canManageCouriers && !permissions?.hasFullAccess) {
      toast({ title: 'Permission Denied', variant: 'destructive' });
      return;
    }
    if (!newCourierName || !newCourierCode) {
      toast({ title: 'Courier Name and Code are required.', variant: 'destructive' });
      return;
    }
    if (!storeId) {
        toast({ title: 'No store selected', description: 'Please select a store to add a courier to.', variant: 'destructive' });
        return;
    }

    setIsSaving(true);
    try {
      await addCourier({ 
        name: newCourierName, 
        courierCode: newCourierCode,
        warehouseAddress: newWarehouseAddress,
        marking: newMarking,
        contactPerson: newContactPerson,
        storeId 
      });
      toast({ title: 'Courier created successfully!' });
      resetModal();
    } catch (error) {
      toast({ title: 'Error creating courier', variant: 'destructive' });
    } finally {
      setIsSaving(false);
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
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
                <Button disabled={!canPerformActions}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Courier
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={handleSaveCourier}>
                <DialogHeader>
                    <DialogTitle>Add New Courier</DialogTitle>
                    <DialogDescription>
                    Create a new courier for your currently selected store.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="courier-name">Courier Name</Label>
                        <Input
                            id="courier-name"
                            value={newCourierName}
                            onChange={(e) => setNewCourierName(e.target.value)}
                            placeholder="e.g., JNE Express"
                            disabled={isSaving}
                            required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="courier-code">Courier Code</Label>
                        <Input
                            id="courier-code"
                            value={newCourierCode}
                            onChange={(e) => setNewCourierCode(e.target.value)}
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
                          value={newWarehouseAddress}
                          onChange={(e) => setNewWarehouseAddress(e.target.value)}
                          placeholder="e.g., Jl. Tomang Raya No. 11"
                          disabled={isSaving}
                      />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                        <Label htmlFor="marking">Marking</Label>
                        <Input
                            id="marking"
                            value={newMarking}
                            onChange={(e) => setNewMarking(e.target.value)}
                            placeholder="e.g., TGR"
                            disabled={isSaving}
                        />
                        </div>
                        <div className="grid gap-2">
                        <Label htmlFor="contact-person">Contact Person</Label>
                        <Input
                            id="contact-person"
                            value={newContactPerson}
                            onChange={(e) => setNewContactPerson(e.target.value)}
                            placeholder="e.g., Budi (0812...)"
                            disabled={isSaving}
                        />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" type="button" onClick={resetModal} disabled={isSaving}>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : paginatedCouriers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
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
    </div>
  );
}
