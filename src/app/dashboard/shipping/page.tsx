
'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { UserContext } from '@/app/dashboard/layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter as ShadcnTableFooter,
  } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  Ship,
  AlertTriangle,
  CalendarIcon,
  Search,
  PlusCircle,
  X,
  MoreHorizontal,
  Edit,
  Trash2,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import type { Shipping, PurchaseOrder, Courier } from '@/lib/types';
import {
    addShipping,
    updateShipping,
    deleteShipping,
    subscribeToShipping,
} from '@/lib/services/shippingService';
import { 
    findPOsByTrackingNumbers,
    updatePOStatusAndShippingCost,
 } from '@/lib/services/purchaseOrderService';
import { subscribeToCouriers } from '@/lib/services/courierService';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

const TrackingNumberInput = ({ value, onChange, disabled }: { value: string[], onChange: (value: string[]) => void, disabled?: boolean }) => {
    const [inputValue, setInputValue] = React.useState('');
  
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const newTag = inputValue.trim();
        if (newTag && !(value || []).includes(newTag)) {
          onChange([...(value || []), newTag]);
        }
        setInputValue('');
      }
    };
  
    const removeTag = (tagToRemove: string) => {
      onChange(value.filter(tag => tag !== tagToRemove));
    };
  
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-input p-2">
        {(value || []).map(tag => (
          <Badge key={tag} variant="secondary" className="flex items-center gap-1">
            {tag}
            {!disabled && (
                <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-full hover:bg-destructive/20"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
          </Badge>
        ))}
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={!value || value.length === 0 ? "Type and press space..." : ""}
          className="h-auto flex-grow border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
          disabled={disabled}
        />
      </div>
    );
};


const ROWS_PER_PAGE = 5;

