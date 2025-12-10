'use client';

import { useEffect, useState, useRef, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    subscribeToCouriers,
    addCourier,
    updateCourier,
    deleteCourier,
} from '@/lib/services/courierService';
import type { Courier } from '@/lib/types';
import {
    downloadCouriersExcel,
    downloadCourierTemplate,
    parseCouriersFromExcel,
} from '@/lib/services/excelService';
import { Download, Upload, FileSpreadsheet, PlusCircle, Pencil, Trash2, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { UserContext } from '@/app/dashboard/layout';

interface ImportPreviewItem {
    row: number;
    data: Partial<Courier>;
    status: 'new' | 'duplicate' | 'error';
    error?: string;
    existingCourier?: Courier;
}

export default function CouriersPage() {
    const [couriers, setCouriers] = useState<Courier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
    const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [courierToDelete, setCourierToDelete] = useState<Courier | null>(null);
    const [importing, setImporting] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [importResults, setImportResults] = useState<any>(null);
    const [previewData, setPreviewData] = useState<ImportPreviewItem[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Get storeId from context
    const { user, selectedStoreId } = useContext(UserContext);
    const storeId = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId;

    console.log('[CouriersPage] Component rendered', {
        userEmail: user?.email,
        userStoreId: user?.storeId,
        selectedStoreId,
        computedStoreId: storeId
    });

    const [formData, setFormData] = useState({
        courierCode: '',
        name: '',
        marking: '',
        contactPerson: '',
        warehouseAddress: '',
    });

    useEffect(() => {
        console.log('[CouriersPage] Effect triggered', { storeId });

        if (!storeId) {
            console.warn('[CouriersPage] No storeId available, skipping subscription');
            setLoading(false);
            return;
        }

        console.log('[CouriersPage] Starting subscription for storeId:', storeId);

        const unsubscribe = subscribeToCouriers(
            storeId,
            (data) => {
                console.log('[CouriersPage] Couriers received:', data.length, data);
                setCouriers(data);
                setLoading(false);
            },
            (error) => {
                console.error('[CouriersPage] Error loading couriers:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to load couriers',
                    variant: 'destructive',
                });
                setLoading(false);
            }
        );

        return () => {
            console.log('[CouriersPage] Cleaning up subscription');
            unsubscribe();
        };
    }, [storeId, toast]);

    const handleExport = () => {
        if (couriers.length === 0) {
            toast({
                title: 'No Data',
                description: 'There are no couriers to export',
                variant: 'destructive',
            });
            return;
        }

        downloadCouriersExcel(couriers);
        toast({
            title: 'Success',
            description: `Exported ${couriers.length} couriers to Excel`,
        });
    };

    const handleDownloadTemplate = () => {
        downloadCourierTemplate();
        toast({
            title: 'Downloaded',
            description: 'Template file downloaded successfully',
        });
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setAnalyzing(true);

            // Parse Excel file
            const parsedCouriers = await parseCouriersFromExcel(file);

            // Analyze each row
            const preview: ImportPreviewItem[] = [];

            for (let i = 0; i < parsedCouriers.length; i++) {
                const courier = parsedCouriers[i];
                const row = i + 2; // +2 because row 1 is header, array is 0-indexed

                // Check for validation errors
                if (!courier.courierCode || !courier.name) {
                    preview.push({
                        row,
                        data: courier,
                        status: 'error',
                        error: 'Missing required fields (Courier Code or Name)',
                    });
                    continue;
                }

                // Check for duplicates
                const existingCourier = couriers.find(
                    c => c.courierCode.toLowerCase() === courier.courierCode.toLowerCase()
                );

                if (existingCourier) {
                    preview.push({
                        row,
                        data: courier,
                        status: 'duplicate',
                        existingCourier,
                    });
                } else {
                    preview.push({
                        row,
                        data: courier,
                        status: 'new',
                    });
                }
            }

            setPreviewData(preview);
            setIsImportDialogOpen(false);
            setIsPreviewDialogOpen(true);

        } catch (error: any) {
            console.error('Analysis error:', error);
            toast({
                title: 'File Analysis Failed',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setAnalyzing(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!storeId) {
            toast({
                title: 'No Store Selected',
                description: 'Please select a store before importing',
                variant: 'destructive',
            });
            return;
        }

        try {
            setImporting(true);

            const results = {
                success: [] as string[],
                failed: [] as { row: number; error: string; data: any }[],
                skipped: [] as { row: number; reason: string; data: any }[],
            };

            // Only import items with status 'new'
            const itemsToImport = previewData.filter(item => item.status === 'new');

            for (const item of itemsToImport) {
                try {
                    const courierId = await addCourier({
                        courierCode: item.data.courierCode!,
                        name: item.data.name!,
                        marking: item.data.marking || '',
                        contactPerson: item.data.contactPerson || '',
                        warehouseAddress: item.data.warehouseAddress || '',
                        storeId,
                    });

                    results.success.push(courierId);
                } catch (error: any) {
                    console.error('Error adding courier:', error);
                    results.failed.push({
                        row: item.row,
                        error: error.message || 'Failed to add courier',
                        data: item.data,
                    });
                }
            }

            // Track skipped items (duplicates and errors)
            previewData.forEach(item => {
                if (item.status === 'duplicate') {
                    results.skipped.push({
                        row: item.row,
                        reason: 'Duplicate courier code',
                        data: item.data,
                    });
                } else if (item.status === 'error') {
                    results.skipped.push({
                        row: item.row,
                        reason: item.error || 'Validation error',
                        data: item.data,
                    });
                }
            });

            // Show results
            setImportResults({
                total: previewData.length,
                succeeded: results.success.length,
                failed: results.failed.length,
                skipped: results.skipped.length,
                failures: results.failed,
                skippedItems: results.skipped,
            });

            toast({
                title: 'Import Complete',
                description: `Imported ${results.success.length} of ${itemsToImport.length} new couriers`,
            });

            setIsPreviewDialogOpen(false);

        } catch (error: any) {
            console.error('Import error:', error);
            toast({
                title: 'Import Failed',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const getStatusBadge = (status: 'new' | 'duplicate' | 'error') => {
        switch (status) {
            case 'new':
                return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Will Create</Badge>;
            case 'duplicate':
                return <Badge className="bg-yellow-500"><AlertCircle className="w-3 h-3 mr-1" /> Duplicate</Badge>;
            case 'error':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Error</Badge>;
        }
    };

    const previewStats = {
        new: previewData.filter(item => item.status === 'new').length,
        duplicate: previewData.filter(item => item.status === 'duplicate').length,
        error: previewData.filter(item => item.status === 'error').length,
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!storeId) {
            toast({
                title: 'No Store Selected',
                description: 'Please select a store before adding a courier',
                variant: 'destructive',
            });
            return;
        }

        try {
            if (editingCourier) {
                await updateCourier(editingCourier.id, formData);
                toast({
                    title: 'Success',
                    description: 'Courier updated successfully',
                });
            } else {
                await addCourier({
                    ...formData,
                    storeId,
                });
                toast({
                    title: 'Success',
                    description: 'Courier added successfully',
                });
            }

            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error saving courier:', error);
            toast({
                title: 'Error',
                description: 'Failed to save courier',
                variant: 'destructive',
            });
        }
    };

    const handleEdit = (courier: Courier) => {
        setEditingCourier(courier);
        setFormData({
            courierCode: courier.courierCode,
            name: courier.name,
            marking: courier.marking || '',
            contactPerson: courier.contactPerson || '',
            warehouseAddress: courier.warehouseAddress || '',
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!courierToDelete) return;

        try {
            await deleteCourier(courierToDelete.id);
            toast({
                title: 'Success',
                description: 'Courier deleted successfully',
            });
        } catch (error) {
            console.error('Error deleting courier:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete courier',
                variant: 'destructive',
            });
        } finally {
            setDeleteConfirmOpen(false);
            setCourierToDelete(null);
        }
    };

    const resetForm = () => {
        setFormData({
            courierCode: '',
            name: '',
            marking: '',
            contactPerson: '',
            warehouseAddress: '',
        });
        setEditingCourier(null);
    };

    const openAddDialog = () => {
        if (!storeId) {
            toast({
                title: 'No Store Selected',
                description: 'Please select a store from the header before adding couriers',
                variant: 'destructive',
            });
            return;
        }
        resetForm();
        setIsDialogOpen(true);
    };

    // Show message when no store is selected (for superadmin)
    if (!storeId && user?.email === 'superadmin@caliloops.com') {
        return (
            <div className="p-6">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Store Selected</AlertTitle>
                    <AlertDescription>
                        Please select a store from the header dropdown to view and manage couriers.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Couriers</h1>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleDownloadTemplate}
                    >
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Download Template
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setIsImportDialogOpen(true)}
                        disabled={!storeId}
                    >
                        <Upload className="mr-2 h-4 w-4" />
                        Import from Excel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        disabled={couriers.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export to Excel
                    </Button>
                    <Button onClick={openAddDialog} disabled={!storeId}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Courier
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : couriers.length === 0 ? (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Couriers Found</AlertTitle>
                    <AlertDescription>
                        No couriers found for this store. Click &quot;Add Courier&quot; to create one.
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Courier Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Marking</TableHead>
                                <TableHead>Contact Person</TableHead>
                                <TableHead>Warehouse Address</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {couriers.map((courier) => (
                                <TableRow key={courier.id}>
                                    <TableCell>{courier.courierCode}</TableCell>
                                    <TableCell>{courier.name}</TableCell>
                                    <TableCell>{courier.marking}</TableCell>
                                    <TableCell>{courier.contactPerson}</TableCell>
                                    <TableCell>{courier.warehouseAddress}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(courier)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setCourierToDelete(courier);
                                                setDeleteConfirmOpen(true);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingCourier ? 'Edit Courier' : 'Add Courier'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="courierCode">Courier Code*</Label>
                                <Input
                                    id="courierCode"
                                    value={formData.courierCode}
                                    onChange={(e) =>
                                        setFormData({ ...formData, courierCode: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name*</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="marking">Marking</Label>
                                <Input
                                    id="marking"
                                    value={formData.marking}
                                    onChange={(e) =>
                                        setFormData({ ...formData, marking: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="contactPerson">Contact Person</Label>
                                <Input
                                    id="contactPerson"
                                    value={formData.contactPerson}
                                    onChange={(e) =>
                                        setFormData({ ...formData, contactPerson: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="warehouseAddress">Warehouse Address</Label>
                                <Input
                                    id="warehouseAddress"
                                    value={formData.warehouseAddress}
                                    onChange={(e) =>
                                        setFormData({ ...formData, warehouseAddress: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsDialogOpen(false);
                                    resetForm();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editingCourier ? 'Update' : 'Add'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Import Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Couriers from Excel</DialogTitle>
                        <DialogDescription>
                            Upload an Excel file to import couriers. We'll show you a preview before importing.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileSelect}
                            className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                        />
                        {analyzing && (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <p className="text-sm text-muted-foreground">Analyzing file...</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Preview/Confirmation Dialog */}
            <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Import Preview - Confirm Before Importing</DialogTitle>
                        <DialogDescription>
                            Review the data before importing. Only items marked as &quot;Will Create&quot; will be imported.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4 py-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                                    <div className="text-2xl font-bold text-green-600">{previewStats.new}</div>
                                    <p className="text-sm text-muted-foreground">Will Create</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <AlertCircle className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                                    <div className="text-2xl font-bold text-yellow-600">{previewStats.duplicate}</div>
                                    <p className="text-sm text-muted-foreground">Duplicates</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <XCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                                    <div className="text-2xl font-bold text-red-600">{previewStats.error}</div>
                                    <p className="text-sm text-muted-foreground">Errors</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Preview Table */}
                    <ScrollArea className="h-[400px] border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">Row</TableHead>
                                    <TableHead className="w-[140px]">Status</TableHead>
                                    <TableHead>Courier Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Marking</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Note</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewData.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{item.row}</TableCell>
                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                        <TableCell>{item.data.courierCode || '-'}</TableCell>
                                        <TableCell>{item.data.name || '-'}</TableCell>
                                        <TableCell>{item.data.marking || '-'}</TableCell>
                                        <TableCell className="max-w-[150px] truncate">
                                            {item.data.contactPerson || '-'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {item.status === 'duplicate' && (
                                                <span className="text-yellow-600">
                                                    Already exists: {item.existingCourier?.name}
                                                </span>
                                            )}
                                            {item.status === 'error' && (
                                                <span className="text-red-600">{item.error}</span>
                                            )}
                                            {item.status === 'new' && (
                                                <span className="text-green-600">Ready to import</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setIsPreviewDialogOpen(false);
                                setPreviewData([]);
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                            }}
                            disabled={importing}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmImport}
                            disabled={importing || previewStats.new === 0}
                        >
                            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {importing ? 'Importing...' : `Import ${previewStats.new} Courier${previewStats.new !== 1 ? 's' : ''}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the courier &quot;{courierToDelete?.name}&quot;.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Import Results Dialog */}
            {importResults && (
                <Dialog open={!!importResults} onOpenChange={() => setImportResults(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Import Results</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                            <p>Total Rows: {importResults.total}</p>
                            <p className="text-green-600">Successfully Imported: {importResults.succeeded}</p>
                            <p className="text-yellow-600">Skipped (Duplicates/Errors): {importResults.skipped}</p>
                            <p className="text-red-600">Failed: {importResults.failed}</p>

                            {importResults.failures && importResults.failures.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="font-semibold mb-2">Failed Rows:</h4>
                                    <ScrollArea className="max-h-40">
                                        {importResults.failures.map((failure: any, index: number) => (
                                            <p key={index} className="text-sm text-red-600">
                                                Row {failure.row}: {failure.error}
                                            </p>
                                        ))}
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button onClick={() => setImportResults(null)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
