
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseOrder, Shipping, Supplier } from '@/lib/types';
import { subscribeToPurchaseOrders, getPurchaseOrderWithSupplier } from '@/lib/services/purchaseOrderService';
import { getAllShipping } from '@/lib/services/shippingService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Loader2, FileText, AlertTriangle, Search, ChevronsRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { UserContext } from '@/app/dashboard/layout';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { VariantProps } from 'class-variance-authority';

const ROWS_PER_PAGE = 10;

type PoDetail = {
    poNumber: string;
    orderDate: string;
    orderNumber?: string;
    supplierCode: string;
    supplierName: string;
    supplierDescription?: string;
    trackingNumber: string;
    storageCode?: string;
    containerCode?: string;
    status: string;
    receivedDate?: string;
}


export default function PurchaseOrdersPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, permissions, selectedStoreId } = React.useContext(UserContext);
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Search and Filter State
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  
  // Detail Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [detailData, setDetailData] = React.useState<PoDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = React.useState(false);


  const storeId = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

  React.useEffect(() => {
    if (!storeId) {
      setPurchaseOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsubscribePOs = subscribeToPurchaseOrders(
      storeId,
      (poData) => {
        setPurchaseOrders(poData);
        setLoading(false);
      },
      (error) => {
        toast({ title: 'Error fetching purchase orders', variant: 'destructive' });
        setLoading(false);
      }
    );

    return () => unsubscribePOs();
  }, [toast, storeId]);

  const getStatusVariant = (status?: PurchaseOrder['status']): VariantProps<typeof badgeVariants>['variant'] => {
    switch (status) {
        case 'INPUTTED':
            return 'outline';
        case 'SHIPPING':
            return 'info';
        case 'RECEIVED':
            return 'default';
        case 'DONE':
            return 'success';
        default:
            return 'secondary';
    }
  }

  const filteredPOs = React.useMemo(() => {
    let tempPOs = purchaseOrders;
    if (statusFilter !== 'all') {
      tempPOs = tempPOs.filter(po => po.status === statusFilter);
    }
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      tempPOs = tempPOs.filter(po => 
        po.poNumber.toLowerCase().includes(lowercasedTerm) ||
        po.orderNumber?.toLowerCase().includes(lowercasedTerm) ||
        po.supplierName.toLowerCase().includes(lowercasedTerm) ||
        (Array.isArray(po.trackingNumber) && po.trackingNumber.some(tn => tn.toLowerCase().includes(lowercasedTerm)))
      );
    }
    return tempPOs;
  }, [purchaseOrders, searchTerm, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredPOs.length / ROWS_PER_PAGE);
  const paginatedPOs = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return filteredPOs.slice(startIndex, endIndex);
  }, [filteredPOs, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };
  
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handleShowDetails = async (po: PurchaseOrder) => {
    if (!storeId) return;

    setLoadingDetails(true);
    setIsDetailModalOpen(true);
    setDetailData([]);

    try {
        const fullPo = await getPurchaseOrderWithSupplier(po.id);
        if (!fullPo) {
            toast({ title: 'Error fetching PO details', variant: 'destructive' });
            setIsDetailModalOpen(false);
            setLoadingDetails(false);
            return;
        }

        const allShipping = await getAllShipping(storeId);
        
        const details: PoDetail[] = [];
        
        if (Array.isArray(fullPo.trackingNumber) && fullPo.trackingNumber.length > 0) {
            for (const tn of fullPo.trackingNumber) {
                const shippingRecord = allShipping.find(s => s.noResi.includes(tn));
                
                details.push({
                    poNumber: fullPo.poNumber,
                    orderDate: format(fullPo.orderDate.toDate(), 'dd MMM yyyy'),
                    orderNumber: fullPo.orderNumber,
                    supplierCode: fullPo.supplier?.supplierCode || 'N/A',
                    supplierName: fullPo.supplier?.name || fullPo.supplierName,
                    supplierDescription: fullPo.supplier?.description,
                    trackingNumber: tn,
                    storageCode: shippingRecord?.kodeStorage,
                    containerCode: shippingRecord?.kodeKontainer,
                    status: shippingRecord ? 'SHIPPING' : fullPo.status, // Or more complex logic
                    receivedDate: shippingRecord ? format(shippingRecord.tanggalStokDiterima.toDate(), 'dd MMM yyyy') : undefined,
                });
            }
        } else {
            // Case for POs with no tracking numbers yet
            details.push({
                poNumber: fullPo.poNumber,
                orderDate: format(fullPo.orderDate.toDate(), 'dd MMM yyyy'),
                orderNumber: fullPo.orderNumber,
                supplierCode: fullPo.supplier?.supplierCode || 'N/A',
                supplierName: fullPo.supplier?.name || fullPo.supplierName,
                supplierDescription: fullPo.supplier?.description,
                trackingNumber: 'N/A',
                status: fullPo.status,
            });
        }
        
        setDetailData(details);

    } catch (error) {
        toast({ title: "Failed to load details", variant: "destructive" });
        console.error(error);
    } finally {
        setLoadingDetails(false);
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
            <FileText /> Purchase Order Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage your company's purchase orders for the selected store.
          </p>
        </div>
        {(permissions?.canManagePurchaseOrders || permissions?.hasFullAccess) && (
            <Button disabled={!canPerformActions} onClick={() => router.push('/dashboard/purchase-orders/new')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New PO
            </Button>
        )}
      </div>

       {!storeId && (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Store Selected</AlertTitle>
                <AlertDescription>
                    Please select a store from the header dropdown to view and manage purchase orders.
                </AlertDescription>
            </Alert>
       )}

      <Card>
        <CardHeader>
            <div className='flex flex-col md:flex-row gap-4 md:items-center md:justify-between'>
              <CardTitle>All Purchase Orders</CardTitle>
              <div className='flex gap-2'>
                  <div className="relative">
                      <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                          type="search"
                          placeholder="Search by PO, Order No, Supplier..."
                          className="w-full pl-8 sm:w-[300px]"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
                   <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="INPUTTED">Inputted</SelectItem>
                          <SelectItem value="SHIPPING">Shipping</SelectItem>
                          <SelectItem value="RECEIVED">Received</SelectItem>
                          <SelectItem value="DONE">Done</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Order No.</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Total Pcs</TableHead>
                    <TableHead>Total RMB</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {loading ? (
                    <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                    </TableRow>
                ) : paginatedPOs.length === 0 ? (
                    <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                        No purchase orders found. Add a new PO to get started.
                    </TableCell>
                    </TableRow>
                ) : (
                    paginatedPOs.map((po) => (
                    <TableRow key={po.id}>
                        <TableCell className="font-medium">{po.poNumber}</TableCell>
                        <TableCell>{format(po.orderDate.toDate(), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{po.orderNumber}</TableCell>
                        <TableCell>{po.supplierName}</TableCell>
                        <TableCell>{po.totalPcs}</TableCell>
                        <TableCell>{po.totalRmb.toLocaleString('en-US', { style: 'currency', currency: 'CNY' })}</TableCell>
                        <TableCell>
                            <Badge variant={getStatusVariant(po.status)}>{po.status}</Badge>
                        </TableCell>
                        <TableCell>
                        {format(po.updatedAt.toDate(), 'dd MMM yyyy, HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/purchase-orders/${po.id}`)}>Edit</Button>
                                <Button variant="secondary" size="sm" onClick={() => handleShowDetails(po)}>
                                    Details <ChevronsRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </TableCell>
                    </TableRow>
                    ))
                )}
                </TableBody>
            </Table>
          </div>
        </CardContent>
         <CardFooter className="flex items-center justify-between pt-6">
            <div className="text-sm text-muted-foreground">
                Showing{' '}
                <strong>
                    {Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filteredPOs.length)}
                </strong>{' '}
                to <strong>{Math.min(currentPage * ROWS_PER_PAGE, filteredPOs.length)}</strong> of{' '}
                <strong>{filteredPOs.length}</strong> purchase orders
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

      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>
              Detailed tracking information for each shipment within a PO.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            {loadingDetails ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-10 w-10 animate-spin" />
                </div>
            ) : detailData.length === 0 ? (
                 <div className="flex justify-center items-center h-48">
                    <p>No details to show.</p>
                </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO No</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Order No</TableHead>
                    <TableHead>Supplier Code</TableHead>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>Supplier Desc</TableHead>
                    <TableHead>No Resi</TableHead>
                    <TableHead>No Storage</TableHead>
                    <TableHead>Kode Kontainer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Received Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.map((item, index) => (
                    <TableRow key={`${item.poNumber}-${item.trackingNumber}-${index}`}>
                      <TableCell>{item.poNumber}</TableCell>
                      <TableCell>{item.orderDate}</TableCell>
                      <TableCell>{item.orderNumber}</TableCell>
                      <TableCell>{item.supplierCode}</TableCell>
                      <TableCell>{item.supplierName}</TableCell>
                      <TableCell className='max-w-xs truncate'>{item.supplierDescription}</TableCell>
                      <TableCell>{item.trackingNumber}</TableCell>
                      <TableCell>{item.storageCode}</TableCell>
                      <TableCell>{item.containerCode}</TableCell>
                      <TableCell><Badge>{item.status}</Badge></TableCell>
                      <TableCell>{item.receivedDate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
