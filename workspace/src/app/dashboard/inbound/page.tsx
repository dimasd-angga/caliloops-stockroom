
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { Sku, Unit, InboundShipment, Pack, Barcode as BarcodeType, StockOpnameLog } from '@/lib/types';
import { subscribeToSkus, addSku, checkSkuExists, updateSkuDetails } from '@/lib/services/skuService';
import {
  addInboundShipment,
  getShipmentsBySku,
  getBarcode,
  getBarcodesBySkuId,
  getBarcodesByBarcodeIds,
  markBarcodesAsPrinted,
} from '@/lib/services/inboundService';
import {
  PlusCircle,
  X,
  Loader2,
  ArrowLeft,
  ChevronsRight,
  Printer,
  Upload,
  AlertTriangle,
  Download,
  ClipboardList,
  FileDown,
  ChevronDown,
  Calendar as CalendarIcon,
  History,
  Search,
  Image as ImageIcon,
  Edit,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UserContext } from '@/app/dashboard/layout';
import { Separator } from '@/components/ui/separator';
import Barcode from 'react-barcode';
import * as xlsx from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { subscribeToStockOpnameLogs } from '@/lib/services/stockOpnameService';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { usePDF } from 'react-to-pdf';
import { Margin } from 'react-to-pdf';


const units: Unit[] = ['pcs', 'box', 'carton', 'pallet'];

type QuantityPack = {
  quantity: number;
  unit: Unit;
  note: string;
};

type ImportSummary = {
    newSkus: Sku[];
    duplicateSkus: { skuCode: string; imageUrl?: string }[];
    errorRows: { row: any; error: string }[];
};

type PrintContextType = 'all' | 'selected';


const ROWS_PER_PAGE = 10;

