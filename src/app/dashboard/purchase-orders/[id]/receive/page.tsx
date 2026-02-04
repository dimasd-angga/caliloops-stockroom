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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  Loader2,
  PackageCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseOrder, POReceive, POReceiveItem } from '@/lib/types';
import { getPurchaseOrderWithDetails } from '@/lib/services/purchaseOrderService';
import {
  initializePOReceive,
  getPOReceiveByPOId,
  getPOReceiveItems,
  updateDamagedQuantity,
  completePOReceive,
  savePOReceiveProgress,
} from '@/lib/services/poReceiveService';
import { UserContext } from '@/app/dashboard/layout';
import { format } from 'date-fns';
import { InputRusakModal } from '@/components/InputRusakModal';
import { InboundShipmentModal } from '@/components/InboundShipmentModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';
import { addInboundShipment } from '@/lib/services/inboundService';
import { updateReceivedQuantity } from '@/lib/services/poReceiveService';
import {
  saveDraftInbound,
  getDraftByReceiveItemId,
  deleteDraft,
} from '@/lib/services/draftInboundService';
import type { Unit, DraftInboundShipment } from '@/lib/types';
import { usePDF } from 'react-to-pdf';
import { PODocumentPrint } from '@/components/PODocumentPrint';
import { ImagePreviewDialog } from '@/components/ImagePreviewDialog';

