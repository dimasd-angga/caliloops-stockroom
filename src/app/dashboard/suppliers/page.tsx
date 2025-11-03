
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
import { subscribeToSuppliers, addSupplier } from '@/lib/services/supplierService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PlusCircle, Loader2, Truck, AlertTriangle } from 'lucide-react';
import { UserContext } from '@/app/dashboard/layout';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';

const ROWS_PER_PAGE = 10;

export default function SuppliersPage() {
  const { toast } = useToast();
  const { user, permissions, selectedStoreId } = React.useContext(UserContext);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [newSupplierName, setNewSupplierName] = React.useState('');
  const [newSupplierCode, setNewSupplierCode] = React.useState('');
  const [newDescription, setNewDescription] = React.useState('');
  const [newChatSearchName, setNewChatSearchName] = React.useState('');


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

  const resetModal = () => {
    setNewSupplierName('');
    setNewSupplierCode('');
    setNewDescription('');
    setNewChatSearchName('');
    setIsModalOpen(false);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions?.canManageSuppliers && !permissions?.hasFullAccess) {
      toast({ title: 'Permission Denied', variant: 'destructive' });
      return;
    }
    if (!newSupplierName || !newSupplierCode) {
      toast({ title: 'Supplier Name and Code are required.', variant: 'destructive' });
      return;
    }
    if (!storeId) {
        toast({ title: 'No store selected', description: 'Please select a store to add a supplier to.', variant: 'destructive' });
        return;
    }

    setIsSaving(true);
    try {
      await addSupplier({ 
        name: newSupplierName, 
        supplierCode: newSupplierCode,
        description: newDescription,
        chatSearchName: newChatSearchName,
        storeId 
      });
      toast({ title: 'Supplier created successfully!' });
      resetModal();
    } catch (error) {
      toast({ title: 'Error creating supplier', variant: 'destructive' });
    } finally {
      setIsSaving(false);
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
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
                <Button disabled={!canPerformActions}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Supplier
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={handleSaveSupplier}>
                <DialogHeader>
                    <DialogTitle>Add New Supplier</DialogTitle>
                    <DialogDescription>
                    Create a new supplier for your currently selected store.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="supplier-name">Supplier Name</Label>
                        <Input
                            id="supplier-name"
                            value={newSupplierName}
                            onChange={(e) => setNewSupplierName(e.target.value)}
                            placeholder="e.g., Global Tech"
                            disabled={isSaving}
                            required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="supplier-code">Supplier Code</Label>
                        <Input
                            id="supplier-code"
                            value={newSupplierCode}
                            onChange={(e) => setNewSupplierCode(e.target.value)}
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
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          placeholder="e.g., Imports high-quality electronics"
                          disabled={isSaving}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="chat-search">Chat Search Name (Optional)</Label>
                      <Input
                          id="chat-search"
                          value={newChatSearchName}
                          onChange={(e) => setNewChatSearchName(e.target.value)}
                          placeholder="e.g., globaltech_official"
                          disabled={isSaving}
                      />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" type="button" onClick={resetModal} disabled={isSaving}>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : paginatedSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
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
    </div>
  );
}