export default function InboundPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, permissions, selectedStoreId } = React.useContext(UserContext);
  const [allSkus, setAllSkus] = React.useState<Sku[]>([]);
  const [loadingSkus, setLoadingSkus] = React.useState(true);
  
  // State for Master-Detail view
  const [selectedSku, setSelectedSku] = React.useState<Sku | null>(null);
  
  // SKU Detail Data
  const [skuShipments, setSkuShipments] = React.useState<InboundShipment[]>([]);
  const [loadingSkuDetails, setLoadingSkuDetails] = React.useState(false);

  // Create SKU Modal
  const [isCreateSkuModalOpen, setIsCreateSkuModalOpen] = React.useState(false);
  const [newSkuName, setNewSkuName] = React.useState('');
  const [newSkuCode, setNewSkuCode] = React.useState('');
  const [newSkuImageUrl, setNewSkuImageUrl] = React.useState('');
  const [isSavingSku, setIsSavingSku] = React.useState(false);
  
  // Edit SKU Modal
  const [isEditSkuModalOpen, setIsEditSkuModalOpen] = React.useState(false);
  const [editingSku, setEditingSku] = React.useState<Sku | null>(null);

  // Create Shipment Modal State
  const [isCreateShipmentModalOpen, setIsCreateShipmentModalOpen] = React.useState(false);
  const [supplier, setSupplier] = React.useState('');
  const [poNumber, setPoNumber] = React.useState('');
  const [quantitiesPerPack, setQuantitiesPerPack] = React.useState<QuantityPack[]>([{ quantity: 0, unit: 'pcs', note: '' }]);
  const [isSavingShipment, setIsSavingShipment] = React.useState(false);

  // Barcode Modal State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = React.useState(false);
  const [selectedBarcode, setSelectedBarcode] = React.useState<BarcodeType | null>(null);
  const [loadingBarcode, setLoadingBarcode] = React.useState(false);

  // CSV Import State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importSummary, setImportSummary] = React.useState<ImportSummary | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [exportDateRange, setExportDateRange] = React.useState<DateRange | undefined>();

  // Audit History Modal State
  const [isAuditHistoryModalOpen, setIsAuditHistoryModalOpen] = React.useState(false);
  const [auditLogs, setAuditLogs] = React.useState<StockOpnameLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = React.useState(false);
  
  // Search state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);

  // Print Confirmation Modal
  const [isPrintConfirmOpen, setIsPrintConfirmOpen] = React.useState(false);
  const [barcodeToPrintId, setBarcodeToPrintId] = React.useState<string | null>(null);

  // Image Modal
  const [isImageModalOpen, setIsImageModalOpen] = React.useState(false);
  const [imageToView, setImageToView] = React.useState<string | null>(null);

  // Selective Print State
  const [selectedPacks, setSelectedPacks] = React.useState<Set<string>>(new Set());

  // PDF Print State
  const [isPdfPrintConfirmOpen, setIsPdfPrintConfirmOpen] = React.useState(false);
  const [isPdfPrintModalOpen, setIsPdfPrintModalOpen] = React.useState(false);
  const [pdfBarcodes, setPdfBarcodes] = React.useState<BarcodeType[]>([]);
  const [loadingPdfBarcodes, setLoadingPdfBarcodes] = React.useState(false);
  const [printContext, setPrintContext] = React.useState<PrintContextType | null>(null);
  
  const pdfFilename = `barcodes-${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.pdf`;
  const { toPDF, targetRef } = usePDF({
      filename: pdfFilename,
      page: { margin: 1, format: [20, 50], orientation: 'landscape' }
  });

  React.useEffect(() => {
    if (!user) return;
    setLoadingSkus(true);

    const storeIdToQuery = user.email === 'superadmin@caliloops.com' ? selectedStoreId : user.storeId || null;
    
    if (user.email !== 'superadmin@caliloops.com' && !user.storeId) {
      setAllSkus([]);
      setLoadingSkus(false);
      return;
    }

    const unsubscribe = subscribeToSkus(
      storeIdToQuery,
      (skuData) => {
        setAllSkus(skuData);
        setLoadingSkus(false);
        if (selectedSku) {
            const refreshedSku = skuData.find(s => s.id === selectedSku.id);
            if (refreshedSku) {
                setSelectedSku(refreshedSku);
            } else {
                setSelectedSku(null);
            }
        }
      },
      (error) => {
        toast({
          title: 'Error fetching SKUs',
          description: error.message,
          variant: 'destructive',
        });
        setLoadingSkus(false);
      }
    );
    return () => unsubscribe();
  }, [toast, selectedSku?.id, user, selectedStoreId]);

  // Effect for fetching audit logs when modal is opened
  React.useEffect(() => {
    if (isAuditHistoryModalOpen && selectedSku?.storeId) {
        setLoadingAuditLogs(true);
        const unsubscribe = subscribeToStockOpnameLogs(
            selectedSku.storeId,
            (logs) => {
                setAuditLogs(logs);
                setLoadingAuditLogs(false);
            },
            (error) => {
                toast({ title: 'Error fetching audit logs', variant: 'destructive' });
                setLoadingAuditLogs(false);
            },
            selectedSku.skuCode
        );
        return () => unsubscribe();
    }
  }, [isAuditHistoryModalOpen, selectedSku?.storeId, selectedSku?.skuCode, toast]);
  
  // Memoized filtered SKUs
  const filteredSkus = React.useMemo(() => {
    setIsSearching(true);
    const lowercasedFilter = searchTerm.toLowerCase();
    const result = allSkus.filter((sku) => {
        return (
          sku.skuName.toLowerCase().includes(lowercasedFilter) ||
          sku.skuCode.toLowerCase().includes(lowercasedFilter)
        );
      });
    setIsSearching(false);
    return result;
  }, [searchTerm, allSkus]);


  // Pagination Logic
  const totalPages = Math.ceil(filteredSkus.length / ROWS_PER_PAGE);
  const paginatedSkus = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return filteredSkus.slice(startIndex, endIndex);
  }, [filteredSkus, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1); // Reset to first page on search
  }, [searchTerm]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPaginationItems = () => {
    const items = [];
    const maxPagesToShow = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

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


  const handleViewDetails = async (sku: Sku) => {
    setSelectedSku(sku);
    setSelectedPacks(new Set()); // Reset selection when viewing new SKU
    setLoadingSkuDetails(true);
    try {
      const shipments = await getShipmentsBySku(sku.id);
      setSkuShipments(shipments);
    } catch (e) {
      toast({
        title: 'Error loading SKU details',
        description: 'Could not load shipment data for this SKU.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSkuDetails(false);
    }
  };

  const handleBackToList = () => {
    setSelectedSku(null);
    setSkuShipments([]);
  };

  const handleAddQuantityInput = () => {
    setQuantitiesPerPack([...quantitiesPerPack, { quantity: 0, unit: 'pcs', note: '' }]);
  };

  const handleRemoveQuantityInput = (index: number) => {
    const newQuantities = [...quantitiesPerPack];
    newQuantities.splice(index, 1);
    setQuantitiesPerPack(newQuantities);
  };

  const handleQuantityChange = (
    index: number,
    field: keyof QuantityPack,
    value: string | number
  ) => {
    const newQuantities = [...quantitiesPerPack];
    if (field === 'quantity') {
      const stringValue = value as string;
      if (/^[0-9]*$/.test(stringValue)) {
        newQuantities[index].quantity = parseInt(stringValue, 10) || 0;
      }
    } else if (field === 'unit') {
      newQuantities[index].unit = value as Unit;
    } else {
      newQuantities[index].note = value as string;
    }
    setQuantitiesPerPack(newQuantities);
  };

  const resetSkuForm = () => {
    setNewSkuName('');
    setNewSkuCode('');
    setNewSkuImageUrl('');
  };

  const handleSubmitSku = async (e: React.FormEvent) => {
    e.preventDefault();
    const storeIdForAction = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

    if (!storeIdForAction) {
        toast({ title: 'You must select a store to create an SKU.', variant: 'destructive' });
        return;
    }
    if (!permissions?.canGenerateBarcode && !permissions?.hasFullAccess) {
        toast({ title: "Permission Denied", variant: "destructive" });
        return;
    }
    if (!newSkuCode) {
      toast({ title: 'SKU Code is required.', variant: 'destructive' });
      return;
    }
    setIsSavingSku(true);
    try {
        const skuExists = await checkSkuExists(newSkuCode, storeIdForAction);
        if (skuExists) {
            toast({ title: 'SKU Code Exists', description: 'This SKU code already exists for the selected store.', variant: 'destructive' });
            setIsSavingSku(false);
            return;
        }
      
      const finalSkuName = newSkuName.trim() === '' ? newSkuCode : newSkuName;

      const newSkuId = await addSku({ storeId: storeIdForAction, skuName: finalSkuName, skuCode: newSkuCode, imageUrl: newSkuImageUrl });
      toast({ title: 'SKU created successfully!' });
      resetSkuForm();
      setIsCreateSkuModalOpen(false);
      const newSku = { id: newSkuId, storeId: storeIdForAction, skuName: finalSkuName, skuCode: newSkuCode, imageUrl: newSkuImageUrl, remainingQuantity: 0, remainingPacks: 0, createdAt: new Date() as any };
      handleViewDetails(newSku);
    } catch (error) {
      toast({ title: 'Error creating SKU', variant: 'destructive' });
    } finally {
      setIsSavingSku(false);
    }
  };

  const handleOpenEditSkuModal = (sku: Sku) => {
    setEditingSku(sku);
    setIsEditSkuModalOpen(true);
  }
  
  const handleUpdateSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSku) return;

    setIsSavingSku(true);
    try {
        const finalSkuName = editingSku.skuName.trim() === '' ? editingSku.skuCode : editingSku.skuName;
        await updateSkuDetails(editingSku.id, {
            skuName: finalSkuName,
            imageUrl: editingSku.imageUrl,
        });
        toast({ title: "SKU updated successfully!" });
        setIsEditSkuModalOpen(false);
        setEditingSku(null);
    } catch (error) {
        toast({ title: 'Error updating SKU', variant: 'destructive' });
    } finally {
        setIsSavingSku(false);
    }
  }

  
  const resetShipmentForm = () => {
    setSupplier('');
    setPoNumber('');
    setQuantitiesPerPack([{ quantity: 0, unit: 'pcs', note: '' }]);
  };

  const handleSubmitShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku) {
        toast({ title: "No SKU selected", variant: "destructive" });
        return;
    }
     if (!permissions?.canGenerateBarcode && !permissions?.hasFullAccess) {
        toast({ title: "Permission Denied", variant: "destructive" });
        return;
    }
    if (!supplier || !poNumber) {
      toast({ title: 'Missing Fields', variant: 'destructive' });
      return;
    }
    const validQuantities = quantitiesPerPack.filter((q) => q.quantity > 0);
    if (validQuantities.length === 0) {
      toast({ title: 'Invalid Quantities', variant: 'destructive' });
      return;
    }

    setIsSavingShipment(true);
    try {
      await addInboundShipment(
        { storeId: selectedSku.storeId, skuId: selectedSku.id, skuName: selectedSku.skuName, skuCode: selectedSku.skuCode, supplier, poNumber, createdBy: user?.name || 'System' },
        validQuantities
      );
      toast({ title: 'Shipment and barcodes created successfully!' });
      resetShipmentForm();
      setIsCreateShipmentModalOpen(false);
      handleViewDetails(selectedSku);
    } catch (error) {
      toast({ title: 'Error creating shipment', variant: 'destructive' });
    } finally {
      setIsSavingShipment(false);
    }
  };
  
  const handlePrintConfirmation = (barcodeId: string) => {
    setBarcodeToPrintId(barcodeId);
    setIsPrintConfirmOpen(true);
  };

  const handleOpenBarcodeModal = async (barcodeId: string) => {
    const storeIdForAction = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;
    if (!storeIdForAction) {
        toast({ title: "No store selected", variant: "destructive" });
        return;
    }

    setIsBarcodeModalOpen(true);
    setLoadingBarcode(true);
    try {
        const barcodeData = await getBarcode(barcodeId, storeIdForAction);
        if (barcodeData) {
            setSelectedBarcode(barcodeData);
        } else {
            toast({ title: "Barcode not found in this store", variant: "destructive" });
            setIsBarcodeModalOpen(false);
        }
        // Refresh SKU details to reflect the 'isPrinted' change
        if (selectedSku) {
            handleViewDetails(selectedSku);
        }
    } catch (error) {
        toast({ title: "Error fetching barcode", variant: "destructive" });
        setIsBarcodeModalOpen(false);
    } finally {
        setLoadingBarcode(false);
    }
  };

  const handlePrint = () => {
    window.print();
  }

  const handleImportClick = () => {
    if (permissions?.canGenerateBarcode || permissions?.hasFullAccess) {
      fileInputRef.current?.click();
    } else {
      toast({ title: "Permission Denied", variant: "destructive" });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const storeIdForAction = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

    if (!storeIdForAction) {
        toast({ title: 'You must select a store to import SKUs.', variant: 'destructive' });
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = xlsx.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = xlsx.utils.sheet_to_json(worksheet);

        const existingSkuCodes = new Set(allSkus.map(sku => sku.skuCode));
        const summary: ImportSummary = {
            newSkus: [],
            duplicateSkus: [],
            errorRows: [],
        };

        for (const row of json) {
          // Normalize headers: sku/skuCode, image_url/imageUrl
          const skuCode = row.sku || row.skuCode;
          const imageUrl = row.image_url || row.imageUrl;
          const skuName = row.skuName; // Can be undefined

          if (skuCode) {
            if (existingSkuCodes.has(skuCode)) {
                summary.duplicateSkus.push({ skuCode, imageUrl });
            } else {
                summary.newSkus.push({
                    storeId: storeIdForAction,
                    skuName: skuName || skuCode, // Use skuCode as name if name is missing
                    skuCode: skuCode,
                    imageUrl: imageUrl || '',
                } as Sku);
                existingSkuCodes.add(skuCode);
            }
          } else {
            summary.errorRows.push({row, error: "Missing 'sku' or 'skuCode' field."});
          }
        }
        
        setImportSummary(summary);
        setIsUploadModalOpen(true);

      } catch (error) {
        console.error("CSV Parse Error:", error);
        toast({ title: "Import Failed", description: "Please check the file format and try again.", variant: "destructive" });
      } finally {
        if(fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleFinalizeUpload = async () => {
    if (!importSummary || importSummary.newSkus.length === 0) {
        toast({ title: "No new SKUs to upload.", variant: "destructive"});
        return;
    }
    setIsImporting(true);
    toast({ title: "Uploading SKUs...", description: "Please wait." });
    
    let successCount = 0;
    try {
        for(const newSku of importSummary.newSkus) {
            await addSku(newSku);
            successCount++;
        }
        toast({ title: "Upload Successful", description: `${successCount} new SKUs have been added.` });

    } catch (error) {
        console.error("Upload Error:", error);
        toast({ title: "Upload Failed", description: `An error occurred after importing ${successCount} SKUs.`, variant: "destructive"});
    } finally {
        setIsImporting(false);
        setIsUploadModalOpen(false);
        setImportSummary(null);
    }

  };

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,sku,image_url\nSKU-001,https://example.com/image.jpg";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sku_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportData = () => {
    if (!exportDateRange?.from || !exportDateRange?.to) {
        toast({ title: "Please select a date range to export.", variant: 'destructive' });
        return;
    }
    
    let skusToExport = allSkus.filter((sku) => {
        if (!sku.createdAt) return false;
        const skuDate = sku.createdAt.toDate();
        const fromDate = new Date(exportDateRange.from!);
        const toDate = new Date(exportDateRange.to!);
        toDate.setHours(23, 59, 59, 999);
        return skuDate >= fromDate && skuDate <= toDate;
    });

    if (skusToExport.length === 0) {
        toast({ title: "No data to export", description:"Try changing the date filter or creating new SKUs.", variant: "destructive" });
        return;
    }

    const dataToExport = skusToExport.map(({ skuName, skuCode, remainingPacks, remainingQuantity, createdAt, imageUrl }) => ({
        skuName,
        skuCode,
        remainingPacks,
        remainingQuantity,
        createdAt: createdAt?.toDate().toLocaleDateString() || '',
        imageUrl,
    }));
    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'SKU Data');
    xlsx.writeFile(
      workbook,
      `caliloops-skus-${new Date().toISOString()}.xlsx`
    );
    toast({ title: "Export successful!" });
    setIsExportModalOpen(false);
  }

  const handleStartAudit = () => {
    if (!selectedSku) return;
    router.push(`/dashboard/stock-opname?skuCode=${selectedSku.skuCode}`);
  };

  const handlePdfPrintAction = (context: PrintContextType) => {
    setPrintContext(context);
    setIsPdfPrintConfirmOpen(true);
  };
  
  const handleConfirmPdfPrint = async () => {
      if (!selectedSku || !printContext) return;
      
      const storeIdForAction = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;
      if (!storeIdForAction) {
          toast({ title: "No store selected", variant: "destructive" });
          return;
      }
      
      setIsPdfPrintConfirmOpen(false);
      setIsPdfPrintModalOpen(true);
      setLoadingPdfBarcodes(true);
      
      try {
          let barcodesToPrint: BarcodeType[];
          let barcodeIdsToMark: string[] = [];

          if (printContext === 'all') {
              barcodesToPrint = await getBarcodesBySkuId(selectedSku.id, storeIdForAction);
              barcodeIdsToMark = barcodesToPrint.map(b => b.id);
          } else { // 'selected'
              if (selectedPacks.size === 0) {
                  toast({ title: "No barcodes selected", variant: "destructive" });
                  setLoadingPdfBarcodes(false);
                  setIsPdfPrintModalOpen(false);
                  return;
              }
              const ids = Array.from(selectedPacks);
              barcodesToPrint = await getBarcodesByBarcodeIds(ids, storeIdForAction);
              barcodeIdsToMark = barcodesToPrint.map(b => b.id);
          }

          setPdfBarcodes(barcodesToPrint);
          await markBarcodesAsPrinted(barcodeIdsToMark, storeIdForAction);

      } catch (error) {
          console.error("Error preparing PDF barcodes:", error);
          toast({ title: "Error fetching barcodes for printing", variant: "destructive" });
      } finally {
          setLoadingPdfBarcodes(false);
      }
  };

  const handleSelectAllPacks = (checked: boolean) => {
    if (checked) {
        const allPackIds = skuShipments.flatMap(s => s.packs.map(p => p.barcodeId).filter(Boolean)) as string[];
        setSelectedPacks(new Set(allPackIds));
    } else {
        setSelectedPacks(new Set());
    }
  };

  const handleSelectPack = (packBarcodeId: string, checked: boolean) => {
    const newSelectedPacks = new Set(selectedPacks);
    if (checked) {
        newSelectedPacks.add(packBarcodeId);
    } else {
        newSelectedPacks.delete(packBarcodeId);
    }
    setSelectedPacks(newSelectedPacks);
  };
  
  const allPacksInShipments = skuShipments.flatMap(s => s.packs.map(p => p.barcodeId).filter(Boolean));
  const isAllSelected = allPacksInShipments.length > 0 && allPacksInShipments.every(id => selectedPacks.has(id!));

  const storeIdForAction = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;
  const canPerformActions = user?.email === 'superadmin@caliloops.com' ? !!selectedStoreId : !!user?.storeId;

  if (selectedSku) {
    return (
        <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={handleBackToList} className="w-fit">
                <ArrowLeft className="mr-2 h-4 w-4"/>
                Back to SKU List
            </Button>
            
            <div className="space-y-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">{selectedSku.skuName}</h1>
                         {(permissions?.hasFullAccess) && (
                            <Dialog open={isEditSkuModalOpen} onOpenChange={setIsEditSkuModalOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="icon" onClick={() => handleOpenEditSkuModal(selectedSku)}>
                                        <Edit className="h-4 w-4"/>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <form onSubmit={handleUpdateSku}>
                                        <DialogHeader>
                                            <DialogTitle>Edit SKU</DialogTitle>
                                            <DialogDescription>Update the details for SKU: {editingSku?.skuCode}</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="editingSkuName">SKU Name (Optional)</Label>
                                                <Input id="editingSkuName" value={editingSku?.skuName || ''} onChange={(e) => setEditingSku(prev => prev ? {...prev, skuName: e.target.value} : null)} />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="editingSkuCode">SKU Code</Label>
                                                <Input id="editingSkuCode" value={editingSku?.skuCode || ''} disabled />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="editingSkuImageUrl">Image URL (Optional)</Label>
                                                <Input id="editingSkuImageUrl" value={editingSku?.imageUrl || ''} onChange={(e) => setEditingSku(prev => prev ? {...prev, imageUrl: e.target.value} : null)} placeholder="https://example.com/image.jpg" />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" type="button" onClick={() => setIsEditSkuModalOpen(false)}>Cancel</Button>
                                            <Button type="submit" disabled={isSavingSku}>
                                                {isSavingSku && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Save Changes
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Dialog open={isAuditHistoryModalOpen} onOpenChange={setIsAuditHistoryModalOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <History className="mr-2 h-4 w-4"/>
                                    Audit History
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                    <DialogTitle>Audit History for {selectedSku.skuCode}</DialogTitle>
                                    <DialogDescription>
                                        A log of all completed stock opname activities for this SKU.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date/Time</TableHead>
                                            <TableHead>System (Packs/Pcs)</TableHead>
                                            <TableHead>Found (Packs/Pcs)</TableHead>
                                            <TableHead>Missing (Packs/Pcs)</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {loadingAuditLogs ? (
                                        <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                        </TableCell>
                                        </TableRow>
                                    ) : auditLogs.length === 0 ? (
                                        <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No audit logs found for this SKU.
                                        </TableCell>
                                        </TableRow>
                                    ) : (
                                        auditLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell>
                                            {log.datetime.toDate().toLocaleString()}
                                            </TableCell>
                                            <TableCell>{log.totalPacks} / {log.totalPcs}</TableCell>
                                            <TableCell>{log.totalOKPacks} / {log.totalOKPcs}</TableCell>
                                            <TableCell>{log.totalNotOKPacks} / {log.totalNotOKPcs}</TableCell>
                                            <TableCell>
                                            <Badge
                                                variant={
                                                log.status === 'OK' ? 'success' : 'destructive'
                                                }
                                            >
                                                {log.status}
                                            </Badge>
                                            </TableCell>
                                        </TableRow>
                                        ))
                                    )}
                                    </TableBody>
                                </Table>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsAuditHistoryModalOpen(false)}>Close</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        {(permissions?.canPrintSelected || permissions?.hasFullAccess) && (
                            <Button variant="outline" size="sm" onClick={() => handlePdfPrintAction('selected')} disabled={selectedPacks.size === 0}>
                                <Printer className="mr-2 h-4 w-4"/>
                                Print Selected ({selectedPacks.size})
                            </Button>
                        )}
                        {(permissions?.canPrintAll || permissions?.hasFullAccess) && (
                             <Button variant="outline" size="sm" onClick={() => handlePdfPrintAction('all')} disabled={skuShipments.flatMap(s => s.packs).length === 0}>
                                <Printer className="mr-2 h-4 w-4"/>
                                Print All
                            </Button>
                        )}
                        {(permissions?.canFlagItemAsLost || permissions?.hasFullAccess) && (
                            <Button variant="outline" size="sm" onClick={handleStartAudit}>
                                <ClipboardList className="mr-2 h-4 w-4"/>
                                Start Audit
                            </Button>
                        )}
                        {(permissions?.canGenerateBarcode || permissions?.hasFullAccess) && (
                            <Dialog open={isCreateShipmentModalOpen} onOpenChange={setIsCreateShipmentModalOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm"><PlusCircle className="mr-2 h-4 w-4"/>New Shipment</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <form onSubmit={handleSubmitShipment}>
                                        <DialogHeader>
                                            <DialogTitle>Create New Shipment</DialogTitle>
                                            <DialogDescription>For SKU: <strong>{selectedSku.skuCode}</strong></DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-6 py-6">
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="supplier">Supplier</Label>
                                                    <Input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} required disabled={isSavingShipment}/>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="poNumber">PO Number</Label>
                                                    <Input id="poNumber" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required disabled={isSavingShipment}/>
                                                </div>
                                            </div>
                                            <Separator />
                                            <div className="grid gap-4">
                                                <Label>Quantity per Pack</Label>
                                                {quantitiesPerPack.map((pack, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <Input type="text" inputMode="numeric" pattern="[0-9]*" value={pack.quantity === 0 ? '' : pack.quantity} onChange={(e) => handleQuantityChange(index, 'quantity', e.target.value)} placeholder="Qty" className="w-24" disabled={isSavingShipment}/>
                                                        <Select value={pack.unit} onValueChange={(value) => handleQuantityChange(index, 'unit', value)} disabled={isSavingShipment}>
                                                            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Unit" /></SelectTrigger>
                                                            <SelectContent>
                                                                {units.map((unit) => (<SelectItem key={unit} value={unit}>{unit}</SelectItem>))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Input type="text" value={pack.note} onChange={(e) => handleQuantityChange(index, 'note', e.target.value)} placeholder="Optional note" className="flex-grow" disabled={isSavingShipment}/>
                                                        {quantitiesPerPack.length > 1 && (
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveQuantityInput(index)} disabled={isSavingShipment}><X className="h-4 w-4" /></Button>
                                                        )}
                                                    </div>
                                                ))}
                                                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={handleAddQuantityInput} disabled={isSavingShipment}>
                                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Another Pack
                                                </Button>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" type="button" onClick={() => setIsCreateShipmentModalOpen(false)} disabled={isSavingShipment}>Cancel</Button>
                                            <Button type="submit" disabled={isSavingShipment}>
                                                {isSavingShipment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Submit Shipment
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>
                <div className="text-sm text-muted-foreground space-x-4">
                    <span>SKU: <strong>{selectedSku.skuCode}</strong></span>
                    <Separator orientation="vertical" className="h-4 inline-block" />
                     <span>Last Audited: <strong>{selectedSku.lastAuditDate ? selectedSku.lastAuditDate.toDate().toLocaleDateString() : 'Never'}</strong></span>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox 
                                    onCheckedChange={(checked) => handleSelectAllPacks(Boolean(checked))}
                                    checked={isAllSelected}
                                    aria-label="Select all rows"
                                />
                            </TableHead>
                            <TableHead>PO Number</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Pack Qty</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Printed</TableHead>
                            <TableHead>Shipment Date</TableHead>
                            <TableHead className='text-right'>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingSkuDetails ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                </TableCell>
                            </TableRow>
                            ) : skuShipments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                No shipments found for this SKU yet.
                                </TableCell>
                            </TableRow>
                            ) : (
                            skuShipments.map((shipment) => (
                                shipment.packs.map((pack) => (
                                <TableRow key={pack.id}>
                                    <TableCell>
                                        {pack.barcodeId && (
                                            <Checkbox 
                                                onCheckedChange={(checked) => handleSelectPack(pack.barcodeId!, Boolean(checked))}
                                                checked={selectedPacks.has(pack.barcodeId)}
                                                aria-label={`Select row for barcode ${pack.barcodeId}`}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>{shipment.poNumber}</TableCell>
                                    <TableCell>{shipment.supplier}</TableCell>
                                    <TableCell>{pack.quantity}</TableCell>
                                    <TableCell>{pack.unit}</TableCell>
                                    <TableCell>
                                        <Badge
                                        variant={
                                            pack.status === 'lost' ? 'destructive' :
                                            pack.status === 'in-stock' ? 'success' :
                                            'outline'
                                        }
                                        className="flex items-center w-fit"
                                        >
                                        {pack.status === 'lost' && <AlertTriangle className="h-3 w-3 mr-1.5" />}
                                        {pack.status?.replace('-', ' ').toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            className={cn(
                                            'uppercase',
                                            pack.isPrinted
                                                ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-400/80'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-200/80 dark:bg-secondary dark:text-secondary-foreground'
                                            )}
                                        >
                                            {pack.isPrinted ? 'Printed' : 'Not Printed'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{shipment.createdAt.toDate().toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        {pack.barcodeId && (!pack.isPrinted || permissions?.canReprintBarcode || permissions?.hasFullAccess) && (
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => handlePrintConfirmation(pack.barcodeId!)}
                                            >
                                                <Printer className="mr-2 h-4 w-4"/>
                                                View Barcode
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                                ))
                            ))
                            )}
                        </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isBarcodeModalOpen} onOpenChange={setIsBarcodeModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Print Barcode</DialogTitle>
                        <DialogDescription>
                            Use a thermal printer for best results. This label is 5cm x 2cm.
                        </DialogDescription>
                    </DialogHeader>
                    {loadingBarcode ? (
                        <div className="flex h-48 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : selectedBarcode ? (
                        <div className="printable-area flex flex-col items-center justify-center gap-0.5">
                             <style jsx global>{`
                                @media print {
                                    body * {
                                        visibility: hidden;
                                    }
                                    .printable-area, .printable-area * {
                                        visibility: visible;
                                    }
                                    .printable-area {
                                        position: absolute;
                                        left: 0;
                                        top: 0;
                                        width: 100%;
                                        height: 100%;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        flex-direction: column;
                                    }
                                    @page {
                                        size: 5cm 2cm;
                                        margin: 0;
                                    }
                                }
                            `}</style>
                            <div className='w-[80%] flex justify-center'>
                                <Barcode 
                                    value={selectedBarcode.barcodeID} 
                                    height={35} 
                                    width={1.2} 
                                    fontSize={12}
                                    displayValue={false}
                                    margin={0}
                                />
                            </div>
                            <p className='text-[7px] font-mono'>{selectedBarcode.barcodeID}</p>
                            <p className="text-[8px] font-sans">{selectedBarcode.quantity} {selectedBarcode.unit}</p>
                            <p className="text-[7px] font-sans truncate">{selectedBarcode.supplier} / {selectedBarcode.poNumber}</p>
                        </div>
                    ) : null}
                    <DialogFooter className='pt-4'>
                        <Button variant="outline" onClick={() => setIsBarcodeModalOpen(false)}>Close</Button>
                        <Button onClick={handlePrint} disabled={!selectedBarcode}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
             <AlertDialog open={isPrintConfirmOpen} onOpenChange={setIsPrintConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Print</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will mark the barcode as printed. You will not be able to reprint it without admin permission. Do you want to continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setBarcodeToPrintId(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            if (barcodeToPrintId) {
                                handleOpenBarcodeModal(barcodeToPrintId);
                            }
                            setIsPrintConfirmOpen(false);
                            setBarcodeToPrintId(null);
                        }}>
                            Continue & Print
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isPdfPrintConfirmOpen} onOpenChange={setIsPdfPrintConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Bulk Print</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will mark all selected barcodes as printed. This action cannot be easily undone. Are you sure you want to continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmPdfPrint}>Yes, Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={isPdfPrintModalOpen} onOpenChange={setIsPdfPrintModalOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                         <DialogTitle>Print Barcodes to PDF</DialogTitle>
                        <DialogDescription>
                            A PDF with {pdfBarcodes.length} labels will be generated. Use the download button to save the file.
                        </DialogDescription>
                    </DialogHeader>
                    {loadingPdfBarcodes ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {/* Hidden container for PDF generation */}
                            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                                <div ref={targetRef}>
                                {pdfBarcodes.map((barcode, index) => (
                                    <div className='relative' key={barcode.id} style={
                                        { 
                                            pageBreakAfter: index === pdfBarcodes.length - 1 ? 'auto' : 'always', 
                                            overflow: 'visible',
                                            height: 75,
                                            width: 200,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                        <Barcode format={"ITF"} value={barcode.barcodeID} height={25} width={1} fontSize={7} margin={0}/>
                                        <p className="text-[6px] leading-none mt-[-2px] text-center">{barcode.skuCode}</p>
                                        <p className="text-[6px] font-sans leading-none mt-[-14px] text-center">{barcode.poNumber?.toUpperCase()} {barcode.supplier?.toUpperCase()}</p>
                                        <p className="text-[6px] font-sans leading-none mt-[-16px] text-center">{barcode.quantity} {barcode.unit.toUpperCase()}</p>
                                    </div>
                                ))}
                                </div>
                            </div>
                            <ScrollArea className="h-96">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                                {pdfBarcodes.map((barcode) => (
                                    <div key={`preview-${barcode.id}`} className="p-2 border rounded-md flex flex-col items-center justify-center aspect-[5/2]">
                                        <Barcode format={"ITF"} value={barcode.barcodeID} height={25} width={1} fontSize={7} margin={0}/>
                                        <p className="text-[6px] leading-none text-center mt-[2px]">{barcode.skuCode}</p>
                                        <p className="text-[6px] font-sans leading-none text-center mt-[1px]">{barcode.poNumber?.toUpperCase()} {barcode.supplier?.toUpperCase()}</p>
                                        <p className="text-[6px] font-sans leading-none text-center mt-[1px]">{barcode.quantity} {barcode.unit.toUpperCase()}</p>
                                    </div>
                                ))}
                                </div>
                            </ScrollArea>
                        </>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPdfPrintModalOpen(false)}>Close</Button>
                        <Button onClick={() => toPDF()} disabled={loadingPdfBarcodes || pdfBarcodes.length === 0}>
                            <Download className="mr-2 h-4 w-4"/>
                            Download PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
  }

  return (
    <>
        <div className="space-y-6">
            <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4">
                <div>
                  <h1 className="text-2xl font-bold">Inbound Management</h1>
                  <p className="text-muted-foreground">Select a SKU to view details or create a new one to begin.</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                      className="hidden"
                      disabled={isImporting}
                    />

                    {(permissions?.canGenerateBarcode || permissions?.hasFullAccess) && (
                        <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={isImporting || !canPerformActions}>
                                        Actions
                                        <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={handleImportClick} disabled={isImporting}>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Import SKUs from CSV
                                    </DropdownMenuItem>
                                    <DialogTrigger asChild>
                                        <DropdownMenuItem>
                                            <FileDown className="mr-2 h-4 w-4" />
                                            Export SKUs to CSV
                                        </DropdownMenuItem>
                                    </DialogTrigger>
                                    <DropdownMenuItem onSelect={handleDownloadTemplate}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Download CSV Template
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                             <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Export SKU Data</DialogTitle>
                                    <DialogDescription>
                                        Select a date range to export the SKU data.
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
                                    <Button onClick={handleExportData}>
                                        <FileDown className="mr-2 h-4 w-4" />
                                        Export
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}

                     <Dialog open={isCreateSkuModalOpen} onOpenChange={setIsCreateSkuModalOpen}>
                        <DialogTrigger asChild>
                             {(permissions?.canGenerateBarcode || permissions?.hasFullAccess) && (
                                <Button size="sm" disabled={isImporting || !canPerformActions}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Create New SKU
                                </Button>
                             )}
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <form onSubmit={handleSubmitSku}>
                                <DialogHeader>
                                    <DialogTitle>Create New SKU</DialogTitle>
                                    <DialogDescription>
                                        Add a new stock keeping unit to the system for your store.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="newSkuName">SKU Name (Optional)</Label>
                                        <Input id="newSkuName" value={newSkuName} onChange={(e) => setNewSkuName(e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="newSkuCode">SKU Code</Label>
                                        <Input id="newSkuCode" value={newSkuCode} onChange={(e) => setNewSkuCode(e.target.value)} required />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="newSkuImageUrl">Image URL (Optional)</Label>
                                        <Input id="newSkuImageUrl" value={newSkuImageUrl} onChange={(e) => setNewSkuImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateSkuModalOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={isSavingSku}>
                                        {isSavingSku && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create SKU
                                    </Button>
                                </DialogFooter>
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
                        You are not assigned to a store. Please contact an administrator to assign you to a store to manage SKUs.
                    </AlertDescription>
                </Alert>
            )}
            {user?.email === 'superadmin@caliloops.com' && !selectedStoreId && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>No Store Selected</AlertTitle>
                    <AlertDescription>
                        Please select a store from the header dropdown to view and manage SKUs.
                    </AlertDescription>
                </Alert>
            )}
            <Card>
                <CardHeader className="flex-col md:flex-row md:items-center md:justify-between">
                    <CardTitle>All SKUs</CardTitle>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search by SKU name or code..."
                            className="w-full pl-8 sm:w-[300px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className='p-0'>
                    <div className="w-full overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Image</TableHead>
                                    <TableHead>SKU Name</TableHead>
                                    <TableHead>SKU Code</TableHead>
                                    <TableHead>Remaining Packs</TableHead>
                                    <TableHead>Remaining Quantity</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead>Last Audited</TableHead>
                                    <TableHead className='text-right'>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingSkus || isSearching ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedSkus.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            No SKUs found. Create a new SKU or adjust filters to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedSkus.map((sku) => (
                                        <TableRow key={sku.id}>
                                            <TableCell>
                                                {sku.imageUrl ? (
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <div className="w-12 h-12 relative cursor-pointer">
                                                                <Image src={sku.imageUrl} alt={sku.skuName} layout="fill" objectFit="cover" className="rounded-md" />
                                                            </div>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-2xl">
                                                            <DialogHeader>
                                                                <DialogTitle>{sku.skuName}</DialogTitle>
                                                            </DialogHeader>
                                                            <img src={sku.imageUrl} alt={sku.skuName} className="w-full h-auto rounded-md"/>
                                                        </DialogContent>
                                                    </Dialog>
                                                ) : (
                                                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                                                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium whitespace-nowrap">{sku.skuName}</TableCell>
                                            <TableCell className="whitespace-nowrap">{sku.skuCode}</TableCell>
                                            <TableCell>{sku.remainingPacks}</TableCell>
                                            <TableCell>{sku.remainingQuantity}</TableCell>
                                            <TableCell className="whitespace-nowrap">{sku.createdAt?.toDate().toLocaleDateString()}</TableCell>
                                            <TableCell className="whitespace-nowrap">{sku.lastAuditDate ? sku.lastAuditDate.toDate().toLocaleDateString() : 'Never'}</TableCell>
                                            <TableCell className='text-right'>
                                                <Button variant="outline" size="sm" onClick={() => handleViewDetails(sku)}>
                                                    View Details
                                                    <ChevronsRight className="ml-2 h-4 w-4" />
                                                </Button>
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
                            {Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filteredSkus.length)}
                        </strong>{' '}
                        to <strong>{Math.min(currentPage * ROWS_PER_PAGE, filteredSkus.length)}</strong> of{' '}
                        <strong>{filteredSkus.length}</strong> SKUs
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
        <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
            <DialogContent className='max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>Import Summary</DialogTitle>
                    <DialogDescription>
                        Review the summary of your CSV file before uploading.
                    </DialogDescription>
                </DialogHeader>
                {importSummary ? (
                     <div className="space-y-4 py-4">
                        <Accordion type="multiple" className="w-full">
                            <AccordionItem value="new-skus">
                                <AccordionTrigger>
                                    <div className='flex justify-between items-center w-full pr-4'>
                                        <span>New SKUs to Create</span>
                                        <Badge variant="success">{importSummary.newSkus.length}</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <ScrollArea className="h-40">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>SKU</TableHead>
                                                    <TableHead>Image URL</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {importSummary.newSkus.map(sku => (
                                                    <TableRow key={sku.skuCode}>
                                                        <TableCell>{sku.skuCode}</TableCell>
                                                        <TableCell className='truncate max-w-xs'>{sku.imageUrl}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="duplicate-skus">
                                <AccordionTrigger>
                                    <div className='flex justify-between items-center w-full pr-4'>
                                        <span>Duplicate SKUs (Skipped)</span>
                                        <Badge variant="secondary">{importSummary.duplicateSkus.length}</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                     <ScrollArea className="h-40">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>SKU</TableHead>
                                                    <TableHead>Image URL</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {importSummary.duplicateSkus.map(sku => (
                                                    <TableRow key={sku.skuCode}>
                                                        <TableCell>{sku.skuCode}</TableCell>
                                                        <TableCell className='truncate max-w-xs'>{sku.imageUrl}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="error-rows">
                                 <AccordionTrigger>
                                    <div className='flex justify-between items-center w-full pr-4'>
                                        <span>Rows with Errors (Skipped)</span>
                                        <Badge variant="destructive">{importSummary.errorRows.length}</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                     <ScrollArea className="h-40">
                                       <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Row Data</TableHead>
                                                    <TableHead>Error</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {importSummary.errorRows.map((err, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className='truncate max-w-xs font-mono text-xs'>{JSON.stringify(err.row)}</TableCell>
                                                        <TableCell>{err.error}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                         {importSummary.newSkus.length === 0 && importSummary.duplicateSkus.length > 0 && (
                            <Alert variant="destructive" className='mt-4'>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>No New SKUs to Import</AlertTitle>
                                <AlertDescription>
                                    All SKUs in your file already exist in the system and were skipped.
                                </AlertDescription>
                            </Alert>
                         )}
                    </div>
                ) : (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsUploadModalOpen(false)} disabled={isImporting}>
                        Cancel
                    </Button>
                    <Button onClick={handleFinalizeUpload} disabled={isImporting || !importSummary || importSummary.newSkus.length === 0}>
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}
