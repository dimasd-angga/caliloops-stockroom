
'use client';
import * as React from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Sku, Unit, InboundShipment, Pack, Barcode as BarcodeType, StockOpnameLog, Permissions } from '@/lib/types';
import { updateSkuDetails } from '@/lib/services/skuService';
import {
    addInboundShipment,
    getShipmentsBySku,
    getBarcode,
    getBarcodesByBarcodeIds,
    markBarcodesAsPrinted,
} from '@/lib/services/inboundService';
import {
    PlusCircle,
    X,
    Loader2,
    ArrowLeft,
    Printer,
    AlertTriangle,
    Download,
    ClipboardList,
    History,
    Edit,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UserContext } from '@/app/dashboard/layout';
import { Separator } from '@/components/ui/separator';
import Barcode from 'react-barcode';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { subscribeToStockOpnameLogs } from '@/lib/services/stockOpnameService';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { usePDF } from 'react-to-pdf';

const units: Unit[] = ['pcs', 'box', 'carton', 'pallet'];

type QuantityPack = {
    quantity: number;
    unit: Unit;
    note: string;
};

type PrintContextType = 'all' | 'selected' | 'single';

interface SkuDetailProps {
    sku: Sku;
    onBack: () => void;
    onSkuUpdate: (sku: Sku) => void;
    permissions: Permissions;
}

