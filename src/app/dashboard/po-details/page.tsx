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
import { subscribeToPurchaseOrders } from '@/lib/services/purchaseOrderService';
import { subscribeToShipping } from '@/lib/services/shippingService';
import { getStoreById } from '@/lib/services/storeService';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertTriangle, Search, ListChecks, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { UserContext } from '@/app/dashboard/layout';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';


const ROWS_PER_PAGE = 20;
const ALL_STATUSES: PoDetailRow['status'][] = ['INPUTTED', 'SHIPPING', 'RECEIVED'];


type PoDetailRow = {
    poId: string;
    resi: string;
    poNumber: string;
    orderDate: string;
    orderNumber?: string;
    supplierCode: string;
    supplierName: string;
    chatSearch: string;
    storageCode?: string;
    containerCode?: string;
    status: 'INPUTTED' | 'SHIPPING' | 'RECEIVED';
    receivedDate?: string;
}


export default function PoDetailsPage() {
    const { toast } = useToast();
    const { user, permissions, selectedStoreId } = React.useContext(UserContext);

    const [allPoDetails, setAllPoDetails] = React.useState<PoDetailRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [exportLoading, setExportLoading] = React.useState(false);
    const [currentStoreName, setCurrentStoreName] = React.useState<string>('');

    // Search and Filter State
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedStatuses, setSelectedStatuses] = React.useState<Set<string>>(new Set());


    // Pagination state
    const [currentPage, setCurrentPage] = React.useState(1);

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
            setAllPoDetails([]);
            setLoading(false);
            return;
        }
        setLoading(true);

        let poDataCache: PurchaseOrder[] = [];
        let shippingDataCache: Shipping[] = [];
        let isPoLoaded = false;
        let isShippingLoaded = false;

        const processData = () => {
            if (!isPoLoaded || !isShippingLoaded) return;

            try {
                const shippingMap = new Map<string, Shipping>();
                shippingDataCache.forEach(s => {
                    const resiList = Array.isArray(s.noResi) ? s.noResi : [s.noResi].filter(Boolean);
                    resiList.forEach(resi => {
                        shippingMap.set(resi, s);
                    });
                });

                const details: PoDetailRow[] = [];
                poDataCache.forEach(po => {
                    if (po.trackingNumber && po.trackingNumber.length > 0) {
                        po.trackingNumber.forEach(resi => {
                            const shippingEntry = shippingMap.get(resi);
                            details.push({
                                poId: po.id,
                                resi: resi,
                                poNumber: po.poNumber,
                                orderDate: format(po.orderDate.toDate(), 'dd MMM yyyy'),
                                orderNumber: po.orderNumber,
                                supplierCode: po.supplierCode,
                                supplierName: po.supplierName,
                                chatSearch: po.chatSearch,
                                storageCode: shippingEntry?.kodeStorage,
                                containerCode: shippingEntry?.kodeKontainer,
                                status: shippingEntry ? shippingEntry.status : 'INPUTTED',
                                receivedDate: shippingEntry?.tanggalStokDiterima ? format(shippingEntry.tanggalStokDiterima.toDate(), 'dd MMM yyyy') : undefined,
                            });
                        });
                    }
                });
                setAllPoDetails(details);
            } catch (error) {
                console.error("Error processing PO details:", error);
                toast({ title: 'Error processing PO details', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };


        const unsubscribePOs = subscribeToPurchaseOrders(
            storeId,
            (poData) => {
                poDataCache = poData;
                isPoLoaded = true;
                processData();
            },
            (error) => {
                console.error("Error fetching purchase orders:", error);
                toast({ title: 'Error fetching purchase orders', variant: 'destructive' });
                setLoading(false);
            }
        );

        const unsubscribeShipping = subscribeToShipping(
            storeId,
            (shippingData) => {
                shippingDataCache = shippingData;
                isShippingLoaded = true;
                processData();
            },
            (error) => {
                console.error("Error fetching shipping data:", error);
                toast({ title: 'Error fetching shipping data', variant: 'destructive' });
                setLoading(false);
            }
        );


        return () => {
            unsubscribePOs();
            unsubscribeShipping();
        }
    }, [toast, storeId]);

    const filteredDetails = React.useMemo(() => {
        let tempDetails = allPoDetails;

        if (selectedStatuses.size > 0) {
            tempDetails = tempDetails.filter(d => selectedStatuses.has(d.status));
        }

        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            tempDetails = tempDetails.filter(d =>
                d.poNumber.toLowerCase().includes(lowercasedTerm) ||
                d.resi.toLowerCase().includes(lowercasedTerm) ||
                d.supplierName.toLowerCase().includes(lowercasedTerm) ||
                d.storageCode?.toLowerCase().includes(lowercasedTerm) ||
                d.containerCode?.toLowerCase().includes(lowercasedTerm)
            );
        }
        return tempDetails;
    }, [allPoDetails, searchTerm, selectedStatuses]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredDetails.length / ROWS_PER_PAGE);
    const paginatedDetails = React.useMemo(() => {
        const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
        const endIndex = startIndex + ROWS_PER_PAGE;
        return filteredDetails.slice(startIndex, endIndex);
    }, [filteredDetails, currentPage]);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedStatuses]);

    const handleStatusFilterChange = (status: PoDetailRow['status'], checked: boolean) => {
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

    const handleExportToSheets = async () => {
        if (filteredDetails.length === 0) {
            toast({
                title: 'No data to export',
                description: 'There are no PO details to export.',
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
            const response = await fetch('/api/export-po-details', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    poDetails: filteredDetails,
                    storeName: currentStoreName,
                }),
            });

            const result = await response.json();

            if (result.success) {
                toast({
                    title: 'Export Successful',
                    description: `${result.message} to sheet "${currentStoreName} - PO Details"`,
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

    const canPerformActions = user?.email === 'superadmin@caliloops.com' ? !!selectedStoreId : !!user?.storeId;


    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ListChecks /> PO Details Dashboard
                    </h1>
                    <p className="text-muted-foreground">
                        A detailed, per-tracking-number view of all purchase orders.
                    </p>
                </div>
                <Button
                    variant="outline"
                    disabled={!canPerformActions || exportLoading || filteredDetails.length === 0}
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
            </div>

            {!storeId && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>No Store Selected</AlertTitle>
                    <AlertDescription>
                        Please select a store from the header dropdown to view PO details.
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <div className='flex flex-col md:flex-row gap-4 md:items-center md:justify-between'>
                        <CardTitle>All Tracking Numbers</CardTitle>
                        <div className='flex gap-2'>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search by PO, Resi, Supplier..."
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
                                    <TableHead>PO No</TableHead>
                                    <TableHead>Order Date</TableHead>
                                    <TableHead>Order No</TableHead>
                                    <TableHead>Supplier Code</TableHead>
                                    <TableHead>Nama China</TableHead>
                                    <TableHead>No Resi</TableHead>
                                    <TableHead>No Storage</TableHead>
                                    <TableHead>Kode Kontainer</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Received Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedDetails.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">
                                            No details found for the selected store or filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedDetails.map((item, index) => (
                                        <TableRow key={`${item.poId}-${item.resi}`}>
                                            <TableCell className="font-medium">{item.poNumber}</TableCell>
                                            <TableCell>{item.orderDate}</TableCell>
                                            <TableCell>{item.orderNumber}</TableCell>
                                            <TableCell>{item.supplierCode}</TableCell>
                                            <TableCell className="whitespace-nowrap">{item.chatSearch}</TableCell>
                                            <TableCell className="font-medium">{item.resi}</TableCell>
                                            <TableCell>{item.storageCode}</TableCell>
                                            <TableCell>{item.containerCode}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    item.status === 'INPUTTED' ? 'outline' :
                                                        item.status === 'SHIPPING' ? 'info' :
                                                            'success'
                                                }>{item.status}</Badge>
                                            </TableCell>
                                            <TableCell>{item.receivedDate}</TableCell>
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
                            {Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filteredDetails.length)}
                        </strong>{' '}
                        to <strong>{Math.min(currentPage * ROWS_PER_PAGE, filteredDetails.length)}</strong> of{' '}
                        <strong>{filteredDetails.length}</strong> items
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
