import { NextRequest, NextResponse } from 'next/server';
import { exportPurchaseOrdersToSheets } from '@/lib/services/googleSheetsService';
import type { PurchaseOrder } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { purchaseOrders, storeName } = body;

        if (!purchaseOrders || !Array.isArray(purchaseOrders)) {
            return NextResponse.json(
                { success: false, message: 'Invalid purchase orders data' },
                { status: 400 }
            );
        }

        if (!storeName || typeof storeName !== 'string') {
            return NextResponse.json(
                { success: false, message: 'Store name is required' },
                { status: 400 }
            );
        }

        // Log received data structure
        console.log('=== API ROUTE RECEIVED DATA ===');
        console.log('Number of POs:', purchaseOrders.length);
        console.log('Store name:', storeName);
        if (purchaseOrders.length > 0) {
            console.log('First PO structure:', {
                id: purchaseOrders[0].id,
                poNumber: purchaseOrders[0].poNumber,
                orderNumber: purchaseOrders[0].orderNumber,
                supplierCode: purchaseOrders[0].supplierCode,
                keys: Object.keys(purchaseOrders[0])
            });
        }
        console.log('=== END API ROUTE DATA ===');

        // Use store name as the sheet name (will be created or updated)
        const result = await exportPurchaseOrdersToSheets(
            purchaseOrders as PurchaseOrder[],
            storeName
        );

        if (result.success) {
            return NextResponse.json(result, { status: 200 });
        } else {
            return NextResponse.json(result, { status: 500 });
        }
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, message: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
