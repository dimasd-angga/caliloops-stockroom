'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function DebugPOPage() {
  const [poNumber, setPoNumber] = React.useState('PO000102');
  const [loading, setLoading] = React.useState(false);
  const [fixing, setFixing] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);

  const checkPO = async () => {
    if (!poNumber) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/debug/po-status?poNumber=${encodeURIComponent(poNumber)}`);
      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setResult({ error: data.error || 'Failed to check PO' });
      }
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fixPO = async () => {
    if (!poNumber) return;

    setFixing(true);

    try {
      const response = await fetch('/api/debug/fix-po-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poNumber }),
      });
      const data = await response.json();

      alert(data.message || data.error);

      // Refresh check after fix
      if (data.success) {
        await checkPO();
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>🔍 Debug PO Status</CardTitle>
          <CardDescription>
            Check why a PO appears in shipping estimates and fix if needed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter PO Number (e.g., PO000102)"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && checkPO()}
            />
            <Button onClick={checkPO} disabled={loading || !poNumber}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
            </Button>
          </div>

          {result && (
            <div className="mt-6 space-y-4">
              {result.error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  <strong>Error:</strong> {result.error}
                </div>
              ) : (
                <>
                  <div className="p-4 bg-gray-50 border rounded-lg">
                    <h3 className="font-semibold mb-2">📋 PO Information</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>PO Number:</div>
                      <div className="font-mono font-semibold">{result.poNumber}</div>
                      <div>PO Status:</div>
                      <div className="font-mono font-semibold">{result.poStatus}</div>
                      <div>PO Receive Status:</div>
                      <div className="font-mono font-semibold">{result.poReceiveStatus}</div>
                      <div>Total Items:</div>
                      <div className="font-mono">{result.poReceiveItemsCount}</div>
                      <div>Total Qty Not Received:</div>
                      <div className="font-mono font-semibold">{result.totalQtyNotReceived}</div>
                    </div>
                  </div>

                  <div
                    className={`p-4 border rounded-lg ${
                      result.shouldAppear ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <h3 className="font-semibold mb-2">🎯 Decision</h3>
                    <p className={result.shouldAppear ? 'text-red-800' : 'text-green-800'}>
                      {result.decision}
                    </p>
                    {result.shouldAppear ? (
                      <p className="mt-2 text-sm text-red-600">
                        ❌ This PO <strong>WILL APPEAR</strong> in shipping estimates
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-green-600">
                        ✅ This PO <strong>WILL NOT APPEAR</strong> in shipping estimates
                      </p>
                    )}
                  </div>

                  {result.items && result.items.length > 0 && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-semibold mb-2">📦 Receive Items ({result.items.length})</h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {result.items.map((item: any, index: number) => (
                          <div key={index} className="text-sm p-2 bg-white rounded border">
                            <div className="font-semibold">
                              {item.itemCode} - {item.itemName}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 grid grid-cols-4 gap-2">
                              <div>SKU: {item.skuCode || '-'}</div>
                              <div>Qty: {item.quantity}</div>
                              <div className="text-green-600">Received: {item.qtyReceived}</div>
                              <div className="text-red-600">Not Received: {item.qtyNotReceived}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.poReceiveStatus === 'COMPLETED' && result.poStatus !== 'DONE' && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h3 className="font-semibold mb-2 text-yellow-800">⚠️ Issue Detected</h3>
                      <p className="text-sm text-yellow-800 mb-3">
                        PO Receive is COMPLETED but PO status is still <strong>{result.poStatus}</strong>.
                        This should be fixed to DONE.
                      </p>
                      <Button onClick={fixPO} disabled={fixing} variant="default">
                        {fixing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Fixing...
                          </>
                        ) : (
                          'Fix PO Status → DONE'
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
