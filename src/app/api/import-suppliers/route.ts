import { NextRequest, NextResponse } from 'next/server';
import { addSupplier } from '@/lib/services/supplierService';

export async function POST(request: NextRequest) {
    try {
        const { suppliers, storeId } = await request.json();

        if (!suppliers || !Array.isArray(suppliers)) {
            return NextResponse.json(
                { error: 'Invalid suppliers data' },
                { status: 400 }
            );
        }

        if (!storeId) {
            return NextResponse.json(
                { error: 'Store ID is required' },
                { status: 400 }
            );
        }

        const results = {
            success: [] as string[],
            failed: [] as { row: number; error: string; data: any }[],
        };

        // Process each supplier
        for (let i = 0; i < suppliers.length; i++) {
            const supplier = suppliers[i];

            try {
                // Validate required fields
                if (!supplier.supplierCode || !supplier.name) {
                    results.failed.push({
                        row: i + 2, // +2 because row 1 is header, and array is 0-indexed
                        error: 'Supplier Code and Name are required',
                        data: supplier,
                    });
                    continue;
                }

                // Add supplier with storeId
                const supplierId = await addSupplier({
                    ...supplier,
                    storeId,
                });

                results.success.push(supplierId);
            } catch (error: any) {
                results.failed.push({
                    row: i + 2,
                    error: error.message || 'Failed to add supplier',
                    data: supplier,
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Imported ${results.success.length} suppliers successfully`,
            details: {
                total: suppliers.length,
                succeeded: results.success.length,
                failed: results.failed.length,
                failures: results.failed,
            },
        });
    } catch (error: any) {
        console.error('Error importing suppliers:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to import suppliers' },
            { status: 500 }
        );
    }
}
