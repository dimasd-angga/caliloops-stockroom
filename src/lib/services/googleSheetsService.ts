import { google } from 'googleapis';
import type { PurchaseOrder } from '../types';
import { format } from 'date-fns';

// Initialize Google Sheets API
const getGoogleSheetsClient = () => {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
};

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

// Column headers for the purchase orders sheet
const HEADERS = [
    'PO Number',
    'Order Number',
    'Order Date',
    'Supplier Name',
    'Supplier Code',
    'Status',
    'Total Pcs',
    'Total RMB',
    'Exchange Rate',
    'Total Pembelian (IDR)',
    'Cost per Pcs (IDR)',
    'Marking',
    'Shipping Cost',
    'Package Count',
    'Tracking Numbers',
    'Shipping Note',
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
    'Photo URL',
    'Created At',
    'Updated At',
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
        po.poNumber || '',
        po.orderNumber || '',
        formatDate(po.orderDate, 'dd/MM/yyyy'),
        po.supplierName || '',
        po.supplierCode || '',
        po.status || '',
        po.totalPcs || 0,
        po.totalRmb || 0,
        po.exchangeRate || 0,
        po.totalPembelianIdr || 0,
        po.costPerPiece || 0,
        po.marking || '',
        po.shippingCost || 0,
        po.packageCount || 0,
        Array.isArray(po.trackingNumber) ? po.trackingNumber.join(', ') : '',
        po.shippingNote || '',
        po.totalPcsOldReceived || 0,
        po.totalPcsNewReceived || 0,
        po.totalPcsRefunded || 0,
        po.isOldItemsInPurchaseMenu ? 'Yes' : 'No',
        po.isNewItemsPdfCreated ? 'Yes' : 'No',
        po.isPrintoutCreated ? 'Yes' : 'No',
        po.isStockUpdated ? 'Yes' : 'No',
        po.isNewItemsUploaded ? 'Yes' : 'No',
        po.isNewItemsAddedToPurchase ? 'Yes' : 'No',
        po.hasRefund ? 'Yes' : 'No',
        po.refundAmountYuan || 0,
        po.isSupplierRefundApproved ? 'Yes' : 'No',
        po.photoUrl || '',
        formatDate(po.createdAt, 'dd/MM/yyyy HH:mm:ss'),
        formatDate(po.updatedAt, 'dd/MM/yyyy HH:mm:ss'),
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
                range: `${sheetName}!A:AE`,
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
