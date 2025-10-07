
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  getBarcodeByBarcodeID,
  updateBarcode,
} from '@/lib/services/inboundService';
import {
  addWarehouseLog,
  subscribeToWarehouseLogs,
} from '@/lib/services/warehouseLogService';
import type { WarehouseLog, Barcode as BarcodeType } from '@/lib/types';
import {
  Loader2,
  FileDown,
  ArrowRightLeft,
  Camera,
  User,
  AlertCircle,
  PlusCircle,
  X,
  AlertTriangle,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import * as xlsx from 'xlsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserContext } from '@/app/dashboard/layout';
import { cn } from '@/lib/utils';
import { updateSkuPackCount } from '@/lib/services/skuService';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import dynamic from 'next/dynamic';

const ClientScanner = dynamic(() => import('@/components/ui/scanner').then(m => m.ClientScanner), { ssr: false });


const ROWS_PER_PAGE = 10;

export default function WarehouseIOPage() {
  const { toast } = useToast();
  const { user, permissions, selectedStoreId } = React.useContext(UserContext);
  const [barcodeID, setBarcodeID] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [logs, setLogs] = React.useState<WarehouseLog[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);
  
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [action, setAction] = React.useState<'in' | 'out'>('out');

  const [isScanning, setIsScanning] = React.useState(false);
  
  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [exportDateRange, setExportDateRange] = React.useState<DateRange | undefined>();

  // Restore Lost Item Modal State
  const [isRestoreModalOpen, setIsRestoreModalOpen] = React.useState(false);
  const [itemToRestore, setItemToRestore] = React.useState<BarcodeType | null>(null);
  const [isRestoring, setIsRestoring] = React.useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);


  React.useEffect(() => {
    if (!user) return;
    
    const storeIdToQuery = user.email === 'superadmin@caliloops.com' ? selectedStoreId : user.storeId || null;

    if (user.email !== 'superadmin@caliloops.com' && !user.storeId) {
        setLogs([]);
        setLoadingLogs(false);
        return;
    }

    const unsubscribe = subscribeToWarehouseLogs(
      storeIdToQuery,
      (logsData) => {
        setLogs(logsData);
        setLoadingLogs(false);
      },
      () => {
        toast({
          title: 'Error loading logs',
          variant: 'destructive',
        });
        setLoadingLogs(false);
      }
    );
    return () => unsubscribe();
  }, [toast, user, selectedStoreId]);

  const resetModal = () => {
    setBarcodeID('');
    setAction('out');
    setIsModalOpen(false);
    setIsScanning(false);
  }

  const completeTransaction = async (barcodeData: BarcodeType, transactionAction: 'in' | 'out') => {
      const storeIdForAction = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;
      if (!storeIdForAction) return; // Should not happen if we got here

      await addWarehouseLog({
        user: user?.name || 'Unknown User',
        barcodeID: barcodeData.barcodeID,
        skuName: barcodeData.skuName,
        quantity: barcodeData.quantity,
        unit: barcodeData.unit,
        action: transactionAction,
        storeId: storeIdForAction,
      });

      await updateBarcode(barcodeData.id, {
        status: transactionAction === 'in' ? 'in-stock' : 'out-of-stock',
      });
      
      toast({
        title: `Item successfully marked as "${transactionAction.toUpperCase()}"`,
      });

      if (isRestoreModalOpen) {
          setIsRestoreModalOpen(false);
          setItemToRestore(null);
      }
      resetModal();
  }

  const handleTransactionSubmit = async (e?: React.FormEvent, scannedBarcode?: string) => {
    e?.preventDefault();
    const barcodeToSubmit = scannedBarcode || barcodeID;

    const storeIdForAction = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

    if (!storeIdForAction) {
        toast({ title: 'You must select a store to perform this action.', variant: 'destructive' });
        return;
    }
    if (!barcodeToSubmit.trim()) {
      toast({ title: 'Please enter a barcode ID.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);

    try {
      const barcodeData = await getBarcodeByBarcodeID(barcodeToSubmit.trim());

      if (!barcodeData || barcodeData.storeId !== storeIdForAction) {
        toast({ title: 'Barcode not found in your store.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      if (action === 'out') {
        if (barcodeData.status !== 'in-stock') {
            toast({
                title: 'Item not in stock.',
                description: `Barcode ${barcodeToSubmit} has a status of "${barcodeData.status}". Only "in-stock" items can be marked as out.`,
                variant: 'destructive',
            });
            setIsLoading(false);
            return;
        }
      }

       if (action === 'in') {
        if (barcodeData.status === 'in-stock') {
            toast({
            title: 'Item already in stock.',
            description: `Barcode ${barcodeToSubmit} is already marked as in stock. No action needed.`,
            variant: 'destructive',
            });
            setIsLoading(false);
            return;
        }
        if (barcodeData.status === 'lost') {
            if (!permissions?.canRestoreLostItem && !permissions?.hasFullAccess) {
                toast({ title: "Permission Denied", description: "You don't have permission to restore lost items.", variant: "destructive" });
                setIsLoading(false);
                return;
            }
            setItemToRestore(barcodeData);
            setIsRestoreModalOpen(true);
            setIsLoading(false);
            return;
        }
      }
      
      // If we reach here, it's a standard in/out transaction for a non-lost item
      await completeTransaction(barcodeData, action);

    } catch (error) {
      console.error(error);
      toast({
        title: 'An error occurred',
        description: 'Failed to process the action.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!itemToRestore) return;
    setIsRestoring(true);
    try {
        await completeTransaction(itemToRestore, 'in');
    } catch (error) {
        console.error(error);
        toast({ title: "Error restoring item", variant: "destructive" });
    } finally {
        setIsRestoring(false);
    }
  }

  const handleExport = () => {
    if (!permissions?.canExportLogs && !permissions?.hasFullAccess) {
        toast({ title: "Permission Denied", variant: "destructive"});
        return;
    }
    if (!exportDateRange?.from || !exportDateRange?.to) {
        toast({ title: "Please select a date range to export.", variant: 'destructive' });
        return;
    }

    setIsExporting(true);

    let logsToExport = logs.filter((log) => {
        const logDate = log.datetime.toDate();
        const fromDate = new Date(exportDateRange.from!);
        const toDate = new Date(exportDateRange.to!);
        toDate.setHours(23, 59, 59, 999);
        return logDate >= fromDate && logDate <= toDate;
    });
    
    if (logsToExport.length === 0) {
      toast({ title: 'No logs to export for the selected date range.', variant: 'destructive' });
      setIsExporting(false);
      return;
    }
    const dataToExport = logsToExport.map((log) => ({
      'SKU Name': log.skuName,
      barcodeID: log.barcodeID,
      Quantity: `${log.quantity} ${log.unit}`,
      Action: log.action,
      'Date/Time': log.datetime.toDate().toLocaleString(),
      User: log.user,
    }));
    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Warehouse Logs');
    xlsx.writeFile(workbook, `warehouse-logs-${new Date().toISOString()}.xlsx`);
    setIsExporting(false);
    setIsExportModalOpen(false);
    toast({ title: 'Export successful!' });
  };
  
  const canPerformActions = user?.email === 'superadmin@caliloops.com' ? !!selectedStoreId : !!user?.storeId;

  // Pagination Logic
  const totalPages = Math.ceil(logs.length / ROWS_PER_PAGE);
  const paginatedLogs = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return logs.slice(startIndex, endIndex);
  }, [logs, currentPage]);

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

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ArrowRightLeft /> Warehouse In/Out
              </h1>
              <p className="text-muted-foreground">
                Manage item movement with barcode scanning for your store.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={isModalOpen} onOpenChange={(open) => {
                  if (open) setIsModalOpen(true);
                  else resetModal();
              }}>
                {(permissions?.canGenerateBarcode || permissions?.hasFullAccess) && (
                <DialogTrigger asChild>
                    <Button disabled={!canPerformActions}>
                        <PlusCircle className='h-4 w-4 mr-2'/>
                        Record Transaction
                    </Button>
                </DialogTrigger>
                )}
                <DialogContent showCloseButton={!isScanning}>
                    <form onSubmit={handleTransactionSubmit}>
                        <DialogHeader>
                            <DialogTitle>Record Transaction</DialogTitle>
                            <DialogDescription>
                                Select the action and scan the barcode.
                            </DialogDescription>
                        </DialogHeader>

                        {isScanning ? (
                            <div className="py-2 grid gap-4">
                              <div className="relative w-full h-[400px] bg-red rounded-lg overflow-hidden">
                                <ClientScanner
                                  formats={[
                                    'qr_code',
                                    'micro_qr_code',
                                    'rm_qr_code',
                                    'maxi_code',
                                    'pdf417',
                                    'aztec',
                                    'data_matrix',
                                    'matrix_codes',
                                    'dx_film_edge',
                                    'databar',
                                    'databar_expanded',
                                    'codabar',
                                    'code_39',
                                    'code_93',
                                    'code_128',
                                    'ean_8',
                                    'ean_13',
                                    'itf',
                                    'linear_codes',
                                    'upc_a',
                                    'upc_e'
                                  ]}
                                  paused={!isScanning}
                                  onScan={(result) => {
                                    if (result && result.length > 0) {
                                      setIsScanning(false);
                                      setBarcodeID(result[0].rawValue);
                                      // handleTransactionSubmit(undefined, result[0].rawValue);
                                    }
                                  }}
                                  onError={(error) => {
                                    toast({
                                      title: 'Scanner Error',
                                      description:
                                        error?.message || 'An unknown error occurred.',
                                      variant: 'destructive',
                                    });
                                  }}
                                  components={{
                                      finder: true,
                                  }}
                                  styles={{
                                      container: { width: '100%', height: 400, paddingTop: 0 },
                                      video: { objectFit: 'cover' },
                                  }}
                                  allowMultiple={false}
                                  sound={true}
                                />
                              </div>
                                <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsScanning(false)}
                              >
                                Stop Scanning
                              </Button>
                            </div>
                        ) : (
                            <div className='py-6 grid gap-4'>
                                <div className="grid gap-2">
                                    <Label htmlFor="action">Action Type</Label>
                                    <Select value={action} onValueChange={(value) => setAction(value as 'in' | 'out')}>
                                        <SelectTrigger id="action">
                                            <SelectValue placeholder="Select action" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="out">OUT (Stock Out)</SelectItem>
                                            <SelectItem value="in">IN (Return)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="barcode">Barcode ID</Label>
                                    <div className="flex gap-2">
                                        <Input
                                        id="barcode"
                                        placeholder="Scan or type barcode"
                                        value={barcodeID}
                                        onChange={(e) => setBarcodeID(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleTransactionSubmit(e);
                                            }
                                        }}
                                        disabled={isLoading}
                                        autoFocus
                                        />
                                        <Button type="button" variant="outline" size="icon" onClick={() => setIsScanning(true)}>
                                            <Camera className="h-4 w-4"/>
                                            <span className="sr-only">Scan Barcode</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {!isScanning && (
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={resetModal} disabled={isLoading}>Cancel</Button>
                                <Button type="submit" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Submit Transaction'}
                                </Button>
                            </DialogFooter>
                        )}
                    </form>
                </DialogContent>
              </Dialog>
            </div>
        </div>
        {user?.email !== 'superadmin@caliloops.com' && !user?.storeId && (
          <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No Store Assigned</AlertTitle>
              <AlertDescription>
                  You are not assigned to a store. Please contact an administrator to assign you to a store to manage warehouse transactions.
              </AlertDescription>
          </Alert>
        )}
        {user?.email === 'superadmin@caliloops.com' && !selectedStoreId && (
          <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No Store Selected</AlertTitle>
              <AlertDescription>
                  Please select a store from the header dropdown to view and manage warehouse transactions.
              </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex-col md:flex-row md:items-center md:justify-between">
            <CardTitle>Transaction Logs</CardTitle>
            <div className="flex items-center gap-2 pt-4 md:pt-0">
              {(permissions?.canExportLogs || permissions?.hasFullAccess) && (
                <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
                  <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                          <FileDown className="mr-2 h-4 w-4" />
                          Export
                      </Button>
                  </DialogTrigger>
                  <DialogContent>
                      <DialogHeader>
                          <DialogTitle>Export Transaction Logs</DialogTitle>
                          <DialogDescription>
                              Select a date range to export the transaction logs.
                          </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                          <Popover>
                          <PopoverTrigger asChild>
                              <Button
                              id="date"
                              variant={'outline'}
                              className="w-full justify-start text-left font-normal"
                              >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {exportDateRange?.from ? (
                                  exportDateRange.to ? (
                                  <>
                                      {format(exportDateRange.from, 'LLL dd, y')} -{' '}
                                      {format(exportDateRange.to, 'LLL dd, y')}
                                  </>
                                  ) : (
                                  format(exportDateRange.from, 'LLL dd, y')
                                  )
                              ) : (
                                  <span>Pick a date range</span>
                              )}
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                              initialFocus
                              mode="range"
                              defaultMonth={exportDateRange?.from}
                              selected={exportDateRange}
                              onSelect={setExportDateRange}
                              numberOfMonths={2}
                              />
                          </PopoverContent>
                          </Popover>
                      </div>
                      <DialogFooter>
                          <Button variant="outline" onClick={() => setIsExportModalOpen(false)}>Cancel</Button>
                          <Button onClick={handleExport} disabled={isExporting}>
                              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                              Export
                          </Button>
                      </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className='p-0'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU Name</TableHead>
                  <TableHead>Barcode ID</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLogs ? (
                  <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="mt-2 text-muted-foreground">
                          Loading logs...
                        </p>
                      </TableCell>
                    </TableRow>
                ) : paginatedLogs.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No transaction logs found for this store or filter.
                      </TableCell>
                    </TableRow>
                ) : (
                  paginatedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.skuName}</TableCell>
                      <TableCell>{log.barcodeID}</TableCell>
                      <TableCell>{`${log.quantity} ${log.unit}`}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.action === 'in' ? 'success' : 'destructive'
                          }
                        >
                          {log.action.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.datetime.toDate().toLocaleString()}
                      </TableCell>
                      <TableCell>{log.user}</TableCell>
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
                    {Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, logs.length)}
                </strong>{' '}
                to <strong>{Math.min(currentPage * ROWS_PER_PAGE, logs.length)}</strong> of{' '}
                <strong>{logs.length}</strong> logs
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
      <AlertDialog open={isRestoreModalOpen} onOpenChange={setIsRestoreModalOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Item Restoration</AlertDialogTitle>
                  <AlertDialogDescription>
                      This item was previously marked as LOST. Are you sure you want to mark it as found and move it back to IN-STOCK?
                      <div className="mt-4 bg-muted p-2 rounded-md font-mono text-sm">
                          {itemToRestore?.barcodeID}
                      </div>
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setItemToRestore(null)} disabled={isRestoring}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmRestore} disabled={isRestoring}>
                      {isRestoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Yes, Mark as Found
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
