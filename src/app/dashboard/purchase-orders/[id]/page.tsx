
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { UserContext } from '@/app/dashboard/layout';
import type { PurchaseOrder, Supplier, Courier, Refund } from '@/lib/types';
import { getPurchaseOrderWithDetails, addOrUpdatePurchaseOrder } from '@/lib/services/purchaseOrderService';
import { subscribeToSuppliers } from '@/lib/services/supplierService';
import { subscribeToCouriers } from '@/lib/services/courierService';
import { getPOItems, bulkUpdatePOItems } from '@/lib/services/purchaseOrderItemService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Loader2,
  CalendarIcon,
  AlertTriangle,
  FileText,
  X,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { NumericInput } from '@/components/ui/numeric-input';

// Tracking Number Tag Input Component
const TrackingNumberInput = ({ value, onChange, disabled }: { value: string[], onChange: (value: string[]) => void, disabled?: boolean }) => {
    const [inputValue, setInputValue] = React.useState('');
  
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const newTag = inputValue.trim();
        const currentValue = Array.isArray(value) ? value : [];
        if (newTag && !currentValue.includes(newTag)) {
          onChange([...currentValue, newTag]);
        }
        setInputValue('');
      }
    };
  
    const removeTag = (tagToRemove: string) => {
      onChange(value.filter(tag => tag !== tagToRemove));
    };
  
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-input p-2">
        {(Array.isArray(value) ? value : []).map(tag => (
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


export default function PurchaseOrderFormPage() {
  const { id: poId } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, permissions, selectedStoreId } = React.useContext(UserContext);
  
  const [po, setPo] = React.useState<Partial<PurchaseOrder> | null>(null);
  const [originalCostPerPiece, setOriginalCostPerPiece] = React.useState<number>(0);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [couriers, setCouriers] = React.useState<Courier[]>([]);

  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const storeId = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;
  const isNew = poId === 'new';

  React.useEffect(() => {
    if (!storeId) {
        setLoading(false);
        return;
    }

    const fetchPO = async () => {
        if (!isNew && typeof poId === 'string') {
            try {
                const fetchedPo = await getPurchaseOrderWithDetails(poId);
                if (fetchedPo) {
                    setPo(fetchedPo);
                    setOriginalCostPerPiece(fetchedPo.costPerPiece || 0);
                } else {
                    toast({ title: 'Purchase Order not found', variant: 'destructive' });
                    router.push('/dashboard/purchase-orders');
                }
            } catch (error) {
                console.error("Error fetching PO with details:", error);
                toast({ title: 'Error fetching PO', variant: 'destructive' });
            }
        } else {
            setPo({ orderDate: Timestamp.now(), trackingNumber: [], status: 'INPUTTED' });
            setOriginalCostPerPiece(0);
        }
        setLoading(false);
    };

    const unsubSuppliers = subscribeToSuppliers(storeId, setSuppliers, (err) => { console.error(err); toast({ title: 'Error fetching suppliers', variant: 'destructive'}); });
    const unsubCouriers = subscribeToCouriers(storeId, setCouriers, (err) => { console.error(err); toast({ title: 'Error fetching couriers', variant: 'destructive'}); });

    fetchPO();

    return () => {
        unsubSuppliers();
        unsubCouriers();
    };

  }, [poId, storeId, toast, router, isNew]);

  const handleInputChange = (field: keyof PurchaseOrder, value: any) => {
    setPo(prevPo => {
        if (!prevPo) return null;

        let updatedPo = { ...prevPo, [field]: value };

        // Handle numeric fields
        if (['totalRmb', 'exchangeRate', 'qtyReceived', 'qtyNotReceived', 'qtyDamaged', 'totalPembelianIdr', 'packageCount'].includes(field as string)) {
            const numValue = Number(value);
            updatedPo[field as 'totalRmb'] = isNaN(numValue) ? 0 : numValue;
        }

        // Auto-calculate totalPcs when receiving quantities change
        if (['qtyReceived', 'qtyNotReceived', 'qtyDamaged'].includes(field as string)) {
            updatedPo.totalPcs = (updatedPo.qtyReceived || 0) + (updatedPo.qtyNotReceived || 0) + (updatedPo.qtyDamaged || 0);
        }

        return updatedPo;
    });
  };
  
  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (po && supplier) {
        setPo({ 
            ...po, 
            supplierId: supplierId,
            supplierName: supplier.name,
            supplierCode: supplier.supplierCode,
            chatSearch: supplier.chatSearchName || '',
        });
    }
  }


  const handleSave = async () => {
    if (!po || !storeId || !po.poNumber || !po.supplierId || !po.orderDate) {
      toast({ title: 'Please fill all required fields', description: "PO Number, Supplier and Order Date are mandatory.", variant: 'destructive' });
      return;
    }

    if (!permissions?.canManagePurchaseOrders && !permissions?.hasFullAccess) {
        toast({ title: "Permission Denied", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    try {
      const supplier = suppliers.find(s => s.id === po.supplierId);

      let dataToSave: Partial<PurchaseOrder> = {
        ...po,
        storeId,
        supplierName: supplier?.name || '',
        supplierCode: supplier?.supplierCode || '',
      };

      await addOrUpdatePurchaseOrder(dataToSave as any);

      // If costPerPiece changed, update all PO items
      const newCostPerPiece = po.costPerPiece || 0;
      if (!isNew && newCostPerPiece !== originalCostPerPiece && typeof poId === 'string') {
        try {
          const items = await getPOItems(poId);
          if (items.length > 0) {
            const itemsToUpdate = items.map((item) => ({
              id: item.id,
              data: {
                costPerPcs: newCostPerPiece,
                modalBarang: item.hargaBarang + newCostPerPiece,
              },
            }));
            await bulkUpdatePOItems(itemsToUpdate);
            toast({ title: 'PO & Items Updated Successfully!', description: `Updated ${items.length} items with new cost per pcs` });
          } else {
            toast({ title: 'PO Updated Successfully!' });
          }
        } catch (error) {
          console.error('Error updating PO items:', error);
          toast({ title: 'PO updated but failed to update items', variant: 'destructive' });
        }
      } else {
        toast({ title: isNew ? 'PO Created Successfully!' : 'PO Updated Successfully!' });
      }

      router.push('/dashboard/purchase-orders');
    } catch (error) {
      console.error(error);
      toast({ title: 'Error saving Purchase Order', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };


  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }
  
  if (!storeId) {
      return (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No Store Selected</AlertTitle>
            <AlertDescription>You must select a store to manage Purchase Orders. Go back to the dashboard and select a store from the header.</AlertDescription>
         </Alert>
      );
  }

  if (!po) {
    return <p>No Purchase Order data available.</p>;
  }

  return (
    <div className="space-y-6">
       <Button variant="outline" onClick={() => router.back()} className="w-fit">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to PO Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText />
            {isNew ? 'Create New Purchase Order' : `Edit Purchase Order: ${po.poNumber}`}
          </CardTitle>
          <CardDescription>
            {isNew ? 'Fill in the details to create a new PO.' : 'Update the details for this PO.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Main Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="grid gap-2"><Label htmlFor="poNumber">PO Number</Label><Input id="poNumber" value={po.poNumber || ''} onChange={(e) => handleInputChange('poNumber', e.target.value)} /></div>
                    <div className="grid gap-2"><Label htmlFor="orderDate">Order Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={'outline'} className={cn('justify-start text-left font-normal', !po.orderDate && 'text-muted-foreground')}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {po.orderDate ? format((po.orderDate as any).toDate(), 'PPP') : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={(po.orderDate as any)?.toDate()} onSelect={(date) => handleInputChange('orderDate', date ? Timestamp.fromDate(date) : null)} initialFocus /></PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid gap-2"><Label htmlFor="orderNumber">Order No.</Label><Input id="orderNumber" value={po.orderNumber || ''} onChange={(e) => handleInputChange('orderNumber', e.target.value)} /></div>
                    <div className="grid gap-2"><Label htmlFor="supplierId">Supplier</Label>
                        <Select value={po.supplierId || ''} onValueChange={handleSupplierChange}>
                            <SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger>
                            <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2"><Label>Supplier Code</Label><Input value={po.supplierId ? (suppliers.find(s => s.id === po.supplierId)?.supplierCode || '') : ''} disabled /></div>
                    <div className="grid gap-2 col-span-1 md:col-span-2"><Label>Supplier Description</Label><Input value={po.supplierId ? (suppliers.find(s => s.id === po.supplierId)?.description || '') : ''} disabled /></div>
                    <div className="grid gap-2"><Label htmlFor="chatSearch">Chat Search</Label><Input id="chatSearch" value={po.chatSearch || ''} onChange={(e) => handleInputChange('chatSearch', e.target.value)} /></div>
                    
                    {permissions?.hasFullAccess && !isNew && (
                        <div className="grid gap-2">
                            <Label htmlFor="status">Status</Label>
                            <Select onValueChange={(value) => handleInputChange('status', value)} value={po.status}>
                                <SelectTrigger id="status">
                                    <SelectValue placeholder={po.status || 'Set status'} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DONE">Done</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>
            <Separator />
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Financial Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="totalPcs">Total Pcs</Label>
                        <div className='h-10 flex items-center px-3 text-sm font-semibold border rounded-md bg-muted/50'>
                            {((po.qtyReceived || 0) + (po.qtyNotReceived || 0) + (po.qtyDamaged || 0)) || 0}
                        </div>
                    </div>
                    <div className="grid gap-2"><Label htmlFor="totalRmb">Total RMB</Label><NumericInput id="totalRmb" value={po.totalRmb || 0} onValueChange={(value) => handleInputChange('totalRmb', value)} /></div>
                    <div className="grid gap-2"><Label htmlFor="exchangeRate">Kurs</Label><NumericInput id="exchangeRate" value={po.exchangeRate || 0} onValueChange={(value) => handleInputChange('exchangeRate', value)} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                     <div className="grid gap-2"><Label htmlFor="totalPembelianIdr">Total Pembelian (IDR)</Label>
                        <NumericInput id="totalPembelianIdr" value={po.totalPembelianIdr === undefined ? (po.totalRmb || 0) * (po.exchangeRate || 0) : po.totalPembelianIdr} onValueChange={(value) => handleInputChange('totalPembelianIdr', value)} />
                    </div>
                     <div className="grid gap-2"><Label htmlFor="costPerPiece">Cost per Pcs (IDR)</Label>
                        <NumericInput id="costPerPiece" value={po.costPerPiece || 0} onValueChange={(value) => handleInputChange('costPerPiece', value)} />
                    </div>
                </div>
            </div>
             <Separator />
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Shipping & Tracking</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="grid gap-2"><Label htmlFor="marking">Marking</Label>
                        <Select value={po.marking || ''} onValueChange={(value) => handleInputChange('marking', value)}>
                            <SelectTrigger><SelectValue placeholder="Select a courier marking" /></SelectTrigger>
                            <SelectContent>{[...new Set(couriers.map(c => c.marking))].map((marking, index) => <SelectItem key={`${marking}-${index}`} value={marking}>{marking}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2"><Label htmlFor="packageCount">Jumlah Koli</Label><NumericInput id="packageCount" value={po.packageCount || 0} onValueChange={(value) => handleInputChange('packageCount', value)} /></div>
                    <div className="grid gap-2 col-span-1 md:col-span-2"><Label htmlFor="trackingNumber">No. Resi</Label>
                        <TrackingNumberInput 
                            value={po.trackingNumber || []} 
                            onChange={(value) => handleInputChange('trackingNumber', value)} 
                        />
                    </div>
                    <div className="grid gap-2 col-span-1 md:col-span-full"><Label htmlFor="photoUrl">Link Foto Barang</Label><Input id="photoUrl" value={po.photoUrl || ''} onChange={(e) => handleInputChange('photoUrl', e.target.value)} /></div>
                    <div className="grid gap-2 col-span-1 md:col-span-full"><Label htmlFor="shippingNote">Shipping Note</Label><Textarea id="shippingNote" value={po.shippingNote || ''} onChange={(e) => handleInputChange('shippingNote', e.target.value)} /></div>
                </div>
            </div>
            <Separator />
             <div className="space-y-4">
                <h3 className="text-lg font-medium">Receiving & Confirmation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="qtyReceived">Qty Diterima</Label>
                        <NumericInput id="qtyReceived" value={po.qtyReceived || 0} onValueChange={(value) => handleInputChange('qtyReceived', value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="qtyNotReceived">Qty Tidak Diterima</Label>
                        <NumericInput id="qtyNotReceived" value={po.qtyNotReceived || 0} onValueChange={(value) => handleInputChange('qtyNotReceived', value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="qtyDamaged">Qty Rusak</Label>
                        <NumericInput id="qtyDamaged" value={po.qtyDamaged || 0} onValueChange={(value) => handleInputChange('qtyDamaged', value)} />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 pt-4">
                    <div className="flex items-center space-x-2"><Checkbox id="isOldItemsInPurchaseMenu" checked={po.isOldItemsInPurchaseMenu} onCheckedChange={(checked) => handleInputChange('isOldItemsInPurchaseMenu', checked)} /><Label htmlFor="isOldItemsInPurchaseMenu">Barang Lama Sudah Masukin Menu Pembelian?</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="isNewItemsPdfCreated" checked={po.isNewItemsPdfCreated} onCheckedChange={(checked) => handleInputChange('isNewItemsPdfCreated', checked)} /><Label htmlFor="isNewItemsPdfCreated">Barang Baru Sudah Bikin PDF?</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="isPrintoutCreated" checked={po.isPrintoutCreated} onCheckedChange={(checked) => handleInputChange('isPrintoutCreated', checked)} /><Label htmlFor="isPrintoutCreated">Sudah Print Pembelian?</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="isStockUpdated" checked={po.isStockUpdated} onCheckedChange={(checked) => handleInputChange('isStockUpdated', checked)} /><Label htmlFor="isStockUpdated">Sudah Update Stock?</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="isNewItemsUploaded" checked={po.isNewItemsUploaded} onCheckedChange={(checked) => handleInputChange('isNewItemsUploaded', checked)} /><Label htmlFor="isNewItemsUploaded">Sudah Upload Barang Baru?</Label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="isNewItemsAddedToPurchase" checked={po.isNewItemsAddedToPurchase} onCheckedChange={(checked) => handleInputChange('isNewItemsAddedToPurchase', checked)} /><Label htmlFor="isNewItemsAddedToPurchase">Sudah Tambah Barang baru ke pembelian?</Label></div>
                </div>
            </div>
            <Separator />
            <div className="space-y-4">
                 <h3 className="text-lg font-medium">Refund Details</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                     <div className="flex items-center space-x-2 pt-6"><Checkbox id="hasRefund" checked={!!po.refund} disabled /><Label htmlFor="hasRefund">Ada Refund?</Label></div>
                     <div className="grid gap-2"><Label>Jumlah Refund (Yuan)</Label><Input value={po.refund?.refundAmount || 0} disabled /></div>
                     <div className="flex items-center space-x-2 pt-6"><Checkbox id="isSupplierRefundApproved" checked={po.refund?.isSupplierApproved} disabled /><Label htmlFor="isSupplierRefundApproved">Supplier sudah OK?</Label></div>
                 </div>
            </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push('/dashboard/purchase-orders')}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isNew ? 'Create Purchase Order' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

    