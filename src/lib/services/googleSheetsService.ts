import { google } from 'googleapis';
import type { PurchaseOrder } from '../types';
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

// Column headers for the purchase orders sheet
// Order matches the MASTER sheet format
const HEADERS = [
    'Order Date',
    'Order No',
    'Supplier Code',
    'Nama China',
    'Supplier Desc',
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
    'Pcs Brg Lama Diterima',
    'Pcs Brg Baru Diterima',
    'Pcs Refund',
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

    // If it's a string or number, try to create a Date
    try {
        return format(new Date(date), formatStr);
    } catch {
        return '';
    }
};

/**
 * Convert a PurchaseOrder object to an array of values matching the headers
 */
const convertPOToRow = (po: PurchaseOrder): any[] => {
    return [
        formatDate(po.orderDate, 'dd/MM/yyyy'),                          // Order Date
        po.orderNumber || '',                                             // Order No
        po.supplierCode || '',                                            // Supplier Code
        po.supplierName || '',                                            // Nama China
        po.chatSearch || '',                                              // Supplier Desc
        po.status || '',                                                  // Status
        po.totalPcs || 0,                                                 // Jumlah Pcs
        po.totalRmb || 0,                                                 // Total RMB
        po.costPerPiece || 0,                                             // Cost Per Pcs
        po.exchangeRate || 0,                                             // Kurs
        po.totalPembelianIdr || 0,                                        // Total Pembelian (IDR)
        po.marking || '',                                                 // Marking
        po.packageCount || 0,                                             // Jumlah Koli
        Array.isArray(po.trackingNumber) ? po.trackingNumber.join(', ') : '', // Shipping No
        po.shippingNote || '',                                            // Note
        po.totalPcsOldReceived || 0,                                      // Pcs Brg Lama Diterima
        po.totalPcsNewReceived || 0,                                      // Pcs Brg Baru Diterima
        po.totalPcsRefunded || 0,                                         // Pcs Refund
        po.isOldItemsInPurchaseMenu ? 'Yes' : 'No',                       // Brg Lama di Pembelian?
        po.isNewItemsPdfCreated ? 'Yes' : 'No',                           // PDF Brg Baru?
        po.isPrintoutCreated ? 'Yes' : 'No',                              // Printout?
        po.isStockUpdated ? 'Yes' : 'No',                                 // Update Stock?
        po.isNewItemsUploaded ? 'Yes' : 'No',                             // Upload Brg Baru?
        po.isNewItemsAddedToPurchase ? 'Yes' : 'No',                      // Brg Baru di Pembelian?
        po.hasRefund ? 'Yes' : 'No',                                      // Ada Refund?
        po.refundAmountYuan || 0,                                         // Jml Refund (Yuan)
        po.isSupplierRefundApproved ? 'Yes' : 'No',                       // Supplier OK?
    ];
};

/**
 * Export purchase orders to Google Sheets
 * @param purchaseOrders Array of purchase orders to export
 * @param sheetName Name of the sheet tab (should be store name)
 * @returns Success status and message
 */
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

        // Prepare data rows
        const rows = [HEADERS, ...purchaseOrders.map(convertPOToRow)];

        // Write data to sheet
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
                values: rows,
            },
        });

        // Format the sheet (header row bold, freeze header, auto-resize columns)
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    // Make header row bold
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
                    // Auto-resize columns
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

/**
 * Append new purchase orders to existing sheet (useful for incremental updates)
 */
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
            range: `${sheetName}!A:AE`,
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

// ============================================================================
// PO DETAILS EXPORT
// ============================================================================

// Type for PO Detail row
type PoDetailRow = {
    poNumber: string;
    orderDate: string;
    orderNumber?: string;
    supplierCode: string;
    supplierName: string;
    supplierDesc: string;
    resi: string;
    storageCode?: string;
    containerCode?: string;
    status: 'INPUTTED' | 'SHIPPING' | 'RECEIVED';
    receivedDate?: string;
};

// Column headers for PO Details export
const PO_DETAILS_HEADERS = [
    'No PO',
    'Order Date',
    'Order No',
    'Supplier Code',
    'Nama China',
    'Supplier Desc',
    'No Resi',
    'No Storage',
    'Kode Kontainer',
    'Status',
    'Received Date',
];

/**
 * Convert a PO Detail row to an array of values matching the headers
 */
const convertPoDetailToRow = (detail: PoDetailRow): any[] => {
    return [
        detail.poNumber || '',
        detail.orderDate || '',
        detail.orderNumber || '',
        detail.supplierCode || '',
        detail.supplierName || '',
        detail.supplierDesc || '',
        detail.resi || '',
        detail.storageCode || '',
        detail.containerCode || '',
        detail.status || '',
        detail.receivedDate || '',
    ];
};

/**
 * Export PO details to Google Sheets
 * @param poDetails Array of PO detail rows to export
 * @param sheetName Name of the sheet tab (should be store name + " - PO Details")
 * @returns Success status and message
 */
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
            // Clear existing data if sheet exists
            sheetId = existingSheet.properties?.sheetId || 0;
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:K`,
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

        // Prepare data rows
        const rows = [PO_DETAILS_HEADERS, ...poDetails.map(convertPoDetailToRow)];

        // Write data to sheet
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
                values: rows,
            },
        });

        // Format the sheet (header row bold, freeze header, auto-resize columns)
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    // Make header row bold
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
                    // Auto-resize columns
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
