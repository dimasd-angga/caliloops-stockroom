import { NextRequest, NextResponse } from 'next/server';
import { exportAllSkusWithShippingToSheets, type AllSkuWithShippingRow } from '@/lib/services/googleSheetsService';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { skuData, sheetName } = body;

        if (!skuData || !Array.isArray(skuData)) {
            return NextResponse.json(
                { success: false, message: 'Invalid SKU data' },
                { status: 400 }
            );
        }

        if (!sheetName || typeof sheetName !== 'string') {
            return NextResponse.json(
                { success: false, message: 'Sheet name is required' },
                { status: 400 }
            );
        }

        console.log('=== API ROUTE RECEIVED ALL SKU DATA ===');
        console.log('Number of SKUs:', skuData.length);
        console.log('Sheet name:', sheetName);
        if (skuData.length > 0) {
            console.log('First SKU:', skuData[0]);
        }
        console.log('=== END API ROUTE DATA ===');

        const result = await exportAllSkusWithShippingToSheets(
            skuData as AllSkuWithShippingRow[],
            sheetName
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
