import { google } from 'googleapis';
import type { PurchaseOrder } from '@/lib/types';
import { format } from 'date-fns';

// Initialize Google Sheets API
const getGoogleSheetsClient = () => {
    // Decode private key from Base64 if it's encoded
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    // Check if the key is Base64 encoded (doesn't start with -----)
    if (privateKey && !privateKey.includes('-----BEGIN')) {
        try {
            privateKey = Buffer.from(privateKey, 'base64').toString('utf-8');
        } catch (error) {
            console.error('Error decoding Base64 private key:', error);
        }
    }

    // Replace escaped newlines with actual newlines
    if (privateKey) {
        privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
};

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

// ============================================================================
// PURCHASE ORDER EXPORT
// ============================================================================

// Column headers for the purchase orders sheet
// Order matches the MASTER sheet format
const HEADERS = [
    'PO Number',
    'Order Date',
    'Order No',
    'Supplier Code',
    'Nama China',
    'Status',
    'Jumlah Pcs',
    'Total RMB',
    'Cost Per Pcs',
    'Kurs',
    'Total Pembelian (IDR)',
    'Marking',
    'Jumlah Koli',
    'Shipping No',
    'Note',
    'Qty Diterima',
    'Qty Tidak Diterima',
    'Qty Rusak',
    'Brg Lama di Pembelian?',
    'PDF Brg Baru?',
    'Printout?',
    'Update Stock?',
    'Upload Brg Baru?',
    'Brg Baru di Pembelian?',
    'Ada Refund?',
    'Jml Refund (Yuan)',
    'Supplier OK?',
];

/**
 * Helper function to safely convert Firestore Timestamp or Date to formatted string
 */
const formatDate = (date: any, formatStr: string): string => {
    if (!date) return '';

    // If it's a Firestore Timestamp with toDate method
    if (date && typeof date.toDate === 'function') {
        return format(date.toDate(), formatStr);
    }

    // If it's already a Date object
    if (date instanceof Date) {
        return format(date, formatStr);
    }

    // If it's a serialized Firestore Timestamp (from JSON)
    if (date && typeof date === 'object' && 'seconds' in date) {
        try {
            // Convert seconds to milliseconds for JavaScript Date
            const timestamp = new Date(date.seconds * 1000);
            return format(timestamp, formatStr);
        } catch {
            return '';
        }
    }

    // If it's a string or number, try to create a Date
    try {
        return format(new Date(date), formatStr);
    } catch {
        return '';
    }
};

/**
 * Convert a PurchaseOrder object to an array of values matching the headers
 * FIXED: Ensure PO Number appears in correct position
 */
const convertPOToRow = (po: PurchaseOrder): any[] => {
    // Detailed logging to debug the issue
    const rowData = [
        po.poNumber || '',
        formatDate(po.orderDate, 'dd/MM/yyyy'),
        po.orderNumber || '',
        po.supplierCode || '',
        po.chatSearch || '',
        po.status || '',
        po.totalPcs || 0,
        po.totalRmb || 0,
        po.costPerPiece || 0,
        po.exchangeRate || 0,
        po.totalPembelianIdr || 0,
        po.marking || '',
        po.packageCount || 0,
        Array.isArray(po.trackingNumber) ? po.trackingNumber.join(', ') : '',
        po.shippingNote || '',
        po.qtyReceived || 0,
        po.qtyNotReceived || 0,
        po.qtyDamaged || 0,
        po.isOldItemsInPurchaseMenu ? 'Yes' : 'No',
        po.isNewItemsPdfCreated ? 'Yes' : 'No',
        po.isPrintoutCreated ? 'Yes' : 'No',
        po.isStockUpdated ? 'Yes' : 'No',
        po.isNewItemsUploaded ? 'Yes' : 'No',
        po.isNewItemsAddedToPurchase ? 'Yes' : 'No',
        po.hasRefund ? 'Yes' : 'No',
        po.refundAmountYuan || 0,
        po.isSupplierRefundApproved ? 'Yes' : 'No',
    ];

    console.log('Converting PO:', {
        id: po.id,
        poNumber: po.poNumber,
        orderNumber: po.orderNumber,
        supplierCode: po.supplierCode,
        rowData_columnB: rowData[1],
        rowData_columnC: rowData[2],
    });

    return rowData;
};

export const exportPurchaseOrdersToSheets = async (
    purchaseOrders: PurchaseOrder[],
    sheetName: string
): Promise<{ success: boolean; message: string; sheetUrl?: string }> => {
    try {
        if (!SPREADSHEET_ID) {
            throw new Error('Google Sheets Spreadsheet ID is not configured');
        }

        const sheets = getGoogleSheetsClient();

        // Get existing sheets
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const existingSheet = spreadsheet.data.sheets?.find(
            (sheet) => sheet.properties?.title === sheetName
        );

        let sheetId: number;

        if (existingSheet) {
            // Clear existing data if sheet exists
            sheetId = existingSheet.properties?.sheetId || 0;
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:AA`,
            });
        } else {
            // Create new sheet
            const addSheetResponse = await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: sheetName,
                                },
                            },
                        },
                    ],
                },
            });
            sheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId || 0;
        }

        console.log('Sample PO data (first item):', purchaseOrders[0]);
        const rows = [HEADERS, ...purchaseOrders.map(convertPOToRow)];

        if (rows.length > 1) {
            console.log('First data row:', rows[1]);
            console.log('Headers:', HEADERS);
        }

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
                values: rows,
            },
        });

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: 0,
                                endRowIndex: 1,
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: true,
                                    },
                                    backgroundColor: {
                                        red: 0.9,
                                        green: 0.9,
                                        blue: 0.9,
                                    },
                                },
                            },
                            fields: 'userEnteredFormat(textFormat,backgroundColor)',
                        },
                    },
                    // Freeze header row
                    {
                        updateSheetProperties: {
                            properties: {
                                sheetId: sheetId,
                                gridProperties: {
                                    frozenRowCount: 1,
                                },
                            },
                            fields: 'gridProperties.frozenRowCount',
                        },
                    },
                    {
                        autoResizeDimensions: {
                            dimensions: {
                                sheetId: sheetId,
                                dimension: 'COLUMNS',
                                startIndex: 0,
                                endIndex: HEADERS.length,
                            },
                        },
                    },
                ],
            },
        });

        const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${sheetId}`;

        return {
            success: true,
            message: `Successfully exported ${purchaseOrders.length} purchase orders to Google Sheets`,
            sheetUrl,
        };
    } catch (error: any) {
        console.error('Error exporting to Google Sheets:', error);
        return {
            success: false,
            message: `Failed to export: ${error.message}`,
        };
    }
};

export const appendPurchaseOrdersToSheets = async (
    purchaseOrders: PurchaseOrder[],
    sheetName: string = 'Purchase Orders'
): Promise<{ success: boolean; message: string }> => {
    try {
        if (!SPREADSHEET_ID) {
            throw new Error('Google Sheets Spreadsheet ID is not configured');
        }

        const sheets = getGoogleSheetsClient();
        const rows = purchaseOrders.map(convertPOToRow);

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:AA`,
            valueInputOption: 'RAW',
            requestBody: {
                values: rows,
            },
        });

        return {
            success: true,
            message: `Successfully appended ${purchaseOrders.length} purchase orders`,
        };
    } catch (error: any) {
        console.error('Error appending to Google Sheets:', error);
        return {
            success: false,
            message: `Failed to append: ${error.message}`,
        };
    }
};

export type PoDetailRow = {
    poNumber: string;
    orderDate: string;
    orderNumber?: string;
    supplierCode: string;
    supplierName: string;
    chatSearch: string;
    resi: string;
    storageCode?: string;
    containerCode?: string;
    status: 'INPUTTED' | 'SHIPPING' | 'RECEIVED';
    receivedDate?: string;
};

const PO_DETAILS_HEADERS = [
    'No PO',
    'Order Date',
    'Order No',
    'Supplier Code',
    'Nama China',
    'No Resi',
    'No Storage',
    'Kode Kontainer',
    'Status',
    'Received Date',
];

const convertPoDetailToRow = (detail: PoDetailRow): any[] => {
    let formattedOrderDate = detail.orderDate || '';
    if (formattedOrderDate && formattedOrderDate.includes(' ')) {
        try {
            const parsedDate = new Date(formattedOrderDate);
            if (!isNaN(parsedDate.getTime())) {
                formattedOrderDate = format(parsedDate, 'dd/MM/yyyy');
            }
        } catch {
            // If parsing fails, keep original format
        }
    }

    let formattedReceivedDate = detail.receivedDate || '';
    if (formattedReceivedDate && formattedReceivedDate.includes(' ')) {
        try {
            const parsedDate = new Date(formattedReceivedDate);
            if (!isNaN(parsedDate.getTime())) {
                formattedReceivedDate = format(parsedDate, 'dd/MM/yyyy');
            }
        } catch {
            // If parsing fails, keep original format
        }
    }

    return [
        detail.poNumber || '',
        formattedOrderDate,
        detail.orderNumber || '',
        detail.supplierCode || '',
        detail.chatSearch || '',
        detail.resi || '',
        detail.storageCode || '',
        detail.containerCode || '',
        detail.status || '',
        formattedReceivedDate,
    ];
};

export const exportPoDetailsToSheets = async (
    poDetails: PoDetailRow[],
    sheetName: string
): Promise<{ success: boolean; message: string; sheetUrl?: string }> => {
    try {
        if (!SPREADSHEET_ID) {
            throw new Error('Google Sheets Spreadsheet ID is not configured');
        }

        const sheets = getGoogleSheetsClient();

        // Get existing sheets
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const existingSheet = spreadsheet.data.sheets?.find(
            (sheet) => sheet.properties?.title === sheetName
        );

        let sheetId: number;

        if (existingSheet) {
            sheetId = existingSheet.properties?.sheetId || 0;
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:J`,
            });
        } else {
            const addSheetResponse = await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: sheetName,
                                },
                            },
                        },
                    ],
                },
            });
            sheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId || 0;
        }

        const rows = [PO_DETAILS_HEADERS, ...poDetails.map(convertPoDetailToRow)];

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
                values: rows,
            },
        });

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: 0,
                                endRowIndex: 1,
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: true,
                                    },
                                    backgroundColor: {
                                        red: 0.9,
                                        green: 0.9,
                                        blue: 0.9,
                                    },
                                },
                            },
                            fields: 'userEnteredFormat(textFormat,backgroundColor)',
                        },
                    },
                    {
                        updateSheetProperties: {
                            properties: {
                                sheetId: sheetId,
                                gridProperties: {
                                    frozenRowCount: 1,
                                },
                            },
                            fields: 'gridProperties.frozenRowCount',
                        },
                    },
                    {
                        autoResizeDimensions: {
                            dimensions: {
                                sheetId: sheetId,
                                dimension: 'COLUMNS',
                                startIndex: 0,
                                endIndex: PO_DETAILS_HEADERS.length,
                            },
                        },
                    },
                ],
            },
        });

        const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${sheetId}`;

        return {
            success: true,
            message: `Successfully exported ${poDetails.length} PO details to Google Sheets`,
            sheetUrl,
        };
    } catch (error: any) {
        console.error('Error exporting PO details to Google Sheets:', error);
        return {
            success: false,
            message: `Failed to export: ${error.message}`,
        };
    }
};

// ============================================================================
// SKU IN SHIPPING EXPORT
// ============================================================================

export type SkuInShippingRow = {
    skuCode: string;
    skuName: string;
    totalPack: number;  // Total unique POs
    totalQty: number;   // Sum of quantities
    totalPcs: number;   // Sum of quantities (same as totalQty for now)
    qtyReceived: number; // Total qty received
    qtyNotReceived: number; // Total qty not received
    qtyDamaged: number; // Total qty damaged
    poNumbers: string;  // Comma-separated PO numbers
};

const SKU_IN_SHIPPING_HEADERS = [
    'SKU Code',
    'SKU Name',
    'Total Pcs in Shipping',
    'Qty Not Received',
    'PO Numbers',
];

const convertSkuInShippingToRow = (sku: SkuInShippingRow): any[] => {
    return [
        sku.skuCode || '',
        sku.skuName || '',
        sku.totalPcs || 0,
        sku.qtyNotReceived || 0,
        sku.poNumbers || '',
    ];
};

export const exportSkusInShippingToSheets = async (
    skuData: SkuInShippingRow[],
    sheetName: string
): Promise<{ success: boolean; message: string; sheetUrl?: string }> => {
    try {
        if (!SPREADSHEET_ID) {
            throw new Error('Google Sheets Spreadsheet ID is not configured');
        }

        const sheets = getGoogleSheetsClient();

        // Get existing sheets
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const existingSheet = spreadsheet.data.sheets?.find(
            (sheet) => sheet.properties?.title === sheetName
        );

        let sheetId: number;

        if (existingSheet) {
            sheetId = existingSheet.properties?.sheetId || 0;
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:E`,
            });
        } else {
            const addSheetResponse = await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: sheetName,
                                },
                            },
                        },
                    ],
                },
            });
            sheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId || 0;
        }

        const rows = [SKU_IN_SHIPPING_HEADERS, ...skuData.map(convertSkuInShippingToRow)];

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
                values: rows,
            },
        });

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: 0,
                                endRowIndex: 1,
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: true,
                                    },
                                    backgroundColor: {
                                        red: 0.9,
                                        green: 0.9,
                                        blue: 0.9,
                                    },
                                },
                            },
                            fields: 'userEnteredFormat(textFormat,backgroundColor)',
                        },
                    },
                    {
                        updateSheetProperties: {
                            properties: {
                                sheetId: sheetId,
                                gridProperties: {
                                    frozenRowCount: 1,
                                },
                            },
                            fields: 'gridProperties.frozenRowCount',
                        },
                    },
                    {
                        autoResizeDimensions: {
                            dimensions: {
                                sheetId: sheetId,
                                dimension: 'COLUMNS',
                                startIndex: 0,
                                endIndex: SKU_IN_SHIPPING_HEADERS.length,
                            },
                        },
                    },
                ],
            },
        });

        const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${sheetId}`;

        return {
            success: true,
            message: `Successfully exported ${skuData.length} SKUs in shipping to Google Sheets`,
            sheetUrl,
        };
    } catch (error: any) {
        console.error('Error exporting SKUs in shipping to Google Sheets:', error);
        return {
            success: false,
            message: `Failed to export: ${error.message}`,
        };
    }
};
