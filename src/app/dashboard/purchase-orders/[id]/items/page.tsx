'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseOrder, PurchaseOrderItem, Sku } from '@/lib/types';
import { getPurchaseOrderWithDetails, addOrUpdatePurchaseOrder } from '@/lib/services/purchaseOrderService';
import {
  getPOItems,
  savePOItems,
  updatePOItem,
  deletePOItem,
  addPOItem,
  bulkUpdatePOItems,
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
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Image as ImageIcon,
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
  const hasAutoSyncedRef = React.useRef(false);
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

  // Fetch PO items (one-time, not real-time subscription)
  const fetchItems = React.useCallback(async () => {
    if (!poId) return;
    setLoading(true);
    try {
      const fetchedItems = await getPOItems(poId);

      // Use startTransition for non-urgent state update to prevent freezing
      React.startTransition(() => {
        setItems(fetchedItems);
        setLoading(false);
      });
    } catch (error) {
      toast({ title: 'Error fetching items', variant: 'destructive' });
      setLoading(false);
    }
  }, [poId, toast]);

  React.useEffect(() => {
    // Reset auto-sync flag when PO changes
    hasAutoSyncedRef.current = false;
    fetchItems();
  }, [fetchItems]);

  // Auto-sync cost per pcs when items are loaded if needed
  React.useEffect(() => {
    const autoSyncCostPerPcs = async () => {
      // Skip if already synced or still loading
      if (hasAutoSyncedRef.current || !po || !items || items.length === 0 || loading) return;

      const masterCostPerPcs = po.costPerPiece || 0;

      // Check if master PO has cost per pcs but items don't
      const itemsWithZeroCost = items.filter(item => item.costPerPcs === 0);

      if (masterCostPerPcs > 0 && itemsWithZeroCost.length > 0) {
        console.log(`[Auto-sync] Detected ${itemsWithZeroCost.length} items with 0 cost per pcs, syncing from master PO...`);

        // Mark as synced to prevent re-run
        hasAutoSyncedRef.current = true;

        try {
          const itemsToUpdate = itemsWithZeroCost.map((item) => ({
            id: item.id,
            data: {
              costPerPcs: masterCostPerPcs,
              modalBarang: item.hargaBarang + masterCostPerPcs,
            },
          }));

          await bulkUpdatePOItems(itemsToUpdate);

          // Refresh items to show updated values
          await fetchItems();

          toast({
            title: 'Cost Per Pcs auto-synced!',
            description: `Updated ${itemsWithZeroCost.length} items with cost per pcs from master PO`
          });
        } catch (error) {
          console.error('Error auto-syncing cost per pcs:', error);
          // Reset flag on error so user can try again
          hasAutoSyncedRef.current = false;
        }
      }
    };

    autoSyncCostPerPcs();
  }, [po, items, loading, fetchItems, toast]);

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
        console.log('Parsing errors:', errors);
        toast({
          title: 'Parsing completed with errors',
          description: `${errors.length} row(s) had errors and were skipped. Check console for details.`,
          variant: 'destructive',
        });
      }

      if (parsedItems.length === 0) {
        toast({
          title: 'No valid items found in file',
          description: 'Please check that your Excel file has the correct column headers and valid data.',
          variant: 'destructive'
        });
        return;
      }

      console.log('Successfully parsed items:', parsedItems);
      setUploadedItems(parsedItems);
      setIsUploadConfirmOpen(true);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmUpload = async () => {
    if (!po || !storeId) return;

    setIsUploadConfirmOpen(false);
    setLoading(true);

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

      // Refresh items after upload with a slight delay to prevent UI freeze
      setTimeout(async () => {
        await fetchItems();
        setUploadedItems([]);
        toast({
          title: 'Upload successful',
          description: `${uploadedItems.length} items ${uploadAction === 'replace' ? 'replaced' : 'added'}.`,
        });
      }, 100);
    } catch (error) {
      setLoading(false);
      toast({ title: 'Failed to save items', variant: 'destructive' });
    }
  };

  // Local state for optimistic updates
  const [localValues, setLocalValues] = React.useState<{ [key: string]: any }>({});

  // Debounce timers for field changes
  const debounceTimers = React.useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Handle field changes with debouncing and optimistic updates
  const handleItemChange = React.useCallback(
    (itemId: string, field: keyof PurchaseOrderItem, value: any) => {
      const key = `${itemId}-${field}`;

      // Update local state immediately for responsive UI
      setLocalValues((prev) => ({ ...prev, [key]: value }));

      // Clear existing timer
      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
      }

      // Set new timer for database update
      debounceTimers.current[key] = setTimeout(async () => {
        try {
          const updateData: any = { [field]: value };

          // Recalculate if unit price changes
          if (field === 'unitPrice' && po) {
            const hargaBarang = calculateHargaBarang(value);
            updateData.hargaBarang = hargaBarang;
            updateData.modalBarang = calculateModalBarang(hargaBarang);
          }

          await updatePOItem(itemId, updateData);

          // Update items state optimistically
          setItems((prevItems) =>
            prevItems.map((item) =>
              item.id === itemId ? { ...item, ...updateData } : item
            )
          );

          // Remove from local state after successful update
          setLocalValues((prev) => {
            const newState = { ...prev };
            delete newState[key];
            return newState;
          });
        } catch (error) {
          toast({ title: 'Failed to update item', variant: 'destructive' });
          // Revert local state on error
          setLocalValues((prev) => {
            const newState = { ...prev };
            delete newState[key];
            return newState;
          });
        }
      }, 1000); // Increased to 1000ms debounce
    },
    [po, toast]
  );

  // Get value with local state fallback
  const getFieldValue = (itemId: string, field: keyof PurchaseOrderItem, defaultValue: any) => {
    const key = `${itemId}-${field}`;
    return localValues[key] !== undefined ? localValues[key] : defaultValue;
  };

  // Handle SKU selection
  const handleSkuChange = async (itemId: string, _skuId: string, sku: Sku | null) => {
    try {
      const updateData: any = {
        skuId: sku?.id || null,
        skuCode: sku?.skuCode || null,
        skuName: sku?.skuName || null,
      };

      // Also include imageUrl if the SKU has one
      if (sku?.imageUrl) {
        updateData.imageUrl = sku.imageUrl;
      } else {
        updateData.imageUrl = null;
      }

      console.log('[handleSkuChange] Saving SKU data:', { itemId, updateData });

      await updatePOItem(itemId, updateData);

      // Update local state immediately
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, ...updateData } : item
        )
      );

      console.log('[handleSkuChange] SKU saved successfully');
    } catch (error) {
      console.error('[handleSkuChange] Error saving SKU:', error);
      toast({ title: 'Failed to update SKU', variant: 'destructive' });
    }
  };


  // Add new row
  const handleAddRow = async () => {
    if (!po) {
      toast({ title: 'PO not loaded', variant: 'destructive' });
      return;
    }

    if (!storeId) {
      toast({
        title: 'Store not selected',
        description: 'Please select a store first',
        variant: 'destructive'
      });
      return;
    }

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
      modalBarang: calculateModalBarang(0), // Modal Barang = Harga Barang + Cost per Pcs
    };

    try {
      const newItemId = await addPOItem(newItem);

      // Add to local state immediately
      setItems((prevItems) => [...prevItems, { ...newItem, id: newItemId, createdAt: new Date() as any, updatedAt: new Date() as any }]);

      toast({ title: 'Row added' });
    } catch (error) {
      console.error('Error adding row:', error);
      toast({ title: 'Failed to add row', variant: 'destructive' });
    }
  };

  // Delete row
  const handleDeleteRow = async (itemId: string) => {
    try {
      await deletePOItem(itemId);

      // Remove from local state immediately
      setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));

      toast({ title: 'Row deleted' });
    } catch (error) {
      toast({ title: 'Failed to delete row', variant: 'destructive' });
    }
  };

  // Sync cost per pcs from master PO to all items
  const handleSyncCostPerPcs = async () => {
    if (!po) {
      toast({ title: 'PO data not loaded', variant: 'destructive' });
      return;
    }

    const costPerPcs = po.costPerPiece || 0;

    if (costPerPcs === 0) {
      toast({
        title: 'Cost Per Pcs not set',
        description: 'Please set Cost Per Pcs in the master PO first',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const itemsToUpdate = items.map((item) => ({
        id: item.id,
        data: {
          costPerPcs: costPerPcs,
          modalBarang: item.hargaBarang + costPerPcs,
        },
      }));

      await bulkUpdatePOItems(itemsToUpdate);

      // Refresh items to show updated values
      await fetchItems();

      // Reset auto-sync flag so it can run again if needed
      hasAutoSyncedRef.current = false;

      toast({
        title: 'Cost Per Pcs synced successfully!',
        description: `Updated ${items.length} items with cost per pcs: ${costPerPcs.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}`
      });
    } catch (error) {
      console.error('Error syncing cost per pcs:', error);
      toast({ title: 'Failed to sync cost per pcs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Save current state - ensures all SKU mappings and changes are persisted
  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('[handleSave] Waiting for pending updates...');
      // Wait for any pending debounced updates to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log('[handleSave] Refreshing items from database...');
      // Refresh items to show latest saved state
      await fetchItems();

      console.log('[handleSave] Items refreshed, checking SKU data...');
      // Log a sample item to verify SKU data is preserved
      const itemsAfterRefresh = await getPOItems(poId);
      const itemsWithSku = itemsAfterRefresh.filter(item => item.skuId);
      console.log('[handleSave] Items with SKU after refresh:', itemsWithSku.length);
      if (itemsWithSku.length > 0) {
        console.log('[handleSave] Sample item with SKU:', itemsWithSku[0]);
      }

      toast({
        title: 'Items saved successfully',
        description: 'All SKU mappings and changes have been saved.',
      });
    } catch (error: any) {
      console.error('[handleSave] Error:', error);
      toast({
        title: 'Failed to save items',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 50; // Show 50 items per page

  // Filter and paginate items efficiently
  const { filteredItems, paginatedItems } = React.useMemo(() => {
    let filtered = items;

    // Only filter if there's a search term
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = items.filter(
        (item) =>
          item.itemCode.toLowerCase().includes(lower) ||
          item.itemName.toLowerCase().includes(lower) ||
          (item.skuCode?.toLowerCase() || '').includes(lower)
      );
    }

    // Paginate
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filtered.slice(startIndex, endIndex);

    return { filteredItems: filtered, paginatedItems: paginated };
  }, [items, searchTerm, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Reset to page 1 when search term changes
  React.useEffect(() => {
    // Use startTransition to prevent interrupting user input
    React.startTransition(() => {
      setCurrentPage(1);
    });
  }, [searchTerm]);

  // Calculate totals (only recalculate when items actually change)
  const totals = React.useMemo(() => {
    // For large datasets, only calculate if we have less than 1000 items
    // Otherwise it can freeze the UI
    if (items.length > 1000) {
      return { quantity: 0, amount: 0, modalBarang: 0 };
    }
    return filteredItems.reduce(
      (acc, item) => ({
        quantity: acc.quantity + item.quantity,
        amount: acc.amount + item.amount, // Sum of "金额 (¥)" column directly
        modalBarang: acc.modalBarang + item.modalBarang * item.quantity,
      }),
      { quantity: 0, amount: 0, modalBarang: 0 }
    );
  }, [filteredItems, items.length]);

  if (!po) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-semibold">Loading items...</p>
            <p className="text-sm text-muted-foreground">This may take a moment for large datasets</p>
          </div>
        </div>
      )}
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
            <div className="mt-1">
              <Badge>{po.status}</Badge>
            </div>
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
              <Button size="sm" variant="outline" onClick={fetchItems} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={handleSyncCostPerPcs} disabled={loading || items.length === 0}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Cost Per Pcs
              </Button>
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
                  <TableHead className="w-[80px]">Photo</TableHead>
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
                    <TableCell colSpan={14} className="h-24 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="h-24 text-center">
                      No items found. Upload Excel or add rows manually.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.imageUrl ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <div className="w-12 h-12 relative cursor-pointer hover:opacity-80 transition-opacity">
                                <Image
                                  src={item.imageUrl}
                                  alt={item.itemName || 'Product'}
                                  fill
                                  className="rounded-md object-cover"
                                  sizes="48px"
                                />
                              </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>{item.itemName}</DialogTitle>
                              </DialogHeader>
                              <div className="relative w-full" style={{ aspectRatio: '1' }}>
                                <Image
                                  src={item.imageUrl}
                                  alt={item.itemName || 'Product'}
                                  fill
                                  className="rounded-md object-contain"
                                  sizes="(max-width: 768px) 100vw, 50vw"
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{item.serialNumber}</TableCell>
                      <TableCell>
                        <Input
                          value={getFieldValue(item.id, 'itemCode', item.itemCode)}
                          onChange={(e) => handleItemChange(item.id, 'itemCode', e.target.value)}
                          className="min-w-[120px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={getFieldValue(item.id, 'itemName', item.itemName)}
                          onChange={(e) => handleItemChange(item.id, 'itemName', e.target.value)}
                          className="min-w-[200px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={getFieldValue(item.id, 'specification', item.specification)}
                          onChange={(e) =>
                            handleItemChange(item.id, 'specification', e.target.value)
                          }
                          className="min-w-[150px]"
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          value={getFieldValue(item.id, 'quantity', item.quantity)}
                          onValueChange={(value) => handleItemChange(item.id, 'quantity', value)}
                          className="w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          value={getFieldValue(item.id, 'unitPrice', item.unitPrice)}
                          onValueChange={(value) => handleItemChange(item.id, 'unitPrice', value)}
                          className="w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          value={getFieldValue(item.id, 'discount', item.discount)}
                          onValueChange={(value) => handleItemChange(item.id, 'discount', value)}
                          className="w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          value={getFieldValue(item.id, 'amount', item.amount)}
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
          {/* Pagination Controls */}
          {filteredItems.length > itemsPerPage && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} items
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
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
                Save Items
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
