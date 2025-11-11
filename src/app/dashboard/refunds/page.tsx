
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
import type { Refund, PurchaseOrder } from '@/lib/types';
import { subscribeToRefunds, addRefund, updateRefund } from '@/lib/services/refundService';
import { subscribeToPurchaseOrders } from '@/lib/services/purchaseOrderService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PlusCircle, Loader2, DollarSign, AlertTriangle, Search, Edit } from 'lucide-react';
import { UserContext } from '@/app/dashboard/layout';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

const ROWS_PER_PAGE = 10;

export default function RefundsPage() {
  const { toast } = useToast();
  const { user, permissions, selectedStoreId } = React.useContext(UserContext);
  
  const [refunds, setRefunds] = React.useState<Refund[]>([]);
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([]);
  
  const [loading, setLoading] = React.useState(true);

  // Search and Filter State
  const [searchTerm, setSearchTerm] = React.useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [currentRefund, setCurrentRefund] = React.useState<Partial<Refund> | null>(null);
  const [selectedPoDetails, setSelectedPoDetails] = React.useState<PurchaseOrder | null>(null);


  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);

  const storeId = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

  React.useEffect(() => {
    if (!storeId) {
      setRefunds([]);
      setPurchaseOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsubscribeRefunds = subscribeToRefunds(storeId, setRefunds, (error) => {
        toast({ title: 'Error fetching refunds', variant: 'destructive' });
    });

    const unsubscribePOs = subscribeToPurchaseOrders(storeId, setPurchaseOrders, (error) => {
        toast({ title: 'Error fetching purchase orders', variant: 'destructive' });
    });

    Promise.all([new Promise(res => setTimeout(res, 500))]).then(() => setLoading(false));

    return () => {
        unsubscribeRefunds();
        unsubscribePOs();
    };
  }, [toast, storeId]);

  const openModal = (refund: Partial<Refund> | null = null) => {
    if (refund) {
        setCurrentRefund(refund);
        const po = purchaseOrders.find(p => p.id === refund.poId);
        setSelectedPoDetails(po || null);
    } else {
        setCurrentRefund({
            refundAmount: 0,
            isSupplierApproved: false,
            isDeducted: false,
            notes: ''
        });
        setSelectedPoDetails(null);
    }
    setIsModalOpen(true);
  };
  
  const resetModal = () => {
    setCurrentRefund(null);
    setSelectedPoDetails(null);
    setIsModalOpen(false);
  };

  const handleSaveRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions?.canManageRefunds && !permissions?.hasFullAccess) {
      toast({ title: 'Permission Denied', variant: 'destructive' });
      return;
    }
    if (!storeId || !currentRefund) {
        toast({ title: 'An unexpected error occurred.', variant: 'destructive' });
        return;
    }
    if (!currentRefund.poId) {
      toast({ title: 'Purchase Order is required.', variant: 'destructive' });
      return;
    }
    // Only require refund amount if it's a new entry
    if (!currentRefund.id && (currentRefund.refundAmount === undefined || currentRefund.refundAmount <= 0)) {
        toast({ title: 'Refund Amount must be greater than 0.', variant: 'destructive' });
        return;
    }

    setIsSaving(true);
    try {
        const selectedPO = purchaseOrders.find(po => po.id === currentRefund.poId);
        if (!selectedPO) {
            toast({ title: 'Selected PO not found.', variant: 'destructive' });
            setIsSaving(false);
            return;
        }

        if (currentRefund.id) {
            // Update existing refund
            const { id, createdAt, poNumber, orderDate, orderNumber, supplierId, supplierName, supplierCode, chatSearch, ...updateData } = currentRefund as any;
            await updateRefund(id, {
                ...updateData,
                storeId,
            });
            toast({ title: 'Refund updated successfully!' });
        } else {
            // Add new refund
            const refundData: Omit<Refund, 'id' | 'createdAt' | 'updatedAt'> = {
                storeId,
                poId: selectedPO.id,
                poNumber: selectedPO.poNumber,
                orderDate: selectedPO.orderDate,
                orderNumber: selectedPO.orderNumber,
                supplierId: selectedPO.supplierId,
                supplierName: selectedPO.supplierName,
                supplierCode: selectedPO.supplierCode,
                chatSearch: selectedPO.chatSearch,
                refundAmount: currentRefund.refundAmount || 0,
                isSupplierApproved: currentRefund.isSupplierApproved || false,
                isDeducted: currentRefund.isDeducted || false,
                deductedDate: currentRefund.deductedDate,
                notes: currentRefund.notes || '',
            };
            await addRefund(refundData);
            toast({ title: 'Refund created successfully!' });
        }
        resetModal();
    } catch (error) {
      toast({ title: `Error ${currentRefund.id ? 'updating' : 'creating'} refund`, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePoChange = (poId: string) => {
    const selectedPO = purchaseOrders.find(po => po.id === poId);
    if (selectedPO) {
        setSelectedPoDetails(selectedPO);
      setCurrentRefund(prev => ({
        ...prev,
        poId: selectedPO.id
      }));
    } else {
        setSelectedPoDetails(null);
    }
  };

  const filteredRefunds = React.useMemo(() => {
    return searchTerm
      ? refunds.filter(r => r.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) || r.supplierName.toLowerCase().includes(searchTerm.toLowerCase()))
      : refunds;
  }, [refunds, searchTerm]);

  const totalPages = Math.ceil(filteredRefunds.length / ROWS_PER_PAGE);
  const paginatedRefunds = React.useMemo(() => {
    return filteredRefunds.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  }, [filteredRefunds, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const canPerformActions = user?.email === 'superadmin@caliloops.com' ? !!selectedStoreId : !!user?.storeId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign /> Refund Management
          </h1>
          <p className="text-muted-foreground">
            Track and manage all purchase order refunds for your store.
          </p>
        </div>
        {(permissions?.canManageRefunds || permissions?.hasFullAccess) && (
            <Button disabled={!canPerformActions} onClick={() => openModal()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Refund
            </Button>
        )}
      </div>

       {!storeId && (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Store Selected</AlertTitle>
                <AlertDescription>
                    Please select a store from the header dropdown to manage refunds.
                </AlertDescription>
            </Alert>
       )}

      <Card>
        <CardHeader>
            <div className='flex flex-col md:flex-row gap-4 md:items-center md:justify-between'>
              <CardTitle>All Refunds</CardTitle>
              <div className="relative">
                  <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                      type="search"
                      placeholder="Search by PO number or Supplier..."
                      className="w-full pl-8 sm:w-[300px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Refund Amount (RMB)</TableHead>
                <TableHead>Supplier OK?</TableHead>
                <TableHead>Deducted?</TableHead>
                <TableHead>Deducted Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : paginatedRefunds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No refunds found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRefunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell className="font-medium">{refund.poNumber}</TableCell>
                    <TableCell>{format(refund.orderDate.toDate(), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{refund.supplierName}</TableCell>
                    <TableCell>{refund.refundAmount.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</TableCell>
                    <TableCell>{refund.isSupplierApproved ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{refund.isDeducted ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{refund.deductedDate ? format(refund.deductedDate.toDate(), 'dd MMM yyyy') : 'N/A'}</TableCell>
                    <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openModal(refund)}>
                            <Edit className='mr-2 h-4 w-4' /> Edit
                        </Button>
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
                    {Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filteredRefunds.length)}
                </strong>{' '}
                to <strong>{Math.min(currentPage * ROWS_PER_PAGE, filteredRefunds.length)}</strong> of{' '}
                <strong>{filteredRefunds.length}</strong> refunds
            </div>
            {totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem><PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} /></PaginationItem>
                        <PaginationItem>...</PaginationItem>
                        <PaginationItem><PaginationNext onClick={() => handlePageChange(currentPage + 1)} /></PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </CardFooter>
      </Card>

      {/* Add/Edit Refund Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleSaveRefund}>
                <DialogHeader>
                    <DialogTitle>{currentRefund?.id ? 'Edit' : 'Add'} Refund</DialogTitle>
                    <DialogDescription>
                        {currentRefund?.id ? 'Update the details for this refund.' : 'Create a new refund entry by linking it to a Purchase Order.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-6">
                    <div className="grid gap-2">
                        <Label htmlFor="poNumber">Purchase Order</Label>
                        <Select onValueChange={handlePoChange} value={currentRefund?.poId} disabled={!!currentRefund?.id}>
                            <SelectTrigger id="poNumber">
                                <SelectValue placeholder="Select a Purchase Order" />
                            </SelectTrigger>
                            <SelectContent>
                                {purchaseOrders.map(po => (
                                    <SelectItem key={po.id} value={po.id}>{po.poNumber} - {po.supplierName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     {selectedPoDetails && (
                        <Card className="bg-muted/50 text-sm">
                            <CardContent className="pt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                                <div className="font-medium">PO Number: <span className="font-normal text-muted-foreground">{selectedPoDetails.poNumber}</span></div>
                                <div className="font-medium">Order Date: <span className="font-normal text-muted-foreground">{format(selectedPoDetails.orderDate.toDate(), 'PPP')}</span></div>
                                <div className="font-medium">Order No.: <span className="font-normal text-muted-foreground">{selectedPoDetails.orderNumber || 'N/A'}</span></div>
                                <div className="font-medium">Supplier: <span className="font-normal text-muted-foreground">{selectedPoDetails.supplierName} ({selectedPoDetails.supplierCode})</span></div>
                                <div className="col-span-2 font-medium">Chat Search: <span className="font-normal text-muted-foreground">{selectedPoDetails.chatSearch || 'N/A'}</span></div>
                            </CardContent>
                        </Card>
                     )}
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="refundAmount">Refund Amount (RMB)</Label>
                            <Input id="refundAmount" type="number" value={currentRefund?.refundAmount || ''} onChange={(e) => setCurrentRefund(p => ({...p, refundAmount: parseFloat(e.target.value) || 0}))} disabled={isSaving} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="deductedDate">Deducted Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant={'outline'} className={cn('justify-start text-left font-normal', !currentRefund?.deductedDate && 'text-muted-foreground')}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {currentRefund?.deductedDate ? format(currentRefund.deductedDate.toDate(), 'PPP') : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={currentRefund?.deductedDate?.toDate()} onSelect={(date) => setCurrentRefund(p => ({...p, deductedDate: date ? Timestamp.fromDate(date) : undefined}))} /></PopoverContent>
                            </Popover>
                        </div>
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" value={currentRefund?.notes || ''} onChange={(e) => setCurrentRefund(p => ({...p, notes: e.target.value}))} disabled={isSaving} />
                     </div>
                     <div className="flex items-center space-x-2">
                        <Checkbox id="isSupplierApproved" checked={currentRefund?.isSupplierApproved} onCheckedChange={(checked) => setCurrentRefund(p => ({...p, isSupplierApproved: Boolean(checked)}))} />
                        <Label htmlFor="isSupplierApproved">Supplier Approved?</Label>
                     </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="isDeducted" checked={currentRefund?.isDeducted} onCheckedChange={(checked) => setCurrentRefund(p => ({...p, isDeducted: Boolean(checked)}))} />
                        <Label htmlFor="isDeducted">Deducted from Supplier?</Label>
                     </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={resetModal} disabled={isSaving}>Cancel</Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Refund
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
