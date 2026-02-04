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
  Loader2,
  FileBarChart,
  Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseOrder, POReceive, POReceiveItem } from '@/lib/types';
import { getPurchaseOrderWithDetails } from '@/lib/services/purchaseOrderService';
import {
  getPOReceiveByPOId,
  getPOReceiveItems,
} from '@/lib/services/poReceiveService';
import { UserContext } from '@/app/dashboard/layout';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';
import { AlertTriangle } from 'lucide-react';

export default function PORecapPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const poId = params.id as string;
  const { user, selectedStoreId } = React.useContext(UserContext);

  const [po, setPo] = React.useState<PurchaseOrder | null>(null);
  const [poReceive, setPoReceive] = React.useState<POReceive | null>(null);
  const [items, setItems] = React.useState<POReceiveItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const storeId = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

  // Fetch data
  React.useEffect(() => {
    const fetchData = async () => {
      if (!poId || !storeId) {
        return;
      }

      setLoading(true);

      try {
        // Get PO details
        const fetchedPO = await getPurchaseOrderWithDetails(poId);
        setPo(fetchedPO);

        // Get PO Receive
        const receive = await getPOReceiveByPOId(poId);

        if (receive) {
          setPoReceive(receive);

          // Fetch items
          const fetchedItems = await getPOReceiveItems(receive.id);
          setItems(fetchedItems);
        }
      } catch (error: any) {
        console.error('Error fetching recap data:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load recap data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [poId, storeId, toast]);

  // Show store selection prompt for superadmin
  if (user?.email === 'superadmin@caliloops.com' && !selectedStoreId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Store Selection Required</AlertTitle>
          <AlertDescription>
            Please select a store from the dropdown in the navigation bar to view PO Recap.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading || !po) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Calculate totals
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalModal = items.reduce((sum, item) => sum + item.modalBarang, 0);
  const totalQtyDiterima = items.reduce((sum, item) => sum + item.qtyReceived, 0);
  const totalQtyTidakDiterima = items.reduce((sum, item) => sum + item.qtyNotReceived, 0);
  const totalQtyRusak = items.reduce((sum, item) => sum + item.qtyDamaged, 0);

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
            <FileBarChart className="h-6 w-6" />
            PO Recap
          </h1>
          <p className="text-muted-foreground">Summary of received items for PO: {po.poNumber}</p>
        </div>
      </div>

      {/* PO Summary */}
      <Card>
        <CardHeader>
          <CardTitle>PO Information</CardTitle>
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
            <Label className="text-muted-foreground">Status</Label>
            <p className="font-semibold">{poReceive?.status || 'N/A'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Recap Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items Recap ({items.length})</CardTitle>
          <CardDescription>Summary of all items with received quantities</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Foto Produk</TableHead>
                  <TableHead className="min-w-[200px]">SKU</TableHead>
                  <TableHead className="w-[100px] text-right">Qty</TableHead>
                  <TableHead className="w-[120px] text-right">Modal</TableHead>
                  <TableHead className="w-[120px] text-right">Qty Diterima</TableHead>
                  <TableHead className="w-[150px] text-right">Qty Tidak Diterima</TableHead>
                  <TableHead className="w-[120px] text-right">Qty Rusak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No items found.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.imageUrl ? (
                          <div className="relative w-16 h-16">
                            <Image
                              src={convertGoogleDriveUrl(item.imageUrl)}
                              alt={item.itemName}
                              fill
                              className="object-cover rounded"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{item.skuCode || item.itemCode}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.skuName || item.itemName}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.modalBarang.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {item.qtyReceived}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {item.qtyNotReceived}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-orange-600">
                        {item.qtyDamaged}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {/* Totals Footer */}
        <CardFooter className="flex justify-between border-t pt-6">
          <div className="grid grid-cols-5 gap-8 w-full">
            <div>
              <Label className="text-muted-foreground">Total Qty</Label>
              <p className="text-xl font-bold">
                {totalQty}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Modal</Label>
              <p className="text-xl font-bold">
                {totalModal.toLocaleString('id-ID')}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Qty Diterima</Label>
              <p className="text-xl font-bold text-green-600">
                {totalQtyDiterima}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Qty Tidak Diterima</Label>
              <p className="text-xl font-bold text-red-600">
                {totalQtyTidakDiterima}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Qty Rusak</Label>
              <p className="text-xl font-bold text-orange-600">
                {totalQtyRusak}
              </p>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
