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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, PlusCircle, X } from 'lucide-react';
import { NumericInput } from '@/components/ui/numeric-input';
import type { Unit } from '@/lib/types';

const units: Unit[] = ['pcs', 'box', 'carton', 'pallet'];

type QuantityPack = {
    quantity: number;
    unit: Unit;
    note: string;
};

interface InboundShipmentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    skuCode: string;
    supplierId: string;
    supplierName: string;
    poId: string;
    poNumber: string;
    initialPacks?: QuantityPack[]; // Load saved draft
    onSave?: (packs: QuantityPack[]) => Promise<void>;
    onSubmit: (packs: QuantityPack[]) => Promise<void>;
}

export function InboundShipmentModal({
    open,
    onOpenChange,
    skuCode,
    supplierId,
    supplierName,
    poId,
    poNumber,
    initialPacks,
    onSave,
    onSubmit,
}: InboundShipmentModalProps) {
    const [quantitiesPerPack, setQuantitiesPerPack] = React.useState<QuantityPack[]>([
        { quantity: 0, unit: 'pcs', note: '' }
    ]);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Load initial packs when modal opens or initialPacks changes
    React.useEffect(() => {
        if (open && initialPacks && initialPacks.length > 0) {
            setQuantitiesPerPack(initialPacks);
        } else if (open && (!initialPacks || initialPacks.length === 0)) {
            // Reset to default empty pack
            setQuantitiesPerPack([{ quantity: 0, unit: 'pcs', note: '' }]);
        }
    }, [open, initialPacks]);

    const handleAddQuantityInput = () => {
        setQuantitiesPerPack([...quantitiesPerPack, { quantity: 0, unit: 'pcs', note: '' }]);
    };

    const handleRemoveQuantityInput = (index: number) => {
        const newQuantities = [...quantitiesPerPack];
        newQuantities.splice(index, 1);
        setQuantitiesPerPack(newQuantities);
    };

    const handleQuantityChange = (
        index: number,
        field: keyof QuantityPack,
        value: string | number
    ) => {
        const newQuantities = [...quantitiesPerPack];
        if (field === 'quantity') {
            newQuantities[index].quantity = Number(value) || 0;
        } else if (field === 'unit') {
            newQuantities[index].unit = value as Unit;
        } else {
            newQuantities[index].note = value as string;
        }
        setQuantitiesPerPack(newQuantities);
    };

    const resetForm = () => {
        setQuantitiesPerPack([{ quantity: 0, unit: 'pcs', note: '' }]);
    };

    const validateForm = (): string | null => {
        const validQuantities = quantitiesPerPack.filter((q) => q.quantity > 0);
        if (validQuantities.length === 0) {
            return 'At least one pack must have a quantity greater than 0.';
        }
        return null;
    };

    const handleSave = async () => {
        const error = validateForm();
        if (error) {
            alert(error);
            return;
        }

        if (onSave) {
            setIsSaving(true);
            try {
                const validQuantities = quantitiesPerPack.filter((q) => q.quantity > 0);
                await onSave(validQuantities);
                // Don't close modal or reset form on save - allow continued editing
            } catch (error) {
                console.error('Error saving shipment:', error);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleSubmit = async () => {
        const error = validateForm();
        if (error) {
            alert(error);
            return;
        }

        setIsSubmitting(true);
        try {
            const validQuantities = quantitiesPerPack.filter((q) => q.quantity > 0);
            await onSubmit(validQuantities);
            resetForm();
            onOpenChange(false);
        } catch (error) {
            console.error('Error submitting shipment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isProcessing = isSaving || isSubmitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Inbound Shipment</DialogTitle>
                    <DialogDescription>
                        For SKU: <strong>{skuCode}</strong>
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="supplier">
                                Supplier <span className="text-xs text-muted-foreground">(Auto-filled)</span>
                            </Label>
                            <Select value={supplierId} disabled>
                                <SelectTrigger id="supplier">
                                    <SelectValue placeholder="Select a supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={supplierId}>{supplierName}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="poNumber">
                                PO Number <span className="text-xs text-muted-foreground">(Auto-filled)</span>
                            </Label>
                            <Select value={poId} disabled>
                                <SelectTrigger id="poNumber">
                                    <SelectValue placeholder="Select a PO" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={poId}>{poNumber}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Separator />
                    <div className="grid gap-4">
                        <Label>Quantity per Pack</Label>
                        {quantitiesPerPack.map((pack, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <NumericInput
                                    value={pack.quantity}
                                    onValueChange={(value) => handleQuantityChange(index, 'quantity', value)}
                                    placeholder="Qty"
                                    className="w-24"
                                    disabled={isProcessing}
                                />
                                <Select
                                    value={pack.unit}
                                    onValueChange={(value) => handleQuantityChange(index, 'unit', value)}
                                    disabled={isProcessing}
                                >
                                    <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="Unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {units.map((unit) => (
                                            <SelectItem key={unit} value={unit}>
                                                {unit}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    type="text"
                                    value={pack.note}
                                    onChange={(e) => handleQuantityChange(index, 'note', e.target.value)}
                                    placeholder="Optional note"
                                    className="flex-grow"
                                    disabled={isProcessing}
                                />
                                {quantitiesPerPack.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveQuantityInput(index)}
                                        disabled={isProcessing}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={handleAddQuantityInput}
                            disabled={isProcessing}
                        >
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Another Pack
                        </Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => onOpenChange(false)}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    {onSave && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleSave}
                            disabled={isProcessing}
                        >
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    )}
                    <Button type="button" onClick={handleSubmit} disabled={isProcessing}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Shipment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
