'use client';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { addSku, checkSkuExists } from '@/lib/services/skuService';
import type { Sku } from '@/lib/types';

interface SkuCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  onSkuCreated?: (sku: Sku) => void;
}

export function SkuCreationModal({ open, onOpenChange, storeId, onSkuCreated }: SkuCreationModalProps) {
  const { toast } = useToast();
  const [newSkuName, setNewSkuName] = React.useState('');
  const [newSkuCode, setNewSkuCode] = React.useState('');
  const [newSkuImageUrl, setNewSkuImageUrl] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const resetForm = () => {
    setNewSkuName('');
    setNewSkuCode('');
    setNewSkuImageUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeId) {
      toast({ title: 'You must select a store to create an SKU.', variant: 'destructive' });
      return;
    }

    if (!newSkuCode) {
      toast({ title: 'SKU Code is required.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const skuExists = await checkSkuExists(newSkuCode, storeId);
      if (skuExists) {
        toast({
          title: 'SKU Code Exists',
          description: 'This SKU code already exists for the selected store.',
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      const finalSkuName = newSkuName.trim() === '' ? newSkuCode : newSkuName;

      const skuData = {
        storeId,
        skuName: finalSkuName,
        skuCode: newSkuCode,
        imageUrl: newSkuImageUrl,
      };

      const skuId = await addSku(skuData);

      // Create the full SKU object to return
      const createdSku: Sku = {
        id: skuId,
        storeId,
        skuName: finalSkuName,
        skuCode: newSkuCode,
        imageUrl: newSkuImageUrl,
        remainingQuantity: 0,
        remainingPacks: 0,
      };

      toast({ title: 'SKU created successfully!' });
      resetForm();
      onOpenChange(false);

      // Call the callback with the created SKU
      if (onSkuCreated) {
        onSkuCreated(createdSku);
      }
    } catch (error) {
      console.error('Error creating SKU:', error);
      toast({ title: 'Error creating SKU', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New SKU</DialogTitle>
            <DialogDescription>
              Add a new stock keeping unit to the system for your store.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newSkuName">SKU Name (Optional)</Label>
              <Input
                id="newSkuName"
                value={newSkuName}
                onChange={(e) => setNewSkuName(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newSkuCode">SKU Code</Label>
              <Input
                id="newSkuCode"
                value={newSkuCode}
                onChange={(e) => setNewSkuCode(e.target.value)}
                required
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newSkuImageUrl">Image URL (Optional)</Label>
              <Input
                id="newSkuImageUrl"
                value={newSkuImageUrl}
                onChange={(e) => setNewSkuImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                disabled={isSaving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create SKU
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
