import { NextRequest, NextResponse } from 'next/server';
import { addCourier } from '@/lib/services/courierService';

export async function POST(request: NextRequest) {
    try {
        const { couriers, storeId } = await request.json();

        if (!couriers || !Array.isArray(couriers)) {
            return NextResponse.json(
                { error: 'Invalid couriers data' },
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

        // Process each courier
        for (let i = 0; i < couriers.length; i++) {
            const courier = couriers[i];

            try {
                // Validate required fields
                if (!courier.courierCode || !courier.name) {
                    results.failed.push({
                        row: i + 2, // +2 because row 1 is header, and array is 0-indexed
                        error: 'Courier Code and Name are required',
                        data: courier,
                    });
                    continue;
                }

                // Add courier with storeId
                const courierId = await addCourier({
                    ...courier,
                    storeId,
                });

                results.success.push(courierId);
            } catch (error: any) {
                results.failed.push({
                    row: i + 2,
                    error: error.message || 'Failed to add courier',
                    data: courier,
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Imported ${results.success.length} couriers successfully`,
            details: {
                total: couriers.length,
                succeeded: results.success.length,
                failed: results.failed.length,
                failures: results.failed,
            },
        });
    } catch (error: any) {
        console.error('Error importing couriers:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to import couriers' },
            { status: 500 }
        );
    }
}
