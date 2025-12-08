'use client';

import { useEffect, useState, useRef } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/lib/types';
import { subscribeToSuppliers, addSupplier, updateSupplier, deleteSupplier } from '@/lib/services/supplierService';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    PlusCircle,
    Loader2,
    Truck,
    AlertTriangle,
    MoreHorizontal,
    Edit,
    Trash2,
    Download,
    Upload,
    FileSpreadsheet,
    Pencil,
    CheckCircle2,
    XCircle,
    AlertCircle
} from 'lucide-react';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
    downloadSuppliersExcel,
    downloadSupplierTemplate,
    parseSuppliersFromExcel,
} from '@/lib/services/excelService';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const ROWS_PER_PAGE = 10;

interface ImportPreviewItem {
    row: number;
    data: Partial<Supplier>;
    status: 'new' | 'duplicate' | 'error';
    error?: string;
    existingSupplier?: Supplier;
}

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
    const [importing, setImporting] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [importResults, setImportResults] = useState<any>(null);
    const [previewData, setPreviewData] = useState<ImportPreviewItem[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Replace with actual storeId from your auth/context
    const storeId = 'NVOGTNzCxsPBm7BXUP8P';

    const [formData, setFormData] = useState({
        supplierCode: '',
        name: '',
        description: '',
        chatSearchName: '',
    });

    useEffect(() => {
        const unsubscribe = subscribeToSuppliers(
            storeId,
            (data) => {
                setSuppliers(data);
                setLoading(false);
            },
            (error) => {
                toast({
                    title: 'Error',
                    description: 'Failed to load suppliers',
                    variant: 'destructive',
                });
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [storeId]);

    const handleExport = () => {
        if (suppliers.length === 0) {
            toast({
                title: 'No Data',
                description: 'There are no suppliers to export',
                variant: 'destructive',
            });
            return;
        }

        downloadSuppliersExcel(suppliers);
        toast({
            title: 'Success',
            description: `Exported ${suppliers.length} suppliers to Excel`,
        });
    };

    const handleDownloadTemplate = () => {
        downloadSupplierTemplate();
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
            const parsedSuppliers = await parseSuppliersFromExcel(file);

            // Analyze each row
            const preview: ImportPreviewItem[] = [];

            for (let i = 0; i < parsedSuppliers.length; i++) {
                const supplier = parsedSuppliers[i];
                const row = i + 2; // +2 because row 1 is header, array is 0-indexed

                // Check for validation errors
                if (!supplier.supplierCode || !supplier.name) {
                    preview.push({
                        row,
                        data: supplier,
                        status: 'error',
                        error: 'Missing required fields (Supplier Code or Name)',
                    });
                    continue;
                }

                // Check for duplicates
                const existingSupplier = suppliers.find(
                    s => s.supplierCode.toLowerCase() === supplier.supplierCode.toLowerCase()
                );

                if (existingSupplier) {
                    preview.push({
                        row,
                        data: supplier,
                        status: 'duplicate',
                        existingSupplier,
                    });
                } else {
                    preview.push({
                        row,
                        data: supplier,
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
                    const supplierId = await addSupplier({
                        supplierCode: item.data.supplierCode!,
                        name: item.data.name!,
                        description: item.data.description || '',
                        chatSearchName: item.data.chatSearchName || '',
                        storeId,
                    });

                    results.success.push(supplierId);
                } catch (error: any) {
                    console.error('Error adding supplier:', error);
                    results.failed.push({
                        row: item.row,
                        error: error.message || 'Failed to add supplier',
                        data: item.data,
                    });
                }
            }

            // Track skipped items (duplicates and errors)
            previewData.forEach(item => {
                if (item.status === 'duplicate') {
                    results.skipped.push({
                        row: item.row,
                        reason: 'Duplicate supplier code',
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
                description: `Imported ${results.success.length} of ${itemsToImport.length} new suppliers`,
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

        try {
            if (editingSupplier) {
                await updateSupplier(editingSupplier.id, formData);
                toast({
                    title: 'Success',
                    description: 'Supplier updated successfully',
                });
            } else {
                await addSupplier({
                    ...formData,
                    storeId,
                });
                toast({
                    title: 'Success',
                    description: 'Supplier added successfully',
                });
            }

            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save supplier',
                variant: 'destructive',
            });
        }
    };

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setFormData({
            supplierCode: supplier.supplierCode,
            name: supplier.name,
            description: supplier.description || '',
            chatSearchName: supplier.chatSearchName || '',
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!supplierToDelete) return;

        try {
            await deleteSupplier(supplierToDelete.id);
            toast({
                title: 'Success',
                description: 'Supplier deleted successfully',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete supplier',
                variant: 'destructive',
            });
        } finally {
            setDeleteConfirmOpen(false);
            setSupplierToDelete(null);
        }
    };

    const resetForm = () => {
        setFormData({
            supplierCode: '',
            name: '',
            description: '',
            chatSearchName: '',
        });
        setEditingSupplier(null);
    };

    const openAddDialog = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Suppliers</h1>
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
                    >
                        <Upload className="mr-2 h-4 w-4" />
                        Import from Excel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        disabled={suppliers.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export to Excel
                    </Button>
                    <Button onClick={openAddDialog}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Supplier
                    </Button>
                </div>
            </div>

            {loading ? (
                <div>Loading...</div>
            ) : (
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Supplier Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Chat Search Name</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {suppliers.map((supplier) => (
                                <TableRow key={supplier.id}>
                                    <TableCell>{supplier.supplierCode}</TableCell>
                                    <TableCell>{supplier.name}</TableCell>
                                    <TableCell>{supplier.description}</TableCell>
                                    <TableCell>{supplier.chatSearchName}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(supplier)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setSupplierToDelete(supplier);
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
                            {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="supplierCode">Supplier Code*</Label>
                                <Input
                                    id="supplierCode"
                                    value={formData.supplierCode}
                                    onChange={(e) =>
                                        setFormData({ ...formData, supplierCode: e.target.value })
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
                                <Label htmlFor="description">Description</Label>
                                <Input
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="chatSearchName">Chat Search Name</Label>
                                <Input
                                    id="chatSearchName"
                                    value={formData.chatSearchName}
                                    onChange={(e) =>
                                        setFormData({ ...formData, chatSearchName: e.target.value })
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
                                {editingSupplier ? 'Update' : 'Add'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Import Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Suppliers from Excel</DialogTitle>
                        <DialogDescription>
                            Upload an Excel file to import suppliers. We'll show you a preview before importing.
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
                <DialogContent className="max-w-4xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Import Preview - Confirm Before Importing</DialogTitle>
                        <DialogDescription>
                            Review the data before importing. Only items marked as "Will Create" will be imported.
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
                                    <TableHead>Supplier Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Note</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewData.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{item.row}</TableCell>
                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                        <TableCell>{item.data.supplierCode || '-'}</TableCell>
                                        <TableCell>{item.data.name || '-'}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">
                                            {item.data.description || '-'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {item.status === 'duplicate' && (
                                                <span className="text-yellow-600">
                                                    Already exists: {item.existingSupplier?.name}
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
                            {importing ? 'Importing...' : `Import ${previewStats.new} Supplier${previewStats.new !== 1 ? 's' : ''}`}
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
                            This will permanently delete the supplier &quot;{supplierToDelete?.name}&quot;.
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