export default function POReceivePage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const poId = params.id as string;
  const { user, selectedStoreId } = React.useContext(UserContext);

  const [po, setPo] = React.useState<PurchaseOrder | null>(null);
  const [poReceive, setPoReceive] = React.useState<POReceive | null>(null);
  const [items, setItems] = React.useState<POReceiveItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);

  // Modal states
  const [selectedItem, setSelectedItem] = React.useState<POReceiveItem | null>(null);
  const [isRusakModalOpen, setIsRusakModalOpen] = React.useState(false);
  const [isInboundModalOpen, setIsInboundModalOpen] = React.useState(false);
  const [draftPacks, setDraftPacks] = React.useState<Array<{ quantity: number; unit: Unit; note: string }>>([]);

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 50;

  // PDF Generation
  const { toPDF, targetRef } = usePDF({
    filename: `PO-${po?.poNumber || 'document'}-${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.pdf`,
    page: {
      margin: 10,
      format: 'a4',
      orientation: 'portrait'
    }
  });

  const storeId = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

  // Initialize PO Receive
  React.useEffect(() => {
    const initialize = async () => {
      if (!poId) {
        console.log('No poId');
        return;
      }

      if (!storeId) {
        console.log('No storeId yet, waiting for user to load...');
        return;
      }

      console.log('Initializing PO Receive for poId:', poId, 'storeId:', storeId);
      setLoading(true);

      try {
        // Get PO details
        console.log('Fetching PO details...');
        const fetchedPO = await getPurchaseOrderWithDetails(poId);
        console.log('PO fetched:', fetchedPO);
        setPo(fetchedPO);

        // Get or create PO Receive
        console.log('Getting PO Receive...');
        let receive = await getPOReceiveByPOId(poId);
        console.log('Existing receive:', receive);

        if (!receive) {
          // Initialize new PO Receive
          console.log('Creating new PO Receive...');
          const receiveId = await initializePOReceive(
            poId,
            fetchedPO.poNumber,
            storeId,
            fetchedPO.supplierId,
            fetchedPO.supplierName
          );
          console.log('PO Receive created with ID:', receiveId);

          // Fetch the created receive record
          receive = await getPOReceiveByPOId(poId);
          console.log('Fetched created receive:', receive);
        }

        if (receive) {
          setPoReceive(receive);

          // Fetch items
          console.log('Fetching receive items...');
          const fetchedItems = await getPOReceiveItems(receive.id);
          console.log('Items fetched:', fetchedItems.length);
          setItems(fetchedItems);
        }

        console.log('Initialization complete');
      } catch (error: any) {
        console.error('Error initializing PO Receive:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to initialize PO Receive',
          variant: 'destructive',
        });
        router.push('/dashboard/purchase-orders');
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [poId, storeId, toast, router]);

  // Refresh items
  const refreshItems = async () => {
    if (!poReceive) return;
    try {
      const fetchedItems = await getPOReceiveItems(poReceive.id);
      setItems(fetchedItems);

      // Refresh PO Receive data
      const updatedReceive = await getPOReceiveByPOId(poId);
      if (updatedReceive) {
        setPoReceive(updatedReceive);
      }
    } catch (error) {
      console.error('Error refreshing items:', error);
    }
  };

  // Handle Input Terima (Inbound)
  const handleInputTerima = async (item: POReceiveItem) => {
    setSelectedItem(item);

    // Try to load existing draft
    try {
      const draft = await getDraftByReceiveItemId(item.id);
      if (draft && draft.packs && draft.packs.length > 0) {
        setDraftPacks(draft.packs);
      } else {
        setDraftPacks([]);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      setDraftPacks([]);
    }

    setIsInboundModalOpen(true);
  };

  type QuantityPack = {
    quantity: number;
    unit: Unit;
    note: string;
  };

  const handleSaveInbound = async (packs: QuantityPack[]) => {
    if (!selectedItem || !po || !storeId) return;

    try {
      await saveDraftInbound(
        selectedItem.id,
        storeId,
        selectedItem.skuId!,
        selectedItem.skuCode || '',
        poId,
        po.poNumber,
        po.supplierId,
        po.supplierName,
        packs
      );

      toast({ title: 'Shipment data saved successfully!' });
    } catch (error: any) {
      toast({
        title: 'Failed to save draft',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleSubmitInbound = async (packs: QuantityPack[]) => {
    if (!selectedItem || !po || !storeId) return;

    try {
      // Create the inbound shipment with barcodes
      await addInboundShipment(
        {
          storeId,
          skuId: selectedItem.skuId!,
          skuName: selectedItem.skuName || selectedItem.skuCode || '',
          skuCode: selectedItem.skuCode || '',
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          purchaseOrderId: poId,
          poNumber: po.poNumber,
          createdBy: user?.name || 'System',
        },
        packs
      );

      // Update the received quantity in POReceiveItem
      const totalReceived = packs.reduce((sum, pack) => sum + pack.quantity, 0);
      await updateReceivedQuantity(selectedItem.id, totalReceived);

      // Delete the draft since shipment is now submitted
      try {
        await deleteDraft(selectedItem.id);
      } catch (error) {
        console.log('No draft to delete or error deleting draft:', error);
      }

      await refreshItems();
      toast({ title: 'Inbound shipment created successfully!' });
      setIsInboundModalOpen(false);
      setSelectedItem(null);
      setDraftPacks([]);
    } catch (error: any) {
      toast({
        title: 'Failed to create shipment',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Handle Input Rusak
  const handleInputRusak = (item: POReceiveItem) => {
    setSelectedItem(item);
    setIsRusakModalOpen(true);
  };

  const handleSaveDamaged = async (damagedQty: number) => {
    if (!selectedItem) return;

    try {
      await updateDamagedQuantity(selectedItem.id, damagedQty);
      await refreshItems();
      toast({ title: 'Damaged quantity updated successfully' });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update damaged quantity');
    }
  };

  // Handle Save Progress
  const handleSave = async () => {
    if (!poReceive) return;

    setSaving(true);
    try {
      await savePOReceiveProgress(poReceive.id);
      toast({ title: 'Progress saved successfully' });
    } catch (error) {
      toast({
        title: 'Failed to save progress',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle Done (Complete)
  const handleComplete = async () => {
    if (!poReceive) return;

    // Validate all items have input
    const itemsWithoutInput = items.filter((item) => !item.hasReceivedInput);

    if (itemsWithoutInput.length > 0) {
      toast({
        title: 'Cannot complete',
        description: `${itemsWithoutInput.length} item(s) don't have receive input. Please complete all items.`,
        variant: 'destructive',
      });
      return;
    }

    setCompleting(true);
    try {
      await completePOReceive(poReceive.id);
      toast({
        title: 'PO Receive completed!',
        description: 'Refunds have been created automatically for not received and damaged items.',
      });
      router.push('/dashboard/purchase-orders');
    } catch (error: any) {
      toast({
        title: 'Failed to complete',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setCompleting(false);
    }
  };

  // Pagination
  const paginatedItems = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage]);

  const totalPages = Math.ceil(items.length / itemsPerPage);

  // Helper function to convert Google Drive URLs to direct image URLs
  const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return url;

    // Check if it's a Google Drive URL
    const match = url.match(/\/file\/d\/([^/]+)\//);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }

    return url;
  };

  // Handle PDF generation with image loading
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  const handlePrintPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      // Wait a bit for images to load
      await new Promise(resolve => setTimeout(resolve, 500));
      await toPDF();
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Failed to generate PDF',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Show store selection prompt for superadmin
  if (user?.email === 'superadmin@caliloops.com' && !selectedStoreId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Store Selection Required</AlertTitle>
          <AlertDescription>
            Please select a store from the dropdown in the navigation bar to view PO Receive.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading || !po || !poReceive) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isCompleted = poReceive.status === 'COMPLETED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold mt-4 flex items-center gap-2">
            <PackageCheck className="h-6 w-6" />
            PO Receive
          </h1>
          <p className="text-muted-foreground">Receive and inspect items for PO: {po.poNumber}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrintPdf}
            disabled={loading || isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Print PO Document
              </>
            )}
          </Button>
          {!isCompleted && (
            <>
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={saving || completing}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Progress
                  </>
                )}
              </Button>
              <Button
                onClick={handleComplete}
                disabled={saving || completing}
              >
                {completing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Done
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Alert */}
      {isCompleted && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Completed</AlertTitle>
          <AlertDescription>
            This PO Receive has been completed on{' '}
            {poReceive.completedAt && format(poReceive.completedAt.toDate(), 'dd MMM yyyy HH:mm')}
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Alert */}
      {!isCompleted && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Progress: {poReceive.totalReceivedItems} / {poReceive.totalItemsCount} items</AlertTitle>
          <AlertDescription>
            {poReceive.totalReceivedItems === poReceive.totalItemsCount
              ? 'All items have receive input. You can click "Done" to complete.'
              : `${poReceive.totalItemsCount - poReceive.totalReceivedItems} item(s) still need receive input.`}
          </AlertDescription>
        </Alert>
      )}

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
            <Label className="text-muted-foreground">Status</Label>
            <div className="mt-1">
              <Badge variant={isCompleted ? 'default' : 'secondary'}>
                {poReceive.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items ({items.length})</CardTitle>
          <CardDescription>Review and record received, damaged, and not received quantities</CardDescription>
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
                  <TableHead className="min-w-[150px]">SKU</TableHead>
                  <TableHead className="w-[100px]">Foto Produk</TableHead>
                  <TableHead className="w-[120px]">Harga Barang</TableHead>
                  <TableHead className="w-[120px]">Cost Per Pcs</TableHead>
                  <TableHead className="w-[120px]">Modal Barang</TableHead>
                  <TableHead className="min-w-[150px]">Actions</TableHead>
                  <TableHead className="w-[120px]">Inbound Details</TableHead>
                  <TableHead className="w-[100px]">Qty Diterima<br/>收到的数量</TableHead>
                  <TableHead className="w-[100px]">Qty Tidak Diterima<br/>没收到的数量</TableHead>
                  <TableHead className="w-[100px]">Qty Rusak<br/>坏掉的数量</TableHead>
                  <TableHead className="w-[100px]">Total Pcs Final</TableHead>
                  <TableHead className="w-[120px]">Amount Tidak Diterima<br/>没收到的金额 (¥)</TableHead>
                  <TableHead className="w-[120px]">Amount Rusak<br/>坏掉的金额 (¥)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={21} className="h-24 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={21} className="h-24 text-center">
                      No items found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => {
                    const isFinalMismatch = item.totalPcsFinal !== item.quantity;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.serialNumber}</TableCell>
                        <TableCell>{item.itemCode}</TableCell>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell>{item.specification}</TableCell>
                        <TableCell className="font-semibold">{item.quantity}</TableCell>
                        <TableCell>{item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell>{item.discount.toFixed(2)}</TableCell>
                        <TableCell>{item.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          {item.skuCode ? `${item.skuCode} - ${item.skuName}` : '-'}
                        </TableCell>
                        <TableCell>
                          {item.imageUrl ? (
                            <ImagePreviewDialog
                              imageUrl={convertGoogleDriveUrl(item.imageUrl)}
                              alt={item.itemName}
                              trigger={
                                <div className="relative w-16 h-16">
                                  <Image
                                    src={convertGoogleDriveUrl(item.imageUrl)}
                                    alt={item.itemName}
                                    fill
                                    className="object-cover rounded"
                                  />
                                </div>
                              }
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-gray-400" />
                            </div>
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
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInputTerima(item)}
                              disabled={isCompleted}
                            >
                              <PackageCheck className="mr-2 h-4 w-4" />
                              Input Terima
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleInputRusak(item)}
                              disabled={isCompleted}
                            >
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Input Rusak
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.qtyReceived > 0 && item.skuId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const params = new URLSearchParams({
                                  skuId: item.skuId!,
                                  supplierId: poReceive?.supplierId || '',
                                  supplierName: poReceive?.supplierName || '',
                                  poId: item.poId,
                                  poNumber: item.poNumber,
                                  poReceiveItemId: item.id,
                                });
                                window.open(`/dashboard/inbound?${params.toString()}`, '_blank');
                              }}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Inbound
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className={`font-semibold ${item.qtyReceived > 0 ? 'text-green-600' : ''}`}>
                          {item.qtyReceived}
                        </TableCell>
                        <TableCell className={`font-semibold ${item.qtyNotReceived > 0 ? 'text-red-600' : ''}`}>
                          {item.qtyNotReceived}
                        </TableCell>
                        <TableCell className={`font-semibold ${item.qtyDamaged > 0 ? 'text-orange-600' : ''}`}>
                          {item.qtyDamaged}
                        </TableCell>
                        <TableCell className={`font-semibold ${isFinalMismatch ? 'text-red-600 bg-red-50' : 'text-green-600'}`}>
                          {item.totalPcsFinal}
                          {isFinalMismatch && (
                            <span className="block text-xs">
                              (Expected: {item.quantity})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className={`font-mono text-sm ${item.amountNotReceived > 0 ? 'text-red-600' : ''}`}>
                          ¥{item.amountNotReceived.toFixed(2)}
                        </TableCell>
                        <TableCell className={`font-mono text-sm ${item.amountDamaged > 0 ? 'text-orange-600' : ''}`}>
                          ¥{item.amountDamaged.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {items.length > itemsPerPage && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, items.length)} of {items.length} items
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

        {/* Totals Footer */}
        <CardFooter className="flex justify-between border-t pt-6">
          <div className="grid grid-cols-4 gap-8">
            <div>
              <Label className="text-muted-foreground">Total Qty Diterima</Label>
              <p className="text-xl font-bold text-green-600">
                {items.reduce((sum, item) => sum + item.qtyReceived, 0)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Qty Tidak Diterima</Label>
              <p className="text-xl font-bold text-red-600">
                {items.reduce((sum, item) => sum + item.qtyNotReceived, 0)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Qty Rusak</Label>
              <p className="text-xl font-bold text-orange-600">
                {items.reduce((sum, item) => sum + item.qtyDamaged, 0)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Refund Amount</Label>
              <p className="text-xl font-bold text-red-600">
                ¥{items.reduce((sum, item) => sum + item.amountNotReceived + item.amountDamaged, 0).toFixed(2)}
              </p>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Inbound Shipment Modal */}
      {selectedItem && (
        <InboundShipmentModal
          open={isInboundModalOpen}
          onOpenChange={setIsInboundModalOpen}
          skuCode={selectedItem.skuCode || ''}
          supplierId={po?.supplierId || ''}
          supplierName={po?.supplierName || ''}
          poId={poId}
          poNumber={po?.poNumber || ''}
          initialPacks={draftPacks.length > 0 ? draftPacks : undefined}
          onSave={handleSaveInbound}
          onSubmit={handleSubmitInbound}
        />
      )}

      {/* Input Rusak Modal */}
      <InputRusakModal
        open={isRusakModalOpen}
        onOpenChange={setIsRusakModalOpen}
        item={selectedItem}
        onSave={handleSaveDamaged}
      />

      {/* Hidden Print Document */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        {po && items.length > 0 && (
          <PODocumentPrint ref={targetRef} po={po} items={items} />
        )}
      </div>
    </div>
  );
}
