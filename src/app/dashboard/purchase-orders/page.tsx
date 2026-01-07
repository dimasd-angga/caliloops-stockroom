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
import { subscribeToPurchaseOrders, getPurchaseOrderWithDetails, deletePurchaseOrder } from '@/lib/services/purchaseOrderService';
import { getAllShipping } from '@/lib/services/shippingService';
import { getStoreById } from '@/lib/services/storeService';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Loader2, FileText, AlertTriangle, Search, ChevronsRight, MoreHorizontal, Edit, Trash2, CheckCircle, XCircle, ChevronDown, FileSpreadsheet, ListChecks } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
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
import { UserContext } from '@/app/dashboard/layout';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const ROWS_PER_PAGE = 10;
const ALL_STATUSES: PurchaseOrder['status'][] = ['INPUTTED', 'IN SHIPPING (PARTIAL)', 'IN SHIPPING', 'RECEIVED (PARTIAL)', 'RECEIVED', 'DONE'];

export default function PurchaseOrdersPage() {
    const { toast } = useToast();
    const router = useRouter();
    const { user, permissions, selectedStoreId } = React.useContext(UserContext);
    const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [exportLoading, setExportLoading] = React.useState(false);
    const [currentStoreName, setCurrentStoreName] = React.useState<string>('');

    // Search and Filter State
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedStatuses, setSelectedStatuses] = React.useState<Set<PurchaseOrder['status']>>(new Set());

    // Pagination state
    const [currentPage, setCurrentPage] = React.useState(1);

    // Delete Confirmation State
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
    const [poToDelete, setPoToDelete] = React.useState<PurchaseOrder | null>(null);


    const storeId = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

    // Fetch store name when storeId changes
    React.useEffect(() => {
        const fetchStoreName = async () => {
            if (storeId) {
                try {
                    const store = await getStoreById(storeId);
                    if (store) {
                        setCurrentStoreName(store.name);
                    }
                } catch (error) {
                    console.error('Error fetching store name:', error);
                }
            } else {
                setCurrentStoreName('');
            }
        };

        fetchStoreName();
    }, [storeId]);

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
            case 'IN SHIPPING (PARTIAL)':
                return 'secondary';
            case 'IN SHIPPING':
                return 'info';
            case 'RECEIVED (PARTIAL)':
                return 'warning';
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

        // Filter by selected statuses
        if (selectedStatuses.size > 0) {
            tempPOs = tempPOs.filter(po => selectedStatuses.has(po.status));
        }

        // Filter by search term
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
    }, [purchaseOrders, searchTerm, selectedStatuses]);

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
    }, [searchTerm, selectedStatuses]);

    const openDeleteDialog = (po: PurchaseOrder) => {
        setPoToDelete(po);
        setIsDeleteAlertOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!poToDelete) return;
        try {
            await deletePurchaseOrder(poToDelete.id);
            toast({ title: 'Purchase Order deleted successfully' });
            setIsDeleteAlertOpen(false);
            setPoToDelete(null);
        } catch (error) {
            toast({ title: 'Error deleting Purchase Order', variant: 'destructive' });
        }
    };

    const handleExportToSheets = async () => {
        if (filteredPOs.length === 0) {
            toast({
                title: 'No data to export',
                description: 'There are no purchase orders to export.',
                variant: 'destructive'
            });
            return;
        }

        if (!currentStoreName) {
            toast({
                title: 'Store name not found',
                description: 'Unable to determine store name for export.',
                variant: 'destructive'
            });
            return;
        }

        setExportLoading(true);

        try {
            // CRITICAL FIX: Properly serialize Firestore data before sending
            // Convert Firestore Timestamps to plain objects that can be JSON serialized
            const serializedPOs = filteredPOs.map(po => {
                // Helper function to serialize Timestamp
                const serializeTimestamp = (timestamp: any) => {
                    if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
                        return timestamp;
                    }
                    if (timestamp && typeof timestamp === 'object' && typeof timestamp.toDate === 'function') {
                        const date = timestamp.toDate();
                        return { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 };
                    }
                    if (timestamp instanceof Date) {
                        return { seconds: Math.floor(timestamp.getTime() / 1000), nanoseconds: 0 };
                    }
                    return timestamp;
                };

                return {
                    ...po,
                    // Ensure all fields are properly included
                    id: po.id,
                    poNumber: po.poNumber,
                    orderNumber: po.orderNumber,
                    orderDate: serializeTimestamp(po.orderDate),
                    storeId: po.storeId,
                    supplierId: po.supplierId,
                    supplierName: po.supplierName,
                    supplierCode: po.supplierCode,
                    chatSearch: po.chatSearch,
                    totalPcs: po.totalPcs,
                    totalRmb: po.totalRmb,
                    exchangeRate: po.exchangeRate,
                    totalPembelianIdr: po.totalPembelianIdr,
                    marking: po.marking,
                    shippingCost: po.shippingCost,
                    costPerPiece: po.costPerPiece,
                    packageCount: po.packageCount,
                    photoUrl: po.photoUrl,
                    trackingNumber: po.trackingNumber,
                    shippingNote: po.shippingNote,
                    totalPcsOldReceived: po.totalPcsOldReceived,
                    totalPcsNewReceived: po.totalPcsNewReceived,
                    totalPcsRefunded: po.totalPcsRefunded,
                    status: po.status,
                    isStockUpdated: po.isStockUpdated,
                    isOldItemsInPurchaseMenu: po.isOldItemsInPurchaseMenu,
                    isNewItemsPdfCreated: po.isNewItemsPdfCreated,
                    isPrintoutCreated: po.isPrintoutCreated,
                    isNewItemsUploaded: po.isNewItemsUploaded,
                    isNewItemsAddedToPurchase: po.isNewItemsAddedToPurchase,
                    hasRefund: po.hasRefund,
                    refundAmountYuan: po.refundAmountYuan,
                    isSupplierRefundApproved: po.isSupplierRefundApproved,
                    createdAt: serializeTimestamp(po.createdAt),
                    updatedAt: serializeTimestamp(po.updatedAt),
                };
            });

            // Debug: Log what we're sending
            console.log('=== FRONTEND EXPORT DEBUG ===');
            console.log('Total POs:', serializedPOs.length);
            console.log('First PO to export:', {
                id: serializedPOs[0]?.id,
                poNumber: serializedPOs[0]?.poNumber,
                orderNumber: serializedPOs[0]?.orderNumber,
                supplierCode: serializedPOs[0]?.supplierCode,
            });
            console.log('=== END FRONTEND DEBUG ===');

            const response = await fetch('/api/export-purchase-orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    purchaseOrders: serializedPOs,
                    storeName: currentStoreName,
                }),
            });

            const result = await response.json();

            if (result.success) {
                toast({
                    title: 'Export Successful',
                    description: `${result.message} to sheet "${currentStoreName}"`,
                });

                // Open the sheet in a new tab
                if (result.sheetUrl) {
                    window.open(result.sheetUrl, '_blank');
                }
            } else {
                toast({
                    title: 'Export Failed',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            toast({
                title: 'Export Error',
                description: error.message || 'Failed to export to Google Sheets',
                variant: 'destructive',
            });
        } finally {
            setExportLoading(false);
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

    const handleStatusFilterChange = (status: PurchaseOrder['status'], checked: boolean) => {
        setSelectedStatuses(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(status);
            } else {
                newSet.delete(status);
            }
            return newSet;
        });
    }

    const canPerformActions = user?.email === 'superadmin@caliloops.com' ? !!selectedStoreId : !!user?.storeId;

    const YesNo = ({ value }: { value?: boolean }) => (
        value ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-muted-foreground" />
    );

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
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        disabled={!canPerformActions || exportLoading || filteredPOs.length === 0}
                        onClick={handleExportToSheets}
                    >
                        {exportLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Export to Sheets
                            </>
                        )}
                    </Button>
                    {(permissions?.canManagePurchaseOrders || permissions?.hasFullAccess) && (
                        <Button disabled={!canPerformActions} onClick={() => router.push('/dashboard/purchase-orders/new')}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create New PO
                        </Button>
                    )}
                </div>
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
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-[240px] justify-between">
                                        {selectedStatuses.size === 0
                                            ? "Filter by status..."
                                            : selectedStatuses.size === ALL_STATUSES.length
                                                ? "All Statuses"
                                                : `${selectedStatuses.size} selected`}
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56">
                                    <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {ALL_STATUSES.map(status => (
                                        <DropdownMenuCheckboxItem
                                            key={status}
                                            checked={selectedStatuses.has(status)}
                                            onCheckedChange={(checked) => handleStatusFilterChange(status, Boolean(checked))}
                                        >
                                            {status}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
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
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Total Pcs</TableHead>
                                    <TableHead>Total RMB</TableHead>
                                    <TableHead>Cost per Pcs</TableHead>
                                    <TableHead>Note</TableHead>
                                    <TableHead>Pcs Brg Lama Diterima</TableHead>
                                    <TableHead>Pcs Brg Baru Diterima</TableHead>
                                    <TableHead>Pcs Refund</TableHead>
                                    <TableHead>Brg Lama di Pembelian?</TableHead>
                                    <TableHead>PDF Brg Baru?</TableHead>
                                    <TableHead>Printout?</TableHead>
                                    <TableHead>Update Stock?</TableHead>
                                    <TableHead>Upload Brg Baru?</TableHead>
                                    <TableHead>Brg Baru di Pembelian?</TableHead>
                                    <TableHead>Ada Refund?</TableHead>
                                    <TableHead>Jml Refund (Yuan)</TableHead>
                                    <TableHead>Supplier OK?</TableHead>
                                    <TableHead>Last Updated</TableHead>
                                    <TableHead className='text-right'>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={22} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedPOs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={22} className="h-24 text-center">
                                            No purchase orders found. Add a new PO to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedPOs.map((po) => (
                                        <TableRow key={po.id}>
                                            <TableCell className="font-medium">{po.poNumber}</TableCell>
                                            <TableCell>{format(po.orderDate.toDate(), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="whitespace-nowrap">{po.supplierName}</TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(po.status)} className="whitespace-nowrap">{po.status}</Badge>
                                            </TableCell>
                                            <TableCell>{po.totalPcs}</TableCell>
                                            <TableCell>{po.totalRmb.toLocaleString('zh-CN')}</TableCell>
                                            <TableCell>
                                                {(po.costPerPiece && po.costPerPiece > 0)
                                                    ? po.costPerPiece.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })
                                                    : 'N/A'
                                                }
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate">{po.shippingNote}</TableCell>
                                            <TableCell>{po.totalPcsOldReceived}</TableCell>
                                            <TableCell>{po.totalPcsNewReceived}</TableCell>
                                            <TableCell>{po.totalPcsRefunded}</TableCell>
                                            <TableCell><YesNo value={po.isOldItemsInPurchaseMenu} /></TableCell>
                                            <TableCell><YesNo value={po.isNewItemsPdfCreated} /></TableCell>
                                            <TableCell><YesNo value={po.isPrintoutCreated} /></TableCell>
                                            <TableCell><YesNo value={po.isStockUpdated} /></TableCell>
                                            <TableCell><YesNo value={po.isNewItemsUploaded} /></TableCell>
                                            <TableCell><YesNo value={po.isNewItemsAddedToPurchase} /></TableCell>
                                            <TableCell><YesNo value={po.hasRefund} /></TableCell>
                                            <TableCell>{po.refundAmountYuan?.toLocaleString('zh-CN')}</TableCell>
                                            <TableCell><YesNo value={po.isSupplierRefundApproved} /></TableCell>
                                            <TableCell>
                                                {format(po.updatedAt.toDate(), 'dd MMM yyyy, HH:mm')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" size="icon">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align='end'>
                                                            <DropdownMenuItem onClick={() => router.push(`/dashboard/purchase-orders/${po.id}/items`)}>
                                                                <ListChecks className="mr-2 h-4 w-4" /> Items Details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => router.push(`/dashboard/purchase-orders/${po.id}`)}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(po)}>
                                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
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

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the Purchase Order "{poToDelete?.poNumber}".
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
