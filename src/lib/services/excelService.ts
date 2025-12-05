import * as XLSX from 'xlsx';
import type { Supplier, Courier } from '@/lib/types';
import { format } from 'date-fns';

// ============================================================================
// SUPPLIER EXCEL OPERATIONS
// ============================================================================

const SUPPLIER_HEADERS = [
    'Supplier Code',
    'Name',
    'Description',
    'Chat Search Name',
];

export const exportSuppliersToExcel = (suppliers: Supplier[]): Blob => {
    // Convert suppliers to rows
    const rows = suppliers.map(supplier => ({
        'Supplier Code': supplier.supplierCode || '',
        'Name': supplier.name || '',
        'Description': supplier.description || '',
        'Chat Search Name': supplier.chatSearchName || '',
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');

    // Set column widths
    worksheet['!cols'] = [
        { wch: 20 }, // Supplier Code
        { wch: 30 }, // Name
        { wch: 40 }, // Description
        { wch: 25 }, // Chat Search Name
    ];

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
};

export const downloadSuppliersExcel = (suppliers: Supplier[], filename?: string) => {
    const blob = exportSuppliersToExcel(suppliers);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `suppliers_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

export const parseSuppliersFromExcel = async (
    file: File
): Promise<Omit<Supplier, 'id' | 'createdAt' | 'storeId'>[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                const suppliers = jsonData.map((row: any) => ({
                    supplierCode: row['Supplier Code']?.toString().trim() || '',
                    name: row['Name']?.toString().trim() || '',
                    description: row['Description']?.toString().trim() || '',
                    chatSearchName: row['Chat Search Name']?.toString().trim() || '',
                }));

                resolve(suppliers);
            } catch (error) {
                reject(new Error('Failed to parse Excel file. Please check the format.'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsBinaryString(file);
    });
};

// ============================================================================
// COURIER EXCEL OPERATIONS
// ============================================================================

const COURIER_HEADERS = [
    'Courier Code',
    'Name',
    'Marking',
    'Contact Person',
    'Warehouse Address',
];

export const exportCouriersToExcel = (couriers: Courier[]): Blob => {
    // Convert couriers to rows
    const rows = couriers.map(courier => ({
        'Courier Code': courier.courierCode || '',
        'Name': courier.name || '',
        'Marking': courier.marking || '',
        'Contact Person': courier.contactPerson || '',
        'Warehouse Address': courier.warehouseAddress || '',
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Couriers');

    // Set column widths
    worksheet['!cols'] = [
        { wch: 20 }, // Courier Code
        { wch: 30 }, // Name
        { wch: 25 }, // Marking
        { wch: 25 }, // Contact Person
        { wch: 40 }, // Warehouse Address
    ];

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
};

export const downloadCouriersExcel = (couriers: Courier[], filename?: string) => {
    const blob = exportCouriersToExcel(couriers);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `couriers_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

export const parseCouriersFromExcel = async (
    file: File
): Promise<Omit<Courier, 'id' | 'createdAt' | 'storeId'>[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                const couriers = jsonData.map((row: any) => ({
                    courierCode: row['Courier Code']?.toString().trim() || '',
                    name: row['Name']?.toString().trim() || '',
                    marking: row['Marking']?.toString().trim() || '',
                    contactPerson: row['Contact Person']?.toString().trim() || '',
                    warehouseAddress: row['Warehouse Address']?.toString().trim() || '',
                }));

                resolve(couriers);
            } catch (error) {
                reject(new Error('Failed to parse Excel file. Please check the format.'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsBinaryString(file);
    });
};

// ============================================================================
// TEMPLATE GENERATION
// ============================================================================

export const downloadSupplierTemplate = () => {
    const template = [
        {
            'Supplier Code': 'SUP-001',
            'Name': 'Example Supplier',
            'Description': 'Description here',
            'Chat Search Name': 'Search name',
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');

    worksheet['!cols'] = [
        { wch: 20 },
        { wch: 30 },
        { wch: 40 },
        { wch: 25 },
    ];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supplier_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

export const downloadCourierTemplate = () => {
    const template = [
        {
            'Courier Code': 'CUR-001',
            'Name': 'Example Courier',
            'Marking': 'BLS/SEA/EXAMPLE',
            'Contact Person': 'John Doe',
            'Warehouse Address': 'Warehouse address here',
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Couriers');

    worksheet['!cols'] = [
        { wch: 20 },
        { wch: 30 },
        { wch: 25 },
        { wch: 25 },
        { wch: 40 },
    ];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'courier_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
