
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
import { useToast } from '@/hooks/use-toast';
import { getBarcodesBySkuCode, getBarcodesByBarcodeIds } from '@/lib/services/inboundService';
import {
  addStockOpnameLog,
  subscribeToStockOpnameLogs,
  confirmSingleLostPack,
} from '@/lib/services/stockOpnameService';
import {
  Loader2,
  ScanLine,
  Search,
  CheckCircle2,
  XCircle,
  FileDown,
  ClipboardList,
  RefreshCw,
  X,
  PlusCircle,
  Camera,
  Check,
  ChevronsUpDown,
  AlertTriangle,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Barcode as BarcodeType, StockOpnameLog, Sku } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import * as xlsx from 'xlsx';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { UserContext } from '@/app/dashboard/layout';
import { subscribeToSkus } from '@/lib/services/skuService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useSearchParams } from 'next/navigation';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import dynamic from 'next/dynamic';

const ClientScanner = dynamic(() => import('@/components/ui/scanner').then(m => m.ClientScanner), { ssr: false });

type OpnameStep = 'selection' | 'scanning' | 'result';

type OpnameResult = Omit<StockOpnameLog, 'id' | 'datetime'>;
const ROWS_PER_PAGE = 10;

function StockOpnameContent() {
  const { toast } = useToast();
  const { user, permissions, selectedStoreId } = React.useContext(UserContext);
  const searchParams = useSearchParams();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [step, setStep] = React.useState<OpnameStep>('selection');
  const [skuCode, setSkuCode] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const [allSkus, setAllSkus] = React.useState<Sku[]>([]);

  const [expectedBarcodes, setExpectedBarcodes] = React.useState<BarcodeType[]>(
    []
  );
  const [scannedBarcodes, setScannedBarcodes] = React.useState<string[]>([]);
  const [manualBarcode, setManualBarcode] = React.useState('');

  const [logs, setLogs] = React.useState<StockOpnameLog[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);

  const [result, setResult] = React.useState<OpnameResult | null>(null);

  const [isScanning, setIsScanning] = React.useState(false);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = React.useState(false);
  const [selectedLog, setSelectedLog] = React.useState<StockOpnameLog | null>(null);
  const [missingBarcodeDetails, setMissingBarcodeDetails] = React.useState<BarcodeType[]>([]);
  const [loadingMissingDetails, setLoadingMissingDetails] = React.useState(false);
  const [isConfirming, setIsConfirming] = React.useState<{[key: string]: boolean}>({});
  
  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [exportDateRange, setExportDateRange] = React.useState<DateRange | undefined>();

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);


  const storeIdToQuery = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : (user?.storeId || null);

  React.useEffect(() => {
    if (!user) return;

    const storeIdToQueryForLogs = user.email === 'superadmin@caliloops.com' ? selectedStoreId : user.storeId || null;
    
    if (user.email !== 'superadmin@caliloops.com' && !user.storeId) {
        setLogs([]);
        setAllSkus([]);
        setLoadingLogs(false);
        return;
    }

    const unsubscribe = subscribeToStockOpnameLogs(
      storeIdToQueryForLogs,
      (logsData) => {
        setLogs(logsData);
        setLoadingLogs(false);
      },
      () => {
        toast({ title: 'Error loading opname logs', variant: 'destructive' });
        setLoadingLogs(false);
      }
    );

    const unsubscribeSkus = subscribeToSkus(
      storeIdToQueryForLogs,
      (skuData) => {
        setAllSkus(skuData);
      },
      () => {
        toast({ title: 'Error fetching SKUs', variant: 'destructive' });
      }
    );

    const skuCodeFromUrl = searchParams.get('skuCode');
    if (skuCodeFromUrl) {
        setSkuCode(skuCodeFromUrl);
        setIsModalOpen(true);
        setTimeout(() => handleStartOpname(skuCodeFromUrl), 100);
    }


    return () => {
      unsubscribe();
      unsubscribeSkus();
    };
  }, [toast, user, selectedStoreId]);

  const handleStartOpname = async (codeToUse?: string) => {
    const finalSkuCode = codeToUse || skuCode;
    if (!finalSkuCode) {
      toast({ title: 'Please select an SKU code', variant: 'destructive' });
      return;
    }
    if (!storeIdToQuery) {
        toast({ title: 'You must select a store to perform an opname.', variant: 'destructive' });
        return;
    }
    setIsLoading(true);
    try {
      const barcodes = await getBarcodesBySkuCode(finalSkuCode, storeIdToQuery);

      if (barcodes.length === 0) {
        toast({
          title: 'No Barcodes Found',
          description: `No barcodes are registered for SKU: ${finalSkuCode} in this store.`,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      setExpectedBarcodes(barcodes);
      setStep('scanning');
    } catch (error) {
      toast({ title: 'Error fetching SKU data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddScannedBarcode = (scannedValue: string) => {
    if (!scannedValue.trim()) return;
    if (!scannedBarcodes.includes(scannedValue.trim())) {
      setScannedBarcodes([...scannedBarcodes, scannedValue.trim()]);
    }
  };

  const handleRemoveScannedBarcode = (barcodeToRemove: string) => {
    setScannedBarcodes(scannedBarcodes.filter((b) => b !== barcodeToRemove));
  };

  const handleFinishAndCompare = () => {
    setIsLoading(true);
    const expectedInStockBarcodes = expectedBarcodes.filter(
      (b) => b.status === 'in-stock'
    );
    
    const calculateTotals = (barcodeList: BarcodeType[]) => {
      return barcodeList.reduce((acc, barcode) => {
          acc.packs++;
          acc.pcs += barcode.quantity;
        return acc;
      }, { packs: 0, pcs: 0 });
    };

    const expectedInStockIds = expectedInStockBarcodes.map((b) => b.barcodeID);
    
    const matchedScannedItems = expectedInStockBarcodes.filter(b => scannedBarcodes.includes(b.barcodeID));
    const notOkMissingItems = expectedInStockBarcodes.filter(b => !scannedBarcodes.includes(b.barcodeID));
    
    const totalSystem = calculateTotals(expectedInStockBarcodes);
    const totalOK = calculateTotals(matchedScannedItems);
    const totalNotOK = calculateTotals(notOkMissingItems);

    const notOkIds = notOkMissingItems.map(b => b.barcodeID);

    const opnameResult: OpnameResult = {
      user: user?.name || 'Unknown User',
      skuName: expectedBarcodes[0]?.skuName || 'N/A',
      skuCode: skuCode.trim(),
      storeId: storeIdToQuery!,
      totalPacks: totalSystem.packs,
      totalPcs: totalSystem.pcs,
      totalOKPacks: totalOK.packs,
      totalOKPcs: totalOK.pcs,
      totalNotOKPacks: totalNotOK.packs,
      totalNotOKPcs: totalNotOK.pcs,
      status: notOkIds.length === 0 ? 'OK' : 'NOT OK',
      notOkBarcodes: notOkIds,
      discrepancyStatus: notOkIds.length > 0 ? 'pending' : 'confirmed',
    };
    
    setResult(opnameResult);
    setStep('result');
    setIsLoading(false);
  };

  const handleSubmitOpname = async () => {
    if (!result) {
      toast({ title: 'No result to submit', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      await addStockOpnameLog(result);
      toast({ title: 'Stock opname completed and saved!' });
      resetOpname();
    } catch (error) {
       console.error(error);
      toast({ title: 'Error saving opname results', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenConfirmModal = async (log: StockOpnameLog) => {
    setSelectedLog(log);
    setMissingBarcodeDetails([]); // Clear previous details
    setIsConfirmModalOpen(true);
    if (log.notOkBarcodes && log.notOkBarcodes.length > 0) {
        setLoadingMissingDetails(true);
        console.log('[handleOpenConfirmModal] Fetching details for barcodes:', log.notOkBarcodes);
        try {
            const details = await getBarcodesByBarcodeIds(log.notOkBarcodes, log.storeId);
            setMissingBarcodeDetails(details);
        } catch (error) {
            console.error("Error fetching missing item details:", error);
            toast({ title: "Error fetching missing item details", variant: "destructive" });
        } finally {
            setLoadingMissingDetails(false);
        }
    }
  };


  const handleConfirmLost = async (barcodeId: string) => {
    if (!selectedLog || (!permissions?.canFlagItemAsLost && !permissions?.hasFullAccess)) {
      toast({ title: 'Permission Denied or No Log Selected', variant: 'destructive' });
      return;
    }
    
    setIsConfirming(prev => ({...prev, [barcodeId]: true}));

    try {
      await confirmSingleLostPack(selectedLog, barcodeId);
      toast({ title: `Barcode ${barcodeId} confirmed as lost!` });
      
      // Refresh the missing details list
      setMissingBarcodeDetails(prev => prev.filter(b => b.barcodeID !== barcodeId));

      // Update the selected log in state so the UI reflects the change
      const updatedLog = { ...selectedLog, notOkBarcodes: selectedLog.notOkBarcodes.filter(id => id !== barcodeId) };
      if (updatedLog.notOkBarcodes.length === 0) {
        updatedLog.discrepancyStatus = 'confirmed';
      }
      setSelectedLog(updatedLog);

      if (updatedLog.notOkBarcodes.length === 0) {
        setIsConfirmModalOpen(false);
        setSelectedLog(null);
      }

    } catch (error) {
      console.error("Confirmation Error:", error);
      toast({ title: `Error confirming barcode ${barcodeId}`, variant: 'destructive' });
    } finally {
      setIsConfirming(prev => ({...prev, [barcodeId]: false}));
    }
  };


  const resetOpname = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setStep('selection');
      setSkuCode('');
      setExpectedBarcodes([]);
      setScannedBarcodes([]);
      setManualBarcode('');
      setResult(null);
      setIsScanning(false);
    }, 300); 
  };

  const handleExport = () => {
    if (!permissions?.canExportLogs && !permissions?.hasFullAccess) {
      toast({ title: 'Permission Denied', variant: 'destructive' });
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
      SKU: log.skuCode,
      Datetime: log.datetime.toDate().toLocaleString(),
      'Total Packs (System)': log.totalPacks,
      'Total Pcs (System)': log.totalPcs,
      'Total OK (Packs)': log.totalOKPacks,
      'Total OK (Pcs)': log.totalOKPcs,
      'Total NOT OK (Packs)': log.totalNotOKPacks,
      'Total NOT OK (Pcs)': log.totalNotOKPcs,
      Status: log.status,
      'Discrepancy Status': log.discrepancyStatus,
    }));
    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Stock Opname Logs');
    xlsx.writeFile(
      workbook,
      `stock-opname-logs-${new Date().toISOString()}.xlsx`
    );
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

  const missingBarcodesMap = React.useMemo(() => {
    return new Map(missingBarcodeDetails.map(b => [b.barcodeID, b]));
  }, [missingBarcodeDetails]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList /> Stock Opname
          </h1>
          <p className="text-muted-foreground">
            Perform and record physical stock counts for your store.
          </p>
        </div>
        <div>
          <Dialog
            open={isModalOpen}
            onOpenChange={(open) => {
              if (open) setIsModalOpen(true);
              else resetOpname();
            }}
          >
            <DialogTrigger asChild>
              {(permissions?.canFlagItemAsLost || permissions?.hasFullAccess) && (
              <Button disabled={!canPerformActions} size="sm">
                <PlusCircle className="h-4 w-4 mr-2" />
                Start Stock Opname
              </Button>
              )}
            </DialogTrigger>
            <DialogContent className={cn("sm:max-w-lg", step === 'result' && 'sm:max-w-md')}>
              {step === 'selection' && (
                <>
                  <DialogHeader>
                    <DialogTitle>Step 1: Select SKU</DialogTitle>
                    <DialogDescription>
                      Choose the SKU you want to perform a stock opname for.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-6">
                    <Label htmlFor="sku-select">SKU</Label>
                    <Select value={skuCode} onValueChange={setSkuCode}>
                      <SelectTrigger id="sku-select" className="w-full mt-2">
                        <SelectValue placeholder="Select an SKU" />
                      </SelectTrigger>
                      <SelectContent>
                        {allSkus.map((sku) => (
                          <SelectItem key={sku.id} value={sku.skuCode}>
                            {sku.skuName} ({sku.skuCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => handleStartOpname()}
                      disabled={isLoading || !skuCode}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Start Opname
                    </Button>
                  </DialogFooter>
                </>
              )}
              {step === 'scanning' && (
                <>
                  <DialogHeader>
                    <DialogTitle>Step 2: Scan Barcodes</DialogTitle>
                    <DialogDescription>
                      Scan all physical items for SKU:{' '}
                      <strong>{skuCode}</strong>. <br />
                      Total in-stock barcodes in system:{' '}
                      <strong>
                        {
                          expectedBarcodes.filter((b) => b.status === 'in-stock')
                            .length
                        }{' '}
                        items
                      </strong>
                      .
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
                                  handleAddScannedBarcode(result[0].rawValue);
                                  setIsScanning(false)
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
                    <div className="grid md:grid-cols-2 gap-4 py-2">
                      <div className="flex flex-col items-center justify-center gap-4 border rounded-md p-4">
                        <Label>Scan with Camera</Label>
                        <Button
                          onClick={() => setIsScanning(true)}
                          variant="outline"
                          className="w-full"
                          type="button"
                        >
                          <Camera className="mr-2 h-4 w-4" />
                          Start Scanner
                        </Button>
                      </div>
                      <div className="border rounded-md p-4">
                        <p className="font-medium">
                          Scanned Items ({scannedBarcodes.length})
                        </p>
                        <div className="max-h-40 overflow-y-auto mt-2">
                          {scannedBarcodes.length === 0 ? (
                            <p className="text-muted-foreground text-center text-sm py-4">
                              No barcodes scanned yet.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {scannedBarcodes.map((barcode) => (
                                <li
                                  key={barcode}
                                  className="flex items-center justify-between bg-secondary p-2 rounded-md"
                                >
                                  <span className="font-mono text-sm">
                                    {barcode}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() =>
                                      handleRemoveScannedBarcode(barcode)
                                    }
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {!isScanning && (
                    <DialogFooter>
                      <Button
                        onClick={() => setStep('selection')}
                        variant="outline"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleFinishAndCompare}
                        disabled={isLoading || scannedBarcodes.length === 0}
                      >
                        {isLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Finish & Compare
                      </Button>
                    </DialogFooter>
                  )}
                </>
              )}
              {step === 'result' && result && (
                 <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      {result.status === 'OK' ? (
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      ) : (
                        <XCircle className="h-6 w-6 text-destructive" />
                      )}
                      Opname Result: {result.status}
                    </DialogTitle>
                    <DialogDescription>
                      Summary for SKU: <strong>{result.skuCode}</strong>. Review before submitting.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total In Stock (System):</span>
                        <span className="font-medium">{result.totalPacks} Pack ({result.totalPcs} pcs)</span>
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Found (OK):</span>
                        <span className="font-medium text-green-500">{result.totalOKPacks} Pack ({result.totalOKPcs} pcs)</span>
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Missing (NOT OK):</span>
                        <span className="font-medium text-destructive">{result.totalNotOKPacks} Pack ({result.totalNotOKPcs} pcs)</span>
                      </li>
                    </ul>
                    {result.status === 'NOT OK' &&
                      result.notOkBarcodes.length > 0 && (
                        <div>
                          <Separator />
                          <div className="pt-4">
                            <Label>Missing Barcodes:</Label>
                            <div className="max-h-28 overflow-y-auto bg-muted p-2 rounded-md mt-2 space-y-1">
                              {result.notOkBarcodes.map((id) => (
                                <p key={id} className="font-mono text-xs text-destructive">
                                  {id}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                  <DialogFooter>
                    <Button onClick={resetOpname} variant="outline" className="w-full sm:w-auto" disabled={isLoading}>
                      Cancel
                    </Button>
                     <Button onClick={handleSubmitOpname} className="w-full sm:w-auto" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Submit Opname'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {user?.email !== 'superadmin@caliloops.com' && !user?.storeId && (
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No Store Assigned</AlertTitle>
            <AlertDescription>
                You are not assigned to a store. Please contact an administrator to assign you to a store to perform a stock opname.
            </AlertDescription>
        </Alert>
      )}
      {user?.email === 'superadmin@caliloops.com' && !selectedStoreId && (
        <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No Store Selected</AlertTitle>
            <AlertDescription>
                Please select a store from the header dropdown to view and manage stock opname.
            </AlertDescription>
        </Alert>
      )}


      <Card>
        <CardHeader className="pt-6 flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Opname History</CardTitle>
            <CardDescription>
              A log of all completed stock opname activities.
            </CardDescription>
          </div>
           <div className="flex items-center gap-2 pt-4 md:pt-0">
             {(permissions?.canExportLogs || permissions?.hasFullAccess) && (
                <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
                    <DialogTrigger asChild>
                        <Button
                            size="sm"
                            variant="outline"
                        >
                            <FileDown className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Export Opname History</DialogTitle>
                            <DialogDescription>
                                Select a date range to export the opname history.
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Date/Time</TableHead>
                <TableHead>Total Recorded (Packs)</TableHead>
                <TableHead>Total Found (Packs)</TableHead>
                <TableHead>Total Missing (Packs)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Discrepancy</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLogs ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No opname logs found for this store or filter.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.skuCode}</TableCell>
                    <TableCell>
                      {log.datetime.toDate().toLocaleString()}
                    </TableCell>
                    <TableCell>{log.totalPacks}</TableCell>
                    <TableCell>{log.totalOKPacks}</TableCell>
                    <TableCell>{log.totalNotOKPacks}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === 'OK' ? 'success' : 'destructive'
                        }
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       {log.status === 'NOT OK' && (
                         <Badge
                           variant={
                            log.discrepancyStatus === 'confirmed' ? 'secondary' : 'outline'
                           }
                           className="uppercase"
                         >
                           {log.discrepancyStatus}
                         </Badge>
                       )}
                    </TableCell>
                     <TableCell>
                        {log.status === 'NOT OK' && log.discrepancyStatus === 'pending' && (permissions?.canFlagItemAsLost || permissions?.hasFullAccess) && (
                            <Button variant="outline" size="sm" onClick={() => handleOpenConfirmModal(log)}>
                                Follow Up Action
                            </Button>
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

      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle className='flex items-center gap-2'>
                    <AlertTriangle className='text-destructive'/>
                    Follow Up Action
                </DialogTitle>
                <DialogDescription>
                   For SKU: <strong>{selectedLog?.skuCode}</strong>. Mark each missing pack as "LOST" individually. This action cannot be undone.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
                <Label>Missing Barcodes ({(selectedLog?.notOkBarcodes?.length ?? 0)}):</Label>
                 <div className="max-h-60 overflow-y-auto bg-muted p-2 rounded-md space-y-2">
                    {loadingMissingDetails ? (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <p className="ml-2">Loading details...</p>
                        </div>
                    ) : (selectedLog?.notOkBarcodes?.length ?? 0) > 0 ? (
                        selectedLog!.notOkBarcodes.map(barcodeId => {
                            const barcode = missingBarcodesMap.get(barcodeId);
                            return (
                                <div key={barcodeId} className='flex items-center justify-between p-2 bg-background rounded'>
                                    <p className='font-mono text-sm text-destructive'>
                                        {barcodeId} {barcode ? `(${barcode.quantity} ${barcode.unit})` : '(details not found)'}
                                    </p>
                                    <Button 
                                        variant="destructive" 
                                        size="sm" 
                                        onClick={() => handleConfirmLost(barcodeId)} 
                                        disabled={isConfirming[barcodeId]}
                                    >
                                        {isConfirming[barcodeId] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Mark as Lost'}
                                    </Button>
                                </div>
                            );
                        })
                    ) : (selectedLog?.status === "NOT OK" && (selectedLog?.notOkBarcodes?.length ?? 0) === 0) ? (
                        <p className="text-center text-sm text-muted-foreground py-4">
                            All discrepancies for this log have been resolved.
                        </p>
                    ) : null}
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => {
                    setIsConfirmModalOpen(false);
                    setSelectedLog(null);
                    setMissingBarcodeDetails([]);
                }}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StockOpnamePage() {
    return (
      <React.Suspense fallback={<div>Loading...</div>}>
        <StockOpnameContent />
      </React.Suspense>
    );
  }