export function SkuDetail({ sku: initialSku, onBack, onSkuUpdate, permissions }: SkuDetailProps) {
    const { toast } = useToast();
    const router = useRouter();
    const { user, selectedStoreId } = React.useContext(UserContext);

    const [selectedSku, setSelectedSku] = React.useState<Sku>(initialSku);
    const [skuShipments, setSkuShipments] = React.useState<InboundShipment[]>([]);
    const [loadingSkuDetails, setLoadingSkuDetails] = React.useState(false);

    // Edit SKU Modal
    const [isEditSkuModalOpen, setIsEditSkuModalOpen] = React.useState(false);
    const [editingSku, setEditingSku] = React.useState<Sku | null>(null);
    const [isSavingSku, setIsSavingSku] = React.useState(false);

    // Create Shipment Modal State
    const [isCreateShipmentModalOpen, setIsCreateShipmentModalOpen] = React.useState(false);
    const [supplier, setSupplier] = React.useState('');
    const [poNumber, setPoNumber] = React.useState('');
    const [quantitiesPerPack, setQuantitiesPerPack] = React.useState<QuantityPack[]>([{ quantity: 0, unit: 'pcs', note: '' }]);
    const [isSavingShipment, setIsSavingShipment] = React.useState(false);

    // Audit History Modal State
    const [isAuditHistoryModalOpen, setIsAuditHistoryModalOpen] = React.useState(false);
    const [auditLogs, setAuditLogs] = React.useState<StockOpnameLog[]>([]);
    const [loadingAuditLogs, setLoadingAuditLogs] = React.useState(false);

    // Selective Print State
    const [selectedPacks, setSelectedPacks] = React.useState<Set<string>>(new Set());

    // PDF Print State
    const [isPdfPrintModalOpen, setIsPdfPrintModalOpen] = React.useState(false);
    const [pdfBarcodes, setPdfBarcodes] = React.useState<BarcodeType[]>([]);
    const [loadingPdfBarcodes, setLoadingPdfBarcodes] = React.useState(false);
    const [printContext, setPrintContext] = React.useState<PrintContextType | null>(null);

    // Reprint Confirmation Modal
    const [isReprintConfirmOpen, setIsReprintConfirmOpen] = React.useState(false);
    const [barcodesToReprint, setBarcodesToReprint] = React.useState<string[]>([]);

    const pdfFilename = `barcodes-${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.pdf`;
    const { toPDF, targetRef } = usePDF({
        filename: pdfFilename,
        page: { margin: 1, format: [20, 50], orientation: 'landscape' }
    });

    const fetchSkuDetails = React.useCallback(async (skuToFetch: Sku) => {
        setLoadingSkuDetails(true);
        try {
            const shipments = await getShipmentsBySku(skuToFetch.id);
            setSkuShipments(shipments);
        } catch (e) {
            toast({
                title: 'Error loading SKU details',
                description: 'Could not load shipment data for this SKU.',
                variant: 'destructive',
            });
        } finally {
            setLoadingSkuDetails(false);
        }
    }, [toast]);

    React.useEffect(() => {
        setSelectedSku(initialSku);
        fetchSkuDetails(initialSku);
    }, [initialSku, fetchSkuDetails]);

    React.useEffect(() => {
        if (isAuditHistoryModalOpen && selectedSku?.storeId) {
            setLoadingAuditLogs(true);
            const unsubscribe = subscribeToStockOpnameLogs(
                selectedSku.storeId,
                (logs) => {
                    setAuditLogs(logs);
                    setLoadingAuditLogs(false);
                },
                (error) => {
                    toast({ title: 'Error fetching audit logs', variant: 'destructive' });
                    setLoadingAuditLogs(false);
                },
                selectedSku.skuCode
            );
            return () => unsubscribe();
        }
    }, [isAuditHistoryModalOpen, selectedSku?.storeId, selectedSku?.skuCode, toast]);

    const handleOpenEditSkuModal = (sku: Sku) => {
        setEditingSku({ ...sku });
        setIsEditSkuModalOpen(true);
    }

    const handleUpdateSku = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSku) return;

        setIsSavingSku(true);
        try {
            const finalSkuName = editingSku.skuName.trim() === '' ? editingSku.skuCode : editingSku.skuName;
            const updateData = {
                skuName: finalSkuName,
                imageUrl: editingSku.imageUrl,
            };
            await updateSkuDetails(editingSku.id, updateData);
            onSkuUpdate({ ...selectedSku, ...updateData }); // Update parent state
            toast({ title: "SKU updated successfully!" });
            setIsEditSkuModalOpen(false);
            setEditingSku(null);
        } catch (error) {
            toast({ title: 'Error updating SKU', variant: 'destructive' });
        } finally {
            setIsSavingSku(false);
        }
    }

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
            const stringValue = value as string;
            // Allow only numbers and empty string
            if (/^[0-9]*$/.test(stringValue)) {
                newQuantities[index].quantity = stringValue === '' ? 0 : parseInt(stringValue, 10);
            }
        } else if (field === 'unit') {
            newQuantities[index].unit = value as Unit;
        } else {
            newQuantities[index].note = value as string;
        }
        setQuantitiesPerPack(newQuantities);
    };

    const resetShipmentForm = () => {
        setSupplier('');
        setPoNumber('');
        setQuantitiesPerPack([{ quantity: 0, unit: 'pcs', note: '' }]);
    };

    const handleSubmitShipment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSku) {
            toast({ title: "No SKU selected", variant: "destructive" });
            return;
        }
        if (!permissions?.canGenerateBarcode && !permissions?.hasFullAccess) {
            toast({ title: "Permission Denied", variant: "destructive" });
            return;
        }
        if (!supplier || !poNumber) {
            toast({ title: 'Missing Fields', variant: 'destructive' });
            return;
        }
        const validQuantities = quantitiesPerPack.filter((q) => q.quantity > 0);
        if (validQuantities.length === 0) {
            toast({ title: 'Invalid Quantities', variant: 'destructive' });
            return;
        }

        setIsSavingShipment(true);
        try {
            await addInboundShipment(
                { storeId: selectedSku.storeId, skuId: selectedSku.id, skuName: selectedSku.skuName, skuCode: selectedSku.skuCode, supplier, poNumber, createdBy: user?.name || 'System' },
                validQuantities
            );
            toast({ title: 'Shipment and barcodes created successfully!' });
            resetShipmentForm();
            setIsCreateShipmentModalOpen(false);
            fetchSkuDetails(selectedSku);
        } catch (error) {
            toast({ title: 'Error creating shipment', variant: 'destructive' });
        } finally {
            setIsSavingShipment(false);
        }
    };

    const handleStartAudit = () => {
        if (!selectedSku) return;
        router.push(`/dashboard/stock-opname?skuCode=${selectedSku.skuCode}`);
    };

    const handleSinglePdfPrint = async (barcodeId: string) => {
        if (!selectedSku) return;
        setPrintContext('single');

        const allPacksForSku = skuShipments.flatMap(s => s.packs);
        const packToPrint = allPacksForSku.find(p => p.barcodeId === barcodeId);

        if (packToPrint?.isPrinted && (permissions?.canReprintBarcode || permissions?.hasFullAccess)) {
            setBarcodesToReprint([barcodeId]);
            setIsReprintConfirmOpen(true);
        } else {
            handleConfirmPdfPrint([barcodeId]);
        }
    };

    const handlePdfPrintAction = async (context: PrintContextType) => {
        if (!selectedSku) return;
        setPrintContext(context);

        const allPacksForSku = skuShipments.flatMap(s => s.packs);
        let packsToCheck: Pack[] = [];

        if (context === 'all') {
            packsToCheck = allPacksForSku.filter(p => p.status === 'in-stock');
        } else { // 'selected'
            if (selectedPacks.size === 0) {
                toast({ title: "No packs selected for printing.", variant: 'destructive' });
                return;
            }
            packsToCheck = allPacksForSku.filter(p => p.barcodeId && selectedPacks.has(p.barcodeId));
        }

        const alreadyPrintedIds = packsToCheck.filter(p => p.isPrinted).map(p => p.barcodeId!);

        if (alreadyPrintedIds.length > 0 && (permissions?.canReprintBarcode || permissions?.hasFullAccess)) {
            setBarcodesToReprint(alreadyPrintedIds);
            setIsReprintConfirmOpen(true);
        } else {
            const barcodeIdsToPrint = packsToCheck
                .filter(p => !p.isPrinted)
                .map(p => p.barcodeId!);
            handleConfirmPdfPrint(barcodeIdsToPrint);
        }
    };

    const handleConfirmPdfPrint = async (idsToPrint?: string[]) => {
        if (!selectedSku || (!printContext && !idsToPrint)) return;

        const storeIdForAction = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;
        if (!storeIdForAction) {
            toast({ title: "No store selected", variant: "destructive" });
            return;
        }

        setIsReprintConfirmOpen(false);
        setIsPdfPrintModalOpen(true);
        setLoadingPdfBarcodes(true);

        try {
            let barcodeIdsToFetch: string[] = [];

            if(idsToPrint) {
                barcodeIdsToFetch = idsToPrint;
            } else if (printContext === 'all') {
                barcodeIdsToFetch = skuShipments.flatMap(s => s.packs).filter(p => p.status === 'in-stock' && (!p.isPrinted || permissions?.canReprintBarcode || permissions?.hasFullAccess)).map(p => p.barcodeId!);
            } else if (printContext === 'selected') {
                barcodeIdsToFetch = Array.from(selectedPacks);
            } else if (printContext === 'single' && barcodesToReprint.length > 0) {
                barcodeIdsToFetch = barcodesToReprint;
            }

            if(barcodeIdsToFetch.length === 0) {
                toast({ title: "No valid barcodes to print.", description: "Items might be already printed or not in stock.", variant: "destructive" });
                setIsPdfPrintModalOpen(false);
                setLoadingPdfBarcodes(false);
                return;
            }

            const barcodesToPrint = await getBarcodesByBarcodeIds(barcodeIdsToFetch, storeIdForAction);
            const unprintedBarcodeIds = barcodesToPrint.filter(b => !b.isPrinted).map(b => b.id);

            setPdfBarcodes(barcodesToPrint);

            if (unprintedBarcodeIds.length > 0) {
                await markBarcodesAsPrinted(unprintedBarcodeIds);
                toast({ title: `${unprintedBarcodeIds.length} barcode(s) marked as printed.` });
            }

            fetchSkuDetails(selectedSku);

        } catch (error: any) {
            console.error("Error preparing PDF barcodes:", error);
            toast({ title: "Error fetching barcodes for printing", description: error.message, variant: "destructive" });
            setIsPdfPrintModalOpen(false);
        } finally {
            setLoadingPdfBarcodes(false);
        }
    };

    const handleSelectAllPacks = (checked: boolean) => {
        if (checked) {
            const allPackIds = skuShipments
                .flatMap(s => s.packs)
                .filter(p => !p.isPrinted || permissions?.canReprintBarcode || permissions?.hasFullAccess)
                .map(p => p.barcodeId)
                .filter(Boolean) as string[];
            setSelectedPacks(new Set(allPackIds));
        } else {
            setSelectedPacks(new Set());
        }
    };

    const handleSelectPack = (packBarcodeId: string, checked: boolean) => {
        const newSelectedPacks = new Set(selectedPacks);
        if (checked) {
            newSelectedPacks.add(packBarcodeId);
        } else {
            newSelectedPacks.delete(packBarcodeId);
        }
        setSelectedPacks(newSelectedPacks);
    };

    const allPrintablePacks = skuShipments.flatMap(s => s.packs).filter(p => !p.isPrinted || permissions?.canReprintBarcode || permissions?.hasFullAccess);
    const isAllSelected = allPrintablePacks.length > 0 && allPrintablePacks.every(p => p.barcodeId && selectedPacks.has(p.barcodeId));
    const hasUnprintedItems = skuShipments.flatMap(s => s.packs).some(p => !p.isPrinted);

    return (
        <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={onBack} className="w-fit">
                <ArrowLeft className="mr-2 h-4 w-4"/>
                Back to SKU List
            </Button>

            <div className="space-y-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">{selectedSku.skuName}</h1>
                        {(permissions?.canEditItemDetails || permissions?.hasFullAccess) && (
                            <Dialog open={isEditSkuModalOpen} onOpenChange={setIsEditSkuModalOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="icon" onClick={() => handleOpenEditSkuModal(selectedSku)}>
                                        <Edit className="h-4 w-4"/>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <form onSubmit={handleUpdateSku}>
                                        <DialogHeader>
                                            <DialogTitle>Edit SKU</DialogTitle>
                                            <DialogDescription>Update the details for SKU: {editingSku?.skuCode}</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="editingSkuName">SKU Name (Optional)</Label>
                                                <Input id="editingSkuName" value={editingSku?.skuName || ''} onChange={(e) => setEditingSku(prev => prev ? {...prev, skuName: e.target.value} : null)} />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="editingSkuCode">SKU Code</Label>
                                                <Input id="editingSkuCode" value={editingSku?.skuCode || ''} disabled />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="editingSkuImageUrl">Image URL (Optional)</Label>
                                                <Input id="editingSkuImageUrl" value={editingSku?.imageUrl || ''} onChange={(e) => setEditingSku(prev => prev ? {...prev, imageUrl: e.target.value} : null)} placeholder="https://example.com/image.jpg" />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" type="button" onClick={() => setIsEditSkuModalOpen(false)}>Cancel</Button>
                                            <Button type="submit" disabled={isSavingSku}>
                                                {isSavingSku && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Save Changes
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Dialog open={isAuditHistoryModalOpen} onOpenChange={setIsAuditHistoryModalOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <History className="mr-2 h-4 w-4"/>
                                    Audit History
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                    <DialogTitle>Audit History for {selectedSku.skuCode}</DialogTitle>
                                    <DialogDescription>
                                        A log of all completed stock opname activities for this SKU.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date/Time</TableHead>
                                                <TableHead>System (Packs/Pcs)</TableHead>
                                                <TableHead>Found (Packs/Pcs)</TableHead>
                                                <TableHead>Missing (Packs/Pcs)</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loadingAuditLogs ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center">
                                                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                                    </TableCell>
                                                </TableRow>
                                            ) : auditLogs.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center">
                                                        No audit logs found for this SKU.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                auditLogs.map((log) => (
                                                    <TableRow key={log.id}>
                                                        <TableCell>
                                                            {log.datetime.toDate().toLocaleString()}
                                                        </TableCell>
                                                        <TableCell>{log.totalPacks} / {log.totalPcs}</TableCell>
                                                        <TableCell>{log.totalOKPacks} / {log.totalOKPcs}</TableCell>
                                                        <TableCell>{log.totalNotOKPacks} / {log.totalNotOKPcs}</TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant={
                                                                    log.status === 'OK' ? 'success' : 'destructive'
                                                                }
                                                            >
                                                                {log.status}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsAuditHistoryModalOpen(false)}>Close</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        {(permissions?.canPrintSelected || permissions?.hasFullAccess) && (hasUnprintedItems || permissions?.canReprintBarcode || permissions?.hasFullAccess) && (
                            <Button variant="outline" size="sm" onClick={() => handlePdfPrintAction('selected')} disabled={selectedPacks.size === 0}>
                                <Printer className="mr-2 h-4 w-4"/>
                                Print Selected ({selectedPacks.size})
                            </Button>
                        )}
                        {(permissions?.canPrintAll || permissions?.hasFullAccess) && (hasUnprintedItems || permissions?.canReprintBarcode || permissions?.hasFullAccess) && (
                            <Button variant="outline" size="sm" onClick={() => handlePdfPrintAction('all')} disabled={skuShipments.flatMap(s => s.packs).length === 0}>
                                <Printer className="mr-2 h-4 w-4"/>
                                Print All
                            </Button>
                        )}
                        {(permissions?.canStartStockOpname || permissions?.hasFullAccess) && (
                            <Button variant="outline" size="sm" onClick={handleStartAudit}>
                                <ClipboardList className="mr-2 h-4 w-4"/>
                                Start Audit
                            </Button>
                        )}
                        {(permissions?.canGenerateBarcode || permissions?.hasFullAccess) && (
                            <Dialog open={isCreateShipmentModalOpen} onOpenChange={setIsCreateShipmentModalOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm"><PlusCircle className="mr-2 h-4 w-4"/>New Shipment</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <form onSubmit={handleSubmitShipment}>
                                        <DialogHeader>
                                            <DialogTitle>Create New Shipment</DialogTitle>
                                            <DialogDescription>For SKU: <strong>{selectedSku.skuCode}</strong></DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-6 py-6">
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="supplier">Supplier</Label>
                                                    <Input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} required disabled={isSavingShipment}/>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="poNumber">PO Number</Label>
                                                    <Input id="poNumber" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required disabled={isSavingShipment}/>
                                                </div>
                                            </div>
                                            <Separator />
                                            <div className="grid gap-4">
                                                <Label>Quantity per Pack</Label>
                                                {quantitiesPerPack.map((pack, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <Input type="text" inputMode="numeric" pattern="[0-9]*" value={pack.quantity === 0 ? '' : pack.quantity} onChange={(e) => handleQuantityChange(index, 'quantity', e.target.value)} placeholder="Qty" className="w-24" disabled={isSavingShipment}/>
                                                        <Select value={pack.unit} onValueChange={(value) => handleQuantityChange(index, 'unit', value)} disabled={isSavingShipment}>
                                                            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Unit" /></SelectTrigger>
                                                            <SelectContent>
                                                                {units.map((unit) => (<SelectItem key={unit} value={unit}>{unit}</SelectItem>))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Input type="text" value={pack.note} onChange={(e) => handleQuantityChange(index, 'note', e.target.value)} placeholder="Optional note" className="flex-grow" disabled={isSavingShipment}/>
                                                        {quantitiesPerPack.length > 1 && (
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveQuantityInput(index)} disabled={isSavingShipment}><X className="h-4 w-4" /></Button>
                                                        )}
                                                    </div>
                                                ))}
                                                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={handleAddQuantityInput} disabled={isSavingShipment}>
                                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Another Pack
                                                </Button>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" type="button" onClick={() => setIsCreateShipmentModalOpen(false)} disabled={isSavingShipment}>Cancel</Button>
                                            <Button type="submit" disabled={isSavingShipment}>
                                                {isSavingShipment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Submit Shipment
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>
                <div className="text-sm text-muted-foreground space-x-4">
                    <span>SKU: <strong>{selectedSku.skuCode}</strong></span>
                    <Separator orientation="vertical" className="h-4 inline-block" />
                    <span>Last Audited: <strong>{selectedSku.lastAuditDate ? selectedSku.lastAuditDate.toDate().toLocaleDateString() : 'Never'}</strong></span>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {(hasUnprintedItems || permissions?.canReprintBarcode || permissions?.hasFullAccess) && (
                                        <TableHead className="w-[50px]">
                                            <Checkbox
                                                onCheckedChange={(checked) => handleSelectAllPacks(Boolean(checked))}
                                                checked={isAllSelected}
                                                aria-label="Select all rows"
                                            />
                                        </TableHead>
                                    )}
                                    <TableHead>PO Number</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Pack Qty</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Printed</TableHead>
                                    <TableHead>Shipment Date</TableHead>
                                    <TableHead className='text-right'>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingSkuDetails ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : skuShipments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">
                                            No shipments found for this SKU yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    skuShipments.map((shipment) => (
                                        shipment.packs.map((pack) => {
                                            return (
                                                <TableRow key={pack.id}>
                                                    {(hasUnprintedItems || permissions?.canReprintBarcode || permissions?.hasFullAccess) && (
                                                        <TableCell>
                                                            {pack.barcodeId && (!pack.isPrinted || permissions?.canReprintBarcode || permissions?.hasFullAccess) && (
                                                                <Checkbox
                                                                    onCheckedChange={(checked) => handleSelectPack(pack.barcodeId!, Boolean(checked))}
                                                                    checked={selectedPacks.has(pack.barcodeId)}
                                                                    aria-label={`Select row for barcode ${pack.barcodeId}`}
                                                                />
                                                            )}
                                                        </TableCell>
                                                    )}
                                                    <TableCell>{shipment.poNumber}</TableCell>
                                                    <TableCell>{shipment.supplier}</TableCell>
                                                    <TableCell>{pack.quantity}</TableCell>
                                                    <TableCell>{pack.unit}</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={
                                                                pack.status === 'lost' ? 'destructive' :
                                                                    pack.status === 'in-stock' ? 'success' :
                                                                        'outline'
                                                            }
                                                            className="flex items-center w-fit"
                                                        >
                                                            {pack.status === 'lost' && <AlertTriangle className="h-3 w-3 mr-1.5" />}
                                                            {pack.status?.replace('-', ' ').toUpperCase()}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            className={cn(
                                                                'uppercase',
                                                                pack.isPrinted
                                                                    ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-400/80'
                                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-200/80 dark:bg-secondary dark:text-secondary-foreground'
                                                            )}
                                                        >
                                                            {pack.isPrinted ? 'Printed' : 'Not Printed'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{shipment.createdAt.toDate().toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        {pack.barcodeId && (!pack.isPrinted || permissions?.canReprintBarcode || permissions?.hasFullAccess) && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleSinglePdfPrint(pack.barcodeId!)}
                                                            >
                                                                <Printer className="mr-2 h-4 w-4"/>
                                                                View Barcode
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={isReprintConfirmOpen} onOpenChange={setIsReprintConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Bulk Re-Print</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to generate a PDF that includes {barcodesToReprint.length} barcode(s) that have already been printed. Do you want to continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setBarcodesToReprint([])}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleConfirmPdfPrint(barcodesToReprint)}>Yes, Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={isPdfPrintModalOpen} onOpenChange={setIsPdfPrintModalOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Print Barcodes to PDF</DialogTitle>
                        <DialogDescription>
                            A PDF with {pdfBarcodes.length} labels will be generated. Use the download button to save the file.
                        </DialogDescription>
                    </DialogHeader>
                    {loadingPdfBarcodes ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {/* Hidden container for PDF generation */}
                            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                                <div ref={targetRef}>
                                    {pdfBarcodes.map((barcode, index) => (
                                        <div className='relative' key={barcode.id} style={
                                            {
                                                pageBreakAfter: index === pdfBarcodes.length - 1 ? 'auto' : 'always',
                                                overflow: 'visible',
                                                height: 75,
                                                width: 200,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                            <Barcode format={"ITF"} value={barcode.barcodeID} height={25} width={1} fontSize={7} margin={0} />
                                            <p className="text-[6px] leading-none mt-[-2px] text-center" style={{
                                                position: "absolute",
                                                bottom: 17
                                            }}>{barcode.skuCode}</p>
                                            <p className="text-[6px] font-sans leading-none mt-[-14px] text-center" style={{
                                                position: "absolute",
                                                bottom: 12
                                            }}>{barcode.poNumber?.toUpperCase()} {barcode.supplier?.toUpperCase()}</p>
                                            <p className="text-[6px] font-sans leading-none mt-[-16px] text-center" style={{
                                                position: "absolute",
                                                bottom: 7
                                            }}>{barcode.quantity} {barcode.unit.toUpperCase()}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <ScrollArea className="h-96">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                                    {pdfBarcodes.map((barcode) => (
                                        <div key={`preview-${barcode.id}`} className="p-2 border rounded-md flex flex-col items-center justify-center aspect-[5/2]">
                                            <Barcode format={"ITF"} value={barcode.barcodeID} height={25} width={1} fontSize={7} margin={0}/>
                                            <p className="text-[6px] leading-none text-center mt-[2px]">{barcode.skuCode}</p>
                                            <p className="text-[6px] font-sans leading-none text-center mt-[1px]">{barcode.poNumber?.toUpperCase()} {barcode.supplier?.toUpperCase()}</p>
                                            <p className="text-[6px] font-sans leading-none text-center mt-[1px]">{barcode.quantity} {barcode.unit.toUpperCase()}</p>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPdfPrintModalOpen(false)}>Close</Button>
                        <Button onClick={() => toPDF()} disabled={loadingPdfBarcodes || pdfBarcodes.length === 0}>
                            <Download className="mr-2 h-4 w-4"/>
                            Download PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
