import { NextRequest, NextResponse } from 'next/server';
import { exportPoDetailsToSheets } from '@/lib/services/googleSheetsService';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { poDetails, storeName } = body;

        if (!poDetails || !Array.isArray(poDetails)) {
            return NextResponse.json(
                { success: false, message: 'Invalid PO details data' },
                { status: 400 }
            );
        }

        if (!storeName || typeof storeName !== 'string') {
            return NextResponse.json(
                { success: false, message: 'Store name is required' },
                { status: 400 }
            );
        }

        // Use store name + " - PO Details" as the sheet name
        const sheetName = `${storeName} - PO Details`;

        const result = await exportPoDetailsToSheets(poDetails, sheetName);

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
