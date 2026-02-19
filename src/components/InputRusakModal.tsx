'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NumericInput } from '@/components/ui/numeric-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { POReceiveItem } from '@/lib/types';

interface InputRusakModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: POReceiveItem | null;
  onSave: (damagedQty: number) => Promise<void>;
}

export function InputRusakModal({
  open,
  onOpenChange,
  item,
  onSave,
}: InputRusakModalProps) {
  const [damagedQty, setDamagedQty] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // Reset when item changes
  React.useEffect(() => {
    if (item) {
      setDamagedQty(item.qtyDamaged);
      setError('');
    }
  }, [item]);

  const maxAllowed = item ? item.quantity - item.qtyReceived : 0;

  const handleSave = async () => {
    if (!item) return;

    // Validation
    if (damagedQty < 0) {
      setError('Damaged quantity cannot be negative');
      return;
    }

    if (damagedQty > maxAllowed) {
      setError(`Damaged quantity cannot exceed ${maxAllowed} (Ordered ${item.quantity} - Received ${item.qtyReceived})`);
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave(damagedQty);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save damaged quantity');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Input Qty Rusak (坏掉的数量)</DialogTitle>
          <DialogDescription>
            Enter the quantity of damaged items for: <strong>{item.itemCode} - {item.itemName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Item Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Original Quantity</Label>
              <p className="font-semibold">{item.quantity} pcs</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Qty Received</Label>
              <p className="font-semibold">{item.qtyReceived} pcs</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Current Qty Damaged</Label>
              <p className="font-semibold">{item.qtyDamaged} pcs</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Max Allowed</Label>
              <p className="font-semibold text-orange-600">{maxAllowed} pcs</p>
            </div>
          </div>

          {/* Input */}
          <div>
            <Label htmlFor="damagedQty">Qty Rusak (坏掉的数量) *</Label>
            <NumericInput
              id="damagedQty"
              value={damagedQty}
              onValueChange={setDamagedQty}
              placeholder="Enter damaged quantity"
              className="mt-2"
              min={0}
              max={maxAllowed}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum: {maxAllowed} pcs
            </p>
          </div>

          {/* Preview Calculation */}
          {damagedQty > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Preview:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Qty Rusak: {damagedQty} pcs</li>
                  <li>• Qty Tidak Diterima: {Math.max(0, item.quantity - item.qtyReceived - damagedQty)} pcs</li>
                  <li>• Amount Rusak: ¥{(damagedQty * item.unitPrice).toFixed(2)}</li>
                  <li>• Total Pcs Final: {item.qtyReceived + Math.max(0, item.quantity - item.qtyReceived - damagedQty) + damagedQty} pcs</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
