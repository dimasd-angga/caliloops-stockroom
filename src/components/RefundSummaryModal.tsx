'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Loader2, Printer } from 'lucide-react';
import type { Refund, POReceiveItem } from '@/lib/types';
import { getPOReceiveItems } from '@/lib/services/poReceiveService';
import { format } from 'date-fns';

interface RefundSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refund: Refund;
}

export function RefundSummaryModal({ open, onOpenChange, refund }: RefundSummaryModalProps) {
  const [items, setItems] = React.useState<POReceiveItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchItems = async () => {
      if (!open || !refund.poId) return;

      setLoading(true);
      try {
        // Fetch all PO Receive items for this PO
        const allItems = await getPOReceiveItems(refund.poId);

        // Filter items with refund amounts (not received OR damaged)
        const refundItems = allItems.filter(
          (item) => item.amountNotReceived > 0 || item.amountDamaged > 0
        );

        setItems(refundItems);
      } catch (error) {
        console.error('Error fetching refund items:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [open, refund.poId]);

  // Calculate totals
  const totals = React.useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        qtyNotReceived: acc.qtyNotReceived + item.qtyNotReceived,
        amountNotReceived: acc.amountNotReceived + item.amountNotReceived,
        qtyDamaged: acc.qtyDamaged + item.qtyDamaged,
        amountDamaged: acc.amountDamaged + item.amountDamaged,
        totalRefund: acc.totalRefund + item.amountNotReceived + item.amountDamaged,
      }),
      {
        qtyNotReceived: 0,
        amountNotReceived: 0,
        qtyDamaged: 0,
        amountDamaged: 0,
        totalRefund: 0,
      }
    );
  }, [items]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            退款明细 / Refund Summary
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
              <div>
                <p className="text-sm text-muted-foreground">PO编号 / PO Number</p>
                <p className="font-semibold text-lg">{refund.poNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">供应商 / Supplier</p>
                <p className="font-semibold text-lg">{refund.supplierName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">下单日期 / Order Date</p>
                <p className="font-semibold">
                  {format(refund.orderDate.toDate(), 'yyyy-MM-dd')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总退款 / Total Refund</p>
                <p className="font-semibold text-xl text-red-600">
                  ¥{totals.totalRefund.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="text-center">序号<br /><span className="text-xs font-normal">No.</span></TableHead>
                    <TableHead className="text-center">货号<br /><span className="text-xs font-normal">Item Code</span></TableHead>
                    <TableHead>货品名称<br /><span className="text-xs font-normal">Item Name</span></TableHead>
                    <TableHead className="text-center">规格<br /><span className="text-xs font-normal">Spec</span></TableHead>
                    <TableHead className="text-center">数量<br /><span className="text-xs font-normal">Qty</span></TableHead>
                    <TableHead className="text-right">单价(¥)<br /><span className="text-xs font-normal">Unit Price</span></TableHead>
                    <TableHead className="text-center">没收到数量<br /><span className="text-xs font-normal">Not Received</span></TableHead>
                    <TableHead className="text-right">没收到金额(¥)<br /><span className="text-xs font-normal">Amount</span></TableHead>
                    <TableHead className="text-center">坏掉数量<br /><span className="text-xs font-normal">Damaged</span></TableHead>
                    <TableHead className="text-right">坏掉金额(¥)<br /><span className="text-xs font-normal">Amount</span></TableHead>
                    <TableHead className="text-right bg-red-50">总退款(¥)<br /><span className="text-xs font-normal">Total Refund</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground h-32">
                        No items with refund amounts
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-center">{item.serialNumber}</TableCell>
                        <TableCell className="text-center font-mono text-sm">{item.itemCode}</TableCell>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell className="text-center text-sm">{item.specification}</TableCell>
                        <TableCell className="text-center font-semibold">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono">
                          {item.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.qtyNotReceived > 0 ? (
                            <span className="text-red-600 font-semibold">{item.qtyNotReceived}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.amountNotReceived > 0 ? (
                            <span className="text-red-600 font-semibold">
                              {item.amountNotReceived.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.qtyDamaged > 0 ? (
                            <span className="text-orange-600 font-semibold">{item.qtyDamaged}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.amountDamaged > 0 ? (
                            <span className="text-orange-600 font-semibold">
                              {item.amountDamaged.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono bg-red-50">
                          <span className="font-bold text-red-700">
                            {(item.amountNotReceived + item.amountDamaged).toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-gray-100">
                    <TableCell colSpan={6} className="text-right font-bold text-lg">
                      总计 / Total:
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {totals.qtyNotReceived}
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      ¥{totals.amountNotReceived.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {totals.qtyDamaged}
                    </TableCell>
                    <TableCell className="text-right font-bold text-orange-600">
                      ¥{totals.amountDamaged.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-xl text-red-700 bg-red-100">
                      ¥{totals.totalRefund.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 print:hidden">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Screenshot
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
