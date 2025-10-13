
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
import { useToast } from '@/hooks/use-toast';
import type { Sku, Permissions } from '@/lib/types';
import { addSku, checkSkuExists } from '@/lib/services/skuService';
import {
  PlusCircle,
  Loader2,
  ChevronsRight,
  Upload,
  AlertTriangle,
  Download,
  FileDown,
  ChevronDown,
  Calendar as CalendarIcon,
  Search,
  Image as ImageIcon,
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
import { UserContext } from '@/app/dashboard/layout';
import * as xlsx from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

type ImportSummary = {
    newSkus: Sku[];
    duplicateSkus: { skuCode: string; imageUrl?: string }[];
    errorRows: { row: any; error: string }[];
};

interface SkuListProps {
  skus: Sku[];
  loading: boolean;
  onViewDetails: (sku: Sku) => void;
  permissions: Permissions;
  onPageChange: (direction: 'next' | 'prev' | 'first') => void;
  currentPage: number;
  totalSkus: number;
  pageSize: number;
  onSearch: (searchTerm: string) => void;
}

export function SkuList({ 
    skus, 
    loading, 
    onViewDetails, 
    permissions,
    onPageChange,
    currentPage,
    totalSkus,
    pageSize,
    onSearch
}: SkuListProps) {
  const { toast } = useToast();
  const { user, selectedStoreId } = React.useContext(UserContext);

  // Create SKU Modal
  const [isCreateSkuModalOpen, setIsCreateSkuModalOpen] = React.useState(false);
  const [newSkuName, setNewSkuName] = React.useState('');
  const [newSkuCode, setNewSkuCode] = React.useState('');
  const [newSkuImageUrl, setNewSkuImageUrl] = React.useState('');
  const [isSavingSku, setIsSavingSku] = React.useState(false);
  
  // CSV Import State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importSummary, setImportSummary] = React.useState<ImportSummary | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [exportDateRange, setExportDateRange] = React.useState<DateRange | undefined>();

  // Search state
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const handleSearchDebounced = React.useCallback(
    debounce((term: string) => onSearch(term), 500),
    [onSearch]
  );
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    handleSearchDebounced(e.target.value);
  }

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

      await addSku({ storeId: storeIdForAction, skuName: finalSkuName, skuCode: newSkuCode, imageUrl: newSkuImageUrl });
      toast({ title: 'SKU created successfully!' });
      resetSkuForm();
      setIsCreateSkuModalOpen(false);
      onPageChange('first'); // Reload data
    } catch (error) {
      toast({ title: 'Error creating SKU', variant: 'destructive' });
    } finally {
      setIsSavingSku(false);
    }
  };

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
        
        // Note: With pagination, we cannot reliably check for duplicates on the client side
        // The backend should handle duplicate checks, but for now we'll assume new SKUs
        const summary: ImportSummary = {
            newSkus: [],
            duplicateSkus: [],
            errorRows: [],
        };

        for (const row of json) {
          const skuCode = row.sku || row.skuCode;
          const imageUrl = row.image_url || row.imageUrl;
          const skuName = row.skuName;

          if (skuCode) {
            summary.newSkus.push({
                storeId: storeIdForAction,
                skuName: skuName || skuCode,
                skuCode: skuCode,
                imageUrl: imageUrl || '',
            } as Sku);
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
            // The addSku function now needs to handle potential duplicates gracefully or we assume it does.
            await addSku(newSku);
            successCount++;
        }
        toast({ title: "Upload Successful", description: `${successCount} new SKUs have been added.` });
        onPageChange('first');

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
    const csvContent = "data:text/csv;charset=utf-8,sku,image_url,skuName\nSKU-001,https://example.com/image.jpg,Example Product";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sku_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportData = () => {
    toast({ title: "Export All SKUs is not supported with pagination yet.", variant: "destructive" });
  }

  const canPerformActions = user?.email === 'superadmin@caliloops.com' ? !!selectedStoreId : !!user?.storeId;

  const totalPages = Math.ceil(totalSkus / pageSize);
  const startItem = totalSkus > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalSkus);
  
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
                                        Select a date range to export the SKU data. This is currently disabled with pagination.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                   <p className="text-sm text-muted-foreground">The ability to export all SKUs is temporarily disabled for performance reasons. This feature will be re-enabled in a future update.</p>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsExportModalOpen(false)}>Cancel</Button>
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
                            onChange={handleSearchChange}
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
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : skus.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            No SKUs found. Create a new SKU or adjust filters to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    skus.map((sku) => (
                                        <TableRow key={sku.id}>
                                            <TableCell>
                                                {sku.imageUrl ? (
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <div className="w-12 h-12 relative cursor-pointer">
                                                                <Image src={sku.imageUrl} alt={sku.skuName} fill objectFit="cover" className="rounded-md" />
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
                                                <Button variant="outline" size="sm" onClick={() => onViewDetails(sku)}>
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
                        Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of <strong>{totalSkus}</strong> SKUs
                    </div>
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious onClick={() => onPageChange('prev')} aria-disabled={currentPage === 1} />
                            </PaginationItem>
                            {/* Full pagination UI is complex with cursor-based pagination. This is a simplified version. */}
                             <PaginationItem>
                                <span className="p-2 text-sm">Page {currentPage} of {totalPages}</span>
                             </PaginationItem>
                            <PaginationItem>
                                <PaginationNext onClick={() => onPageChange('next')} aria-disabled={endItem >= totalSkus} />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </CardFooter>
            </Card>
        </div>
        <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
            <DialogContent className='max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>Import Summary</DialogTitle>
                    <DialogDescription>
                        Review the summary of your CSV file before uploading. Duplicates cannot be checked on the client with pagination.
                    </DialogDescription>
                </DialogHeader>
                {importSummary ? (
                     <div className="space-y-4 py-4">
                        <Accordion type="single" collapsible className="w-full">
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
                         {importSummary.newSkus.length === 0 && (
                            <Alert variant="destructive" className='mt-4'>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>No New SKUs to Import</AlertTitle>
                                <AlertDescription>
                                    All rows in your file might have errors or are empty.
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

// Simple debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<F>): void => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
}
