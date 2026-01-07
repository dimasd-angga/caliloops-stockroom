'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseOrder, PurchaseOrderItem, Sku } from '@/lib/types';
import { getPurchaseOrderWithDetails } from '@/lib/services/purchaseOrderService';
import {
  subscribeToPOItems,
  savePOItems,
  updatePOItem,
  deletePOItem,
  addPOItem,
} from '@/lib/services/purchaseOrderItemService';
import { addInboundShipment } from '@/lib/services/inboundService';
import { parsePOItemsExcel, downloadPOItemsTemplate } from '@/lib/utils/excelParser';
import { SkuSelectorWithCreate } from '@/components/SkuSelectorWithCreate';
import {
  ArrowLeft,
  Upload,
  Loader2,
  PlusCircle,
  Trash2,
  Save,
  Download,
  Search,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { UserContext } from '@/app/dashboard/layout';
import { format } from 'date-fns';
import { NumericInput } from '@/components/ui/numeric-input';
import { Badge } from '@/components/ui/badge';

export default function PurchaseOrderItemsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const poId = params.id as string;
  const { user, selectedStoreId, permissions } = React.useContext(UserContext);

  const [po, setPo] = React.useState<PurchaseOrder | null>(null);
  const [items, setItems] = React.useState<PurchaseOrderItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Excel upload state
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadConfirmOpen, setIsUploadConfirmOpen] = React.useState(false);
  const [uploadedItems, setUploadedItems] = React.useState<any[]>([]);
  const [uploadAction, setUploadAction] = React.useState<'replace' | 'append'>('replace');

  // Search state
  const [searchTerm, setSearchTerm] = React.useState('');

  const storeId = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

  // Fetch PO details
  React.useEffect(() => {
    const fetchPO = async () => {
      if (!poId) return;
      try {
        const fetchedPO = await getPurchaseOrderWithDetails(poId);
        setPo(fetchedPO);
      } catch (error) {
        toast({ title: 'Error fetching PO', variant: 'destructive' });
        router.push('/dashboard/purchase-orders');
      }
    };
    fetchPO();
  }, [poId, toast, router]);

  // Subscribe to PO items
  React.useEffect(() => {
    if (!poId) return;
    setLoading(true);
    const unsubscribe = subscribeToPOItems(
      poId,
      (fetchedItems) => {
        setItems(fetchedItems);
        setLoading(false);
      },
      (error) => {
        toast({ title: 'Error fetching items', variant: 'destructive' });
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [poId, toast]);

  // Calculate values
  const calculateHargaBarang = (unitPrice: number): number => {
    if (!po) return 0;
    return unitPrice * (po.exchangeRate || 0);
  };

  const calculateModalBarang = (hargaBarang: number): number => {
    if (!po) return 0;
    return hargaBarang + (po.costPerPiece || 0);
  };

  // Handle Excel upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { items: parsedItems, errors } = await parsePOItemsExcel(file);

      if (errors.length > 0) {
        toast({
          title: 'Parsing completed with errors',
          description: `${errors.length} row(s) had errors and were skipped.`,
          variant: 'destructive',
        });
      }

      if (parsedItems.length === 0) {
        toast({ title: 'No valid items found in file', variant: 'destructive' });
        return;
      }

      setUploadedItems(parsedItems);
      setIsUploadConfirmOpen(true);
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmUpload = async () => {
    if (!po || !storeId) return;

    try {
      const itemsToSave = uploadedItems.map((item) => {
        const hargaBarang = calculateHargaBarang(item.unitPrice);
        const costPerPcs = po.costPerPiece || 0;
        const modalBarang = calculateModalBarang(hargaBarang);

        return {
          serialNumber: item.serialNumber,
          itemCode: item.itemCode,
          itemName: item.itemName,
          specification: item.specification,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          amount: item.amount,
          hargaBarang,
          costPerPcs,
          modalBarang,
        };
      });

      await savePOItems(poId, po.poNumber, storeId, itemsToSave, uploadAction === 'replace');

      toast({
        title: 'Upload successful',
        description: `${uploadedItems.length} items ${uploadAction === 'replace' ? 'replaced' : 'added'}.`,
      });

      setIsUploadConfirmOpen(false);
      setUploadedItems([]);
    } catch (error) {
      toast({ title: 'Failed to save items', variant: 'destructive' });
    }
  };

  // Handle field changes
  const handleItemChange = async (
    itemId: string,
    field: keyof PurchaseOrderItem,
    value: any
  ) => {
    try {
      const updateData: any = { [field]: value };

      // Recalculate if unit price changes
      if (field === 'unitPrice') {
        const hargaBarang = calculateHargaBarang(value);
        updateData.hargaBarang = hargaBarang;
        updateData.modalBarang = calculateModalBarang(hargaBarang);
      }

      await updatePOItem(itemId, updateData);
    } catch (error) {
      toast({ title: 'Failed to update item', variant: 'destructive' });
    }
  };

  // Handle SKU selection
  const handleSkuChange = async (itemId: string, skuId: string, sku: Sku | null) => {
    try {
      await updatePOItem(itemId, {
        skuId: sku?.id,
        skuCode: sku?.skuCode,
        skuName: sku?.skuName,
      });
    } catch (error) {
      toast({ title: 'Failed to update SKU', variant: 'destructive' });
    }
  };

  // Add new row
  const handleAddRow = async () => {
    if (!po || !storeId) return;

    const newItem = {
      poId,
      poNumber: po.poNumber,
      storeId,
      serialNumber: items.length + 1,
      itemCode: '',
      itemName: '',
      specification: '',
      quantity: 0,
      unitPrice: 0,
      discount: 0,
      amount: 0,
      hargaBarang: 0,
      costPerPcs: po.costPerPiece || 0,
      modalBarang: 0,
    };

    try {
      await addPOItem(newItem);
      toast({ title: 'Row added' });
    } catch (error) {
      toast({ title: 'Failed to add row', variant: 'destructive' });
    }
  };

  // Delete row
  const handleDeleteRow = async (itemId: string) => {
    try {
      await deletePOItem(itemId);
      toast({ title: 'Row deleted' });
    } catch (error) {
      toast({ title: 'Failed to delete row', variant: 'destructive' });
    }
  };

  // Save and create inbound shipments
  const handleSave = async () => {
    if (!po || !storeId || !user) return;

    // Filter items with SKU mapped
    const itemsWithSku = items.filter((item) => item.skuId);

    if (itemsWithSku.length === 0) {
      toast({
        title: 'No items with SKU',
        description: 'Please map at least one item to a SKU before saving.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      let successCount = 0;

      for (const item of itemsWithSku) {
        // Create inbound shipment for each item with SKU
        await addInboundShipment(
          {
            storeId,
            skuId: item.skuId!,
            skuName: item.skuName || item.skuCode || '',
            skuCode: item.skuCode || '',
            supplierId: po.supplierId,
            supplierName: po.supplierName,
            purchaseOrderId: poId,
            poNumber: po.poNumber,
            createdBy: user.name || 'System',
          },
          [
            {
              quantity: item.quantity,
              unit: 'pcs',
              note: `${item.itemName} - ${item.specification}`,
            },
          ]
        );
        successCount++;
      }

      toast({
        title: 'Save successful!',
        description: `${successCount} inbound shipment(s) created successfully.`,
      });
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter items by search
  const filteredItems = React.useMemo(() => {
    if (!searchTerm) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.itemCode.toLowerCase().includes(lower) ||
        item.itemName.toLowerCase().includes(lower) ||
        item.skuCode?.toLowerCase().includes(lower)
    );
  }, [items, searchTerm]);

  // Calculate totals
  const totals = React.useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => ({
        quantity: acc.quantity + item.quantity,
        amount: acc.amount + item.amount,
        modalBarang: acc.modalBarang + item.modalBarang * item.quantity,
      }),
      { quantity: 0, amount: 0, modalBarang: 0 }
    );
  }, [filteredItems]);

  if (!po) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold mt-4">Purchase Order Items</h1>
          <p className="text-muted-foreground">Manage items for PO: {po.poNumber}</p>
        </div>
      </div>

      {/* PO Summary */}
      <Card>
        <CardHeader>
          <CardTitle>PO Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-4">
          <div>
            <Label className="text-muted-foreground">PO Number</Label>
            <p className="font-semibold">{po.poNumber}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Supplier</Label>
            <p className="font-semibold">{po.supplierName}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Order Date</Label>
            <p className="font-semibold">{format(po.orderDate.toDate(), 'dd MMM yyyy')}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Exchange Rate</Label>
            <p className="font-semibold">{po.exchangeRate} IDR</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Cost Per Pcs</Label>
            <p className="font-semibold">
              {(po.costPerPiece || 0).toLocaleString('id-ID', {
                style: 'currency',
                currency: 'IDR',
              })}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Total Pcs</Label>
            <p className="font-semibold">{po.totalPcs}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Total RMB</Label>
            <p className="font-semibold">{po.totalRmb.toLocaleString('zh-CN')} ¥</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Status</Label>
            <Badge>{po.status}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Excel Upload</CardTitle>
              <CardDescription>Upload items from supplier invoice (Excel format)</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadPOItemsTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Excel
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Items ({filteredItems.length})</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[250px]"
                />
              </div>
              <Button size="sm" onClick={handleAddRow}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Row
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">序号</TableHead>
                  <TableHead className="min-w-[120px]">货号</TableHead>
                  <TableHead className="min-w-[200px]">货品名称</TableHead>
                  <TableHead className="min-w-[150px]">规格</TableHead>
                  <TableHead className="w-[100px]">数量</TableHead>
                  <TableHead className="w-[100px]">单价 (¥)</TableHead>
                  <TableHead className="w-[100px]">优惠 (¥)</TableHead>
                  <TableHead className="w-[100px]">金额 (¥)</TableHead>
                  <TableHead className="min-w-[250px]">SKU</TableHead>
                  <TableHead className="w-[120px]">Harga Barang</TableHead>
                  <TableHead className="w-[120px]">Cost Per Pcs</TableHead>
                  <TableHead className="w-[120px]">Modal Barang</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-24 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-24 text-center">
                      No items found. Upload Excel or add rows manually.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.serialNumber}</TableCell>
                      <TableCell>
                        <Input
                          value={item.itemCode}
                          onChange={(e) => handleItemChange(item.id, 'itemCode', e.target.value)}
                          className="min-w-[120px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.itemName}
                          onChange={(e) => handleItemChange(item.id, 'itemName', e.target.value)}
                          className="min-w-[200px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.specification}
                          onChange={(e) =>
                            handleItemChange(item.id, 'specification', e.target.value)
                          }
                          className="min-w-[150px]"
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          value={item.quantity}
                          onValueChange={(value) => handleItemChange(item.id, 'quantity', value)}
                          className="w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          value={item.unitPrice}
                          onValueChange={(value) => handleItemChange(item.id, 'unitPrice', value)}
                          className="w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          value={item.discount}
                          onValueChange={(value) => handleItemChange(item.id, 'discount', value)}
                          className="w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          value={item.amount}
                          onValueChange={(value) => handleItemChange(item.id, 'amount', value)}
                          className="w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        {storeId && (
                          <SkuSelectorWithCreate
                            storeId={storeId}
                            value={item.skuId}
                            onValueChange={(skuId, sku) => handleSkuChange(item.id, skuId, sku)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.hargaBarang.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.costPerPcs.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold">
                        {item.modalBarang.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRow(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6">
          <div className="grid grid-cols-3 gap-8">
            <div>
              <Label className="text-muted-foreground">Total Quantity</Label>
              <p className="text-xl font-bold">{totals.quantity}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Amount (¥)</Label>
              <p className="text-xl font-bold">{totals.amount.toLocaleString('zh-CN')}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Modal (IDR)</Label>
              <p className="text-xl font-bold">
                {totals.modalBarang.toLocaleString('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                })}
              </p>
            </div>
          </div>
          <Button size="lg" onClick={handleSave} disabled={saving || items.length === 0}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save & Create Shipments
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Upload Confirmation Dialog */}
      <AlertDialog open={isUploadConfirmOpen} onOpenChange={setIsUploadConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upload Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to upload {uploadedItems.length} items.
              {items.length > 0 && (
                <span className="block mt-2 font-semibold">
                  There are {items.length} existing items. How do you want to proceed?
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-4">
            <Button
              variant={uploadAction === 'replace' ? 'default' : 'outline'}
              onClick={() => setUploadAction('replace')}
            >
              Replace all existing items
            </Button>
            <Button
              variant={uploadAction === 'append' ? 'default' : 'outline'}
              onClick={() => setUploadAction('append')}
            >
              Append to existing items
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpload}>Confirm Upload</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