export default function ShippingPage() {
  const { toast } = useToast();
  const { user, permissions, selectedStoreId } = React.useContext(UserContext);
  const storeId = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

  // Modal and Form State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [currentShipping, setCurrentShipping] = React.useState<Partial<Shipping> | null>(null);
  
  // Data state
  const [couriers, setCouriers] = React.useState<Courier[]>([]);
  const [shippingHistory, setShippingHistory] = React.useState<Shipping[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);

  // Aggregation state
  const [isCheckingPOs, setIsCheckingPOs] = React.useState(false);
  const [linkedPOs, setLinkedPOs] = React.useState<PurchaseOrder[]>([]);
  const [aggregatedData, setAggregatedData] = React.useState<{ totalPcs: number, totalRmb: number, photoUrls: string[] } | null>(null);

  // Submission state
  const [isSaving, setIsSaving] = React.useState(false);
  
  // Pagination & Search
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState('');


  // Delete confirmation
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [shippingToDelete, setShippingToDelete] = React.useState<Shipping | null>(null);

  React.useEffect(() => {
    if (!storeId) {
        setCouriers([]);
        setShippingHistory([]);
        setLoadingHistory(false);
        return;
    }
    const unsubCouriers = subscribeToCouriers(storeId, setCouriers, (err) => toast({title: "Error fetching couriers"}));
    
    setLoadingHistory(true);
    const unsubShipping = subscribeToShipping(storeId, (data) => {
        setShippingHistory(data);
        setLoadingHistory(false);
    }, (err) => {
        toast({title: "Error fetching shipping history"});
        setLoadingHistory(false);
    });

    return () => {
        unsubCouriers();
        unsubShipping();
    }
  }, [storeId, toast]);

  const resetForm = () => {
    setCurrentShipping(null);
    setLinkedPOs([]);
    setAggregatedData(null);
    setIsModalOpen(false);
  };
  
  const openModal = (shipping: Shipping | null = null) => {
    if (shipping) {
        setCurrentShipping({
            ...shipping,
            tanggalStokDiterima: shipping.tanggalStokDiterima ? (shipping.tanggalStokDiterima as any).toDate() : undefined,
            paidDate: shipping.paidDate ? (shipping.paidDate as any).toDate() : undefined
        });
        if (shipping.linkedPoNumbers && shipping.linkedPoNumbers.length > 0) {
            handleCheckPOs(shipping.noResi, shipping.linkedPoNumbers);
        }
    } else {
        setCurrentShipping({ noResi: [], jumlahKoli: '' as any, harga: '' as any, status: 'SHIPPING', isPaid: false });
    }
    setIsModalOpen(true);
  }

  const handleInputChange = (field: keyof Shipping, value: any) => {
    setCurrentShipping(prev => (prev ? { ...prev, [field]: value } : null));
  };


  const handleCheckPOs = async (resiToCheck?: string[], poNumbers?: string[]) => {
    const noResi = resiToCheck || currentShipping?.noResi;
    if (!storeId || !noResi || noResi.length === 0) {
        toast({ title: 'Please provide at least one tracking number (No Resi).', variant: 'destructive' });
        return;
    }
    setIsCheckingPOs(true);
    setLinkedPOs([]);
    setAggregatedData(null);

    try {
        const foundPOs = await findPOsByTrackingNumbers(storeId, noResi);
        
        if (foundPOs.length === 0) {
            toast({ title: 'No matching Purchase Orders found for the provided tracking numbers.' });
        } else {
            setLinkedPOs(foundPOs);
            const totalPcs = foundPOs.reduce((acc, po) => acc + (po.totalPcs || 0), 0);
            const totalRmb = foundPOs.reduce((acc, po) => acc + (po.totalRmb || 0), 0);
            const photoUrls = foundPOs.map(po => po.photoUrl).filter(Boolean) as string[];
            setAggregatedData({ totalPcs, totalRmb, photoUrls });
            toast({ title: `${foundPOs.length} PO(s) found and linked.` });
        }
    } catch (error) {
        console.error("Error checking POs:", error);
        toast({ title: 'An error occurred while checking for POs.', variant: 'destructive' });
    } finally {
        setIsCheckingPOs(false);
    }
  };
  
  const handleSubmit = async () => {
    if (!storeId || !currentShipping || !currentShipping.marking || currentShipping.jumlahKoli === undefined || currentShipping.jumlahKoli === null || linkedPOs.length === 0) {
        toast({ title: 'Marking, Jumlah Koli, and at least one linked PO are required.', variant: 'destructive' });
        return;
    }
    
    if (!permissions?.canManageShipping && !permissions?.hasFullAccess) {
        toast({ title: 'Permission Denied', variant: 'destructive' });
        return;
    }

    setIsSaving(true);
    try {
        const firstPo = linkedPOs[0];
        const costPerPieceFromPO = firstPo?.costPerPiece || 0;

        const { id, ...shippingData} = currentShipping;

        const dataToSave: Omit<Shipping, 'id' | 'createdAt'> = {
            storeId,
            marking: shippingData.marking!,
            kodeStorage: shippingData.kodeStorage || '',
            kodeKontainer: shippingData.kodeKontainer || '',
            jumlahKoli: Number(shippingData.jumlahKoli),
            noResi: shippingData.noResi || [],
            tanggalStokDiterima: shippingData.tanggalStokDiterima ? Timestamp.fromDate(new Date(shippingData.tanggalStokDiterima)) : null,
            harga: shippingData.harga === '' || shippingData.harga === undefined ? 0 : Number(shippingData.harga),
            linkedPoNumbers: linkedPOs.map(po => po.poNumber),
            calculatedTotalPcs: aggregatedData?.totalPcs || 0,
            calculatedTotalRmb: aggregatedData?.totalRmb || 0,
            combinedPhotoLink: aggregatedData?.photoUrls.join('\n') || '',
            costPerPiece: costPerPieceFromPO,
            status: shippingData.status || 'SHIPPING',
            isPaid: shippingData.isPaid || false,
            paidDate: shippingData.paidDate ? Timestamp.fromDate(new Date(shippingData.paidDate)) : null,
            createdBy: user?.name || 'Unknown User',
        };

        if (id) {
            await updateShipping(id, dataToSave);
        } else {
            await addShipping(dataToSave);
        }

        const linkedPoIds = linkedPOs.map(po => po.id);
        const shippingCostPerPo = linkedPoIds.length > 0 && currentShipping.harga && currentShipping.harga !== '' ? Number(currentShipping.harga) / linkedPoIds.length : 0;
        
        if (shippingCostPerPo > 0) {
            await updatePOStatusAndShippingCost(linkedPoIds, shippingCostPerPo);
        }

        toast({ title: `Shipping Data ${id ? 'Updated' : 'Saved'} Successfully!`, description: `${linkedPOs.length} PO(s) have been updated.` });
        resetForm();

    } catch (error) {
        console.error("Error saving shipping data:", error);
        toast({ title: `Failed to ${id ? 'update' : 'save'} shipping data.`, variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }

  const openDeleteDialog = (shipping: Shipping) => {
    setShippingToDelete(shipping);
    setIsDeleteAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!shippingToDelete) return;
    try {
      await deleteShipping(shippingToDelete.id);
      toast({ title: 'Shipping entry deleted successfully' });
      setIsDeleteAlertOpen(false);
      setShippingToDelete(null);
    } catch (error) {
      toast({ title: 'Error deleting shipping entry', variant: 'destructive' });
    }
  };
  
  const canPerformActions = user?.email === 'superadmin@caliloops.com' ? !!selectedStoreId : !!user?.storeId;
  const isFormDisabled = isSaving || isCheckingPOs;

  const filteredHistory = React.useMemo(() => {
    if (!searchTerm) {
      return shippingHistory;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return shippingHistory.filter(item => {
      const hasMatchingResi = item.noResi.some(resi => resi.toLowerCase().includes(lowercasedTerm));
      const hasMatchingStorage = item.kodeStorage?.toLowerCase().includes(lowercasedTerm);
      const hasMatchingKontainer = item.kodeKontainer?.toLowerCase().includes(lowercasedTerm);
      return hasMatchingResi || hasMatchingStorage || hasMatchingKontainer;
    });
  }, [shippingHistory, searchTerm]);


  const totalPages = Math.ceil(filteredHistory.length / ROWS_PER_PAGE);
  const paginatedHistory = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return filteredHistory.slice(startIndex, endIndex);
  }, [filteredHistory, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ship /> Shipping Company Entry
            </h1>
            <p className="text-muted-foreground">
            Input shipping data which will be automatically linked to Purchase Orders.
            </p>
        </div>
         {(permissions?.canManageShipping || permissions?.hasFullAccess) && (
             <Dialog open={isModalOpen} onOpenChange={(open) => { if(open) setIsModalOpen(true); else resetForm(); }}>
                <DialogTrigger asChild>
                    <Button disabled={!canPerformActions}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New Shipping Entry
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                     <DialogHeader>
                        <DialogTitle>{currentShipping?.id ? 'Edit' : 'New'} Shipping Entry</DialogTitle>
                        <DialogDescription>{currentShipping?.id ? 'Update the details for this shipment.' : 'Fill in the form to record a new shipment.'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-6">
                        {/* Section 1 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="marking">Marking</Label>
                                <Select value={currentShipping?.marking || ''} onValueChange={(val) => handleInputChange('marking', val)} disabled={isFormDisabled}>
                                    <SelectTrigger id="marking"><SelectValue placeholder="Select Marking" /></SelectTrigger>
                                    <SelectContent>{couriers.map(c => <SelectItem key={c.id} value={c.marking}>{c.marking} ({c.name})</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="jumlahKoli">Jumlah Koli</Label>
                                <Input id="jumlahKoli" type="number" value={currentShipping?.jumlahKoli || ''} onChange={e => handleInputChange('jumlahKoli', e.target.value === '' ? '' : Number(e.target.value))} disabled={isFormDisabled} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="kodeStorage">Kode Storage</Label>
                                <Input id="kodeStorage" value={currentShipping?.kodeStorage || ''} onChange={e => handleInputChange('kodeStorage', e.target.value)} disabled={isFormDisabled} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="kodeKontainer">Kode Kontainer</Label>
                                <Input id="kodeKontainer" value={currentShipping?.kodeKontainer || ''} onChange={e => handleInputChange('kodeKontainer', e.target.value)} disabled={isFormDisabled} />
                            </div>
                        </div>

                         {/* Section 2 */}
                         <div className="grid grid-cols-1 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="noResi">No. Resi</Label>
                                <TrackingNumberInput value={currentShipping?.noResi || []} onChange={(val) => handleInputChange('noResi', val)} disabled={isFormDisabled} />
                                <Button type="button" onClick={() => handleCheckPOs()} disabled={isFormDisabled || !currentShipping?.noResi || currentShipping.noResi.length === 0} className="mt-2 w-fit">
                                    {isCheckingPOs ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Mencari...</> : <><Search className="mr-2 h-4 w-4"/> Cari PO</>}
                                </Button>
                            </div>
                        </div>
                        
                        {/* Section 3 - Auto Aggregated Data */}
                        {aggregatedData && (
                            <Card className="bg-muted/50">
                                <CardHeader><CardTitle className="text-lg">Informasi PO Terkait</CardTitle></CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No PO</TableHead>
                                                <TableHead className="text-right">Jumlah Pcs</TableHead>
                                                <TableHead className="text-right">Jumlah RMB</TableHead>
                                                <TableHead className="text-right">Cost per Pcs</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {linkedPOs.map(po => (
                                                <TableRow key={po.id}>
                                                    <TableCell className="font-medium">{po.poNumber}</TableCell>
                                                    <TableCell className="text-right">{(po.totalPcs || 0).toLocaleString()}</TableCell>
                                                    <TableCell className="text-right">{(po.totalRmb || 0).toLocaleString('zh-CN')}</TableCell>
                                                    <TableCell className="text-right">{(po.costPerPiece || 0).toLocaleString('id-ID', {style: 'currency', currency: 'IDR'})}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                        <ShadcnTableFooter>
                                            <TableRow className="bg-muted/80 font-medium">
                                                <TableCell>Total</TableCell>
                                                <TableCell className="text-right">{aggregatedData.totalPcs.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{aggregatedData.totalRmb.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</TableCell>
                                                <TableCell></TableCell> 
                                            </TableRow>
                                        </ShadcnTableFooter>
                                    </Table>
                                    <div className="pt-4">
                                        <div className="font-medium truncate">Link Foto (Auto): <a href={aggregatedData.photoUrls[0]} target='_blank' rel='noopener noreferrer' className="font-normal text-blue-500 hover:underline">{aggregatedData.photoUrls.join(', ')}</a></div>
                                    </div>
                                    <div className="font-medium">
                                      Cost per Pcs (from PO):
                                      <span className="font-normal text-muted-foreground ml-2">
                                        {(linkedPOs[0]?.costPerPiece || 0).toLocaleString('id-ID', {style: 'currency', currency: 'IDR'})}
                                      </span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        
                        {/* Section 4 - Admin Input */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t pt-6">
                            <div className="grid gap-2">
                                <Label htmlFor="status">Status</Label>
                                <Select value={currentShipping?.status || 'SHIPPING'} onValueChange={(val) => handleInputChange('status', val)} disabled={isFormDisabled}>
                                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SHIPPING">Shipping</SelectItem>
                                        <SelectItem value="RECEIVED">Received</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="tanggalStok">Received Date</Label>
                                <Popover><PopoverTrigger asChild>
                                    <Button variant={'outline'} className={cn('justify-start text-left font-normal', !currentShipping?.tanggalStokDiterima && 'text-muted-foreground')} disabled={isFormDisabled}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {currentShipping?.tanggalStokDiterima ? format(new Date(currentShipping.tanggalStokDiterima), 'PPP') : <span>Pilih tanggal</span>}
                                    </Button>
                                </PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={currentShipping?.tanggalStokDiterima ? new Date(currentShipping.tanggalStokDiterima) : undefined} onSelect={(date) => handleInputChange('tanggalStokDiterima', date)} initialFocus /></PopoverContent></Popover>
                            </div>
                             <div className="grid gap-2">
                                <Label htmlFor="harga">Harga (Ongkir)</Label>
                                <Input id="harga" type="number" value={currentShipping?.harga || ''} onChange={e => handleInputChange('harga', e.target.value === '' ? '' : Number(e.target.value))} disabled={isFormDisabled} placeholder='dalam IDR' />
                            </div>
                             <div className="flex items-center space-x-2 pt-6">
                                <Checkbox id="isPaid" checked={currentShipping?.isPaid} onCheckedChange={(checked) => handleInputChange('isPaid', checked)} disabled={isFormDisabled}/>
                                <Label htmlFor="isPaid">Paid</Label>
                            </div>
                             <div className="grid gap-2">
                                <Label htmlFor="paidDate">Paid Date</Label>
                                <Popover><PopoverTrigger asChild>
                                    <Button variant={'outline'} className={cn('justify-start text-left font-normal', !currentShipping?.paidDate && 'text-muted-foreground')} disabled={isFormDisabled}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {currentShipping?.paidDate ? format(new Date(currentShipping.paidDate), 'PPP') : <span>Pilih tanggal</span>}
                                    </Button>
                                </PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={currentShipping?.paidDate ? new Date(currentShipping.paidDate) : undefined} onSelect={(date) => handleInputChange('paidDate', date)} initialFocus /></PopoverContent></Popover>
                            </div>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm} disabled={isFormDisabled}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={isFormDisabled || (currentShipping?.id ? false : linkedPOs.length === 0)}>
                            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : `Save Shipping Data`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
             </Dialog>
         )}
      </div>

       {!storeId && (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Store Selected</AlertTitle>
                <AlertDescription>
                    {user?.role?.name === 'Shipping Company' 
                    ? "You are not assigned to a store. Please contact an administrator."
                    : "Please select a store from the header dropdown to manage shipping."
                    }
                </AlertDescription>
            </Alert>
       )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Shipping History</CardTitle>
              <CardDescription>A log of all previously recorded shipments for this store.</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by Resi, Storage, or Kontainer..."
                className="w-full pl-8 sm:w-[300px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marking</TableHead>
                  <TableHead>Kode Storage</TableHead>
                  <TableHead>Kode Kontainer</TableHead>
                  <TableHead>No Resi</TableHead>
                  <TableHead>Biaya (IDR)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingHistory ? (
                  <TableRow><TableCell colSpan={10} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                ) : paginatedHistory.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="h-24 text-center">No shipping history found.</TableCell></TableRow>
                ) : (
                  paginatedHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.marking}</TableCell>
                      <TableCell>{item.kodeStorage}</TableCell>
                      <TableCell>{item.kodeKontainer}</TableCell>
                      <TableCell className="whitespace-pre-wrap max-w-xs">{Array.isArray(item.noResi) ? item.noResi.join(', ') : item.noResi}</TableCell>
                      <TableCell>{item.harga.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</TableCell>
                      <TableCell><Badge variant={item.status === 'SHIPPING' ? 'info' : 'success'}>{item.status}</Badge></TableCell>
                      <TableCell>{item.tanggalStokDiterima ? format(item.tanggalStokDiterima.toDate(), 'dd MMM yyyy') : 'N/A'}</TableCell>
                      <TableCell>{item.isPaid ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{item.paidDate ? format(item.paidDate.toDate(), 'dd MMM yyyy') : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                          {(permissions?.canManageShipping || permissions?.hasFullAccess) && (
                              <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                          <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                      <DropdownMenuItem onSelect={() => openModal(item)}>
                                          <Edit className="mr-2 h-4 w-4" /> Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive" onSelect={() => openDeleteDialog(item)}>
                                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                                      </DropdownMenuItem>
                                  </DropdownMenuContent>
                              </DropdownMenu>
                          )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between pt-6">
                 <div className="text-sm text-muted-foreground">
                    Showing <strong>{Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filteredHistory.length)}</strong> to <strong>{Math.min(currentPage * ROWS_PER_PAGE, filteredHistory.length)}</strong> of <strong>{filteredHistory.length}</strong> entries
                </div>
                <Pagination>
                    <PaginationContent>
                        <PaginationItem><PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} aria-disabled={currentPage === 1}/></PaginationItem>
                         <PaginationItem><span className="p-2 text-sm">Page {currentPage} of {totalPages}</span></PaginationItem>
                        <PaginationItem><PaginationNext onClick={() => handlePageChange(currentPage + 1)} aria-disabled={currentPage === totalPages} /></PaginationItem>
                    </PaginationContent>
                </Pagination>
            </CardFooter>
        )}
      </Card>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the shipping entry with marking "{shippingToDelete?.marking}".
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
