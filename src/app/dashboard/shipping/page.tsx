
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
import { Textarea } from '@/components/ui/textarea';
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
import {
  Loader2,
  Ship,
  AlertTriangle,
  CalendarIcon,
  Search,
  PlusCircle,
  X,
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
import type { Shipping, PurchaseOrder, Courier } from '@/lib/types';
import {
    addShipping,
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
        if (newTag && !value.includes(newTag)) {
          onChange([...value, newTag]);
        }
        setInputValue('');
      }
    };
  
    const removeTag = (tagToRemove: string) => {
      onChange(value.filter(tag => tag !== tagToRemove));
    };
  
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-input p-2">
        {value.map(tag => (
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
          placeholder={value.length === 0 ? "Type and press space..." : ""}
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
  const [marking, setMarking] = React.useState('');
  const [kodeStorage, setKodeStorage] = React.useState('');
  const [kodeKontainer, setKodeKontainer] = React.useState('');
  const [jumlahKoli, setJumlahKoli] = React.useState<number | ''>('');
  const [noResi, setNoResi] = React.useState<string[]>([]);
  const [tanggalStokDiterima, setTanggalStokDiterima] = React.useState<Date | undefined>();
  const [harga, setHarga] = React.useState<number | ''>('');
  
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
  
  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1);

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
    setMarking('');
    setKodeStorage('');
    setKodeKontainer('');
    setJumlahKoli('');
    setNoResi([]);
    setTanggalStokDiterima(undefined);
    setHarga('');
    setLinkedPOs([]);
    setAggregatedData(null);
    setIsModalOpen(false);
  };

  const handleCheckPOs = async () => {
    if (!storeId || noResi.length === 0) {
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
    if (!storeId || !marking || !tanggalStokDiterima || harga === '' || jumlahKoli === '' || linkedPOs.length === 0 || !aggregatedData) {
        toast({ title: 'Please fill all required fields and link to at least one PO.', variant: 'destructive' });
        return;
    }
    
    if (!permissions?.canManageShipping && !permissions?.hasFullAccess) {
        toast({ title: 'Permission Denied', variant: 'destructive' });
        return;
    }

    setIsSaving(true);
    try {
        const firstPoCostPerPiece = linkedPOs.length > 0 ? (linkedPOs[0].costPerPiece || 0) : 0;

        const shippingData: Omit<Shipping, 'id' | 'createdAt'> = {
            storeId,
            marking,
            kodeStorage: kodeStorage || '',
            kodeKontainer: kodeKontainer || '',
            jumlahKoli: Number(jumlahKoli),
            noResi: noResi,
            tanggalStokDiterima: Timestamp.fromDate(tanggalStokDiterima),
            harga: Number(harga),
            linkedPoNumbers: linkedPOs.map(po => po.poNumber),
            calculatedTotalPcs: aggregatedData.totalPcs,
            calculatedTotalRmb: aggregatedData.totalRmb,
            combinedPhotoLink: aggregatedData.photoUrls.join('\n'),
            costPerPiece: firstPoCostPerPiece,
            createdBy: user?.name || 'Unknown User',
        };

        await addShipping(shippingData);

        const linkedPoIds = linkedPOs.map(po => po.id);
        const shippingCostPerPo = Number(harga) / linkedPoIds.length;
        await updatePOStatusAndShippingCost(linkedPoIds, shippingCostPerPo);

        toast({ title: 'Shipping Data Saved Successfully!', description: `${linkedPOs.length} PO(s) have been updated.` });
        resetForm();

    } catch (error) {
        console.error("Error saving shipping data:", error);
        toast({ title: 'Failed to save shipping data.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }
  
  const canPerformActions = user?.email === 'superadmin@caliloops.com' ? !!selectedStoreId : !!user?.storeId;
  const isFormDisabled = isSaving || isCheckingPOs;

  const totalPages = Math.ceil(shippingHistory.length / ROWS_PER_PAGE);
  const paginatedHistory = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return shippingHistory.slice(startIndex, endIndex);
  }, [shippingHistory, currentPage]);

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
         {canPerformActions && (
             <Dialog open={isModalOpen} onOpenChange={(open) => { if(open) setIsModalOpen(true); else resetForm(); }}>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New Shipping Entry
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                     <DialogHeader>
                        <DialogTitle>New Shipping Entry</DialogTitle>
                        <DialogDescription>Fill in the form to record a new shipment.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="marking">Marking</Label>
                                <Select value={marking} onValueChange={setMarking} disabled={isFormDisabled}>
                                    <SelectTrigger id="marking"><SelectValue placeholder="Select Marking" /></SelectTrigger>
                                    <SelectContent>{couriers.map(c => <SelectItem key={c.id} value={c.marking}>{c.marking} ({c.name})</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="kodeStorage">Kode Storage</Label>
                                <Input id="kodeStorage" value={kodeStorage} onChange={e => setKodeStorage(e.target.value)} disabled={isFormDisabled} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="kodeKontainer">Kode Kontainer</Label>
                                <Input id="kodeKontainer" value={kodeKontainer} onChange={e => setKodeKontainer(e.target.value)} disabled={isFormDisabled} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="jumlahKoli">Jumlah Koli</Label>
                                <Input id="jumlahKoli" type="number" value={jumlahKoli} onChange={e => setJumlahKoli(e.target.value === '' ? '' : Number(e.target.value))} disabled={isFormDisabled} />
                            </div>
                        </div>

                         <div className="grid grid-cols-1 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="noResi">No. Resi</Label>
                                <TrackingNumberInput value={noResi} onChange={setNoResi} disabled={isFormDisabled} />
                                <Button type="button" onClick={handleCheckPOs} disabled={isFormDisabled || noResi.length === 0} className="mt-2 w-fit">
                                    {isCheckingPOs ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Mencari...</> : <><Search className="mr-2 h-4 w-4"/> Cari PO</>}
                                </Button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="tanggalStok">Tgl Stok Diterima</Label>
                                <Popover><PopoverTrigger asChild>
                                    <Button variant={'outline'} className={cn('justify-start text-left font-normal', !tanggalStokDiterima && 'text-muted-foreground')} disabled={isFormDisabled}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {tanggalStokDiterima ? format(tanggalStokDiterima, 'PPP') : <span>Pilih tanggal</span>}
                                    </Button>
                                </PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={tanggalStokDiterima} onSelect={setTanggalStokDiterima} initialFocus /></PopoverContent></Popover>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="harga">Harga (Ongkir)</Label>
                                <Input id="harga" type="number" value={harga} onChange={e => setHarga(e.target.value === '' ? '' : Number(e.target.value))} disabled={isFormDisabled} placeholder='dalam IDR' />
                            </div>
                        </div>


                        {/* Aggregated Data Display */}
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
                                </CardContent>
                            </Card>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm} disabled={isFormDisabled}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={isFormDisabled || linkedPOs.length === 0}>
                            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : 'Save Shipping Data'}
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

      {/* Shipping History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Shipping History</CardTitle>
          <CardDescription>A log of all previously recorded shipments for this store.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marking</TableHead>
                <TableHead>Kode Storage/Kontainer</TableHead>
                <TableHead>Jumlah Koli</TableHead>
                <TableHead>Tanggal Diterima</TableHead>
                <TableHead>No Resi</TableHead>
                <TableHead>Biaya (IDR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistory ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
              ) : paginatedHistory.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">No shipping history found.</TableCell></TableRow>
              ) : (
                paginatedHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.marking}</TableCell>
                    <TableCell>{item.kodeStorage || 'N/A'} / {item.kodeKontainer || 'N/A'}</TableCell>
                    <TableCell>{item.jumlahKoli}</TableCell>
                    <TableCell>{format(item.tanggalStokDiterima.toDate(), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="whitespace-pre-wrap max-w-xs">{Array.isArray(item.noResi) ? item.noResi.join(', ') : item.noResi}</TableCell>
                    <TableCell>{item.harga.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between pt-6">
                 <div className="text-sm text-muted-foreground">
                    Showing <strong>{Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, shippingHistory.length)}</strong> to <strong>{Math.min(currentPage * ROWS_PER_PAGE, shippingHistory.length)}</strong> of <strong>{shippingHistory.length}</strong> entries
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
    </div>
  );
}

    