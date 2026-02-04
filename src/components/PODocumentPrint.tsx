import React from 'react';
import { format } from 'date-fns';
import type { PurchaseOrder, POReceiveItem } from '@/lib/types';

interface PODocumentPrintProps {
  po: PurchaseOrder;
  items: POReceiveItem[];
}

export const PODocumentPrint = React.forwardRef<HTMLDivElement, PODocumentPrintProps>(
  ({ po, items }, ref) => {
    // Helper function to convert Google Drive URLs to direct image URLs
    const convertGoogleDriveUrl = (url: string): string => {
      if (!url) return url;

      // Check if it's a Google Drive URL
      const match = url.match(/\/file\/d\/([^/]+)\//);
      if (match && match[1]) {
        return `https://drive.google.com/uc?export=view&id=${match[1]}`;
      }

      return url;
    };

    return (
      <div ref={ref} style={{
        backgroundColor: 'white',
        padding: '32px',
        width: '210mm',
        minHeight: '297mm',
        fontFamily: 'Arial, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '24px',
          borderBottom: '2px solid black',
          paddingBottom: '16px'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '16px',
            margin: '0 0 16px 0'
          }}>
            Cetak Dokumen PO - Untuk penerimaan barang datang
          </h1>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px'
          }}>
            <div>
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>PO Number:</p>
              <p style={{ fontSize: '18px', margin: '0' }}>{po.poNumber}</p>
            </div>
            <div>
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Order Date:</p>
              <p style={{ fontSize: '18px', margin: '0' }}>{format(po.orderDate.toDate(), 'dd MMM yyyy')}</p>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>Supplier:</p>
              <p style={{ fontSize: '18px', margin: '0' }}>{po.supplierName}</p>
            </div>
            {po.trackingNumber && po.trackingNumber.length > 0 && (
              <div style={{ gridColumn: 'span 2' }}>
                <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>No Resi:</p>
                <p style={{ fontSize: '18px', margin: '0' }}>{po.trackingNumber.join(', ')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '2px solid black'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#e5e7eb' }}>
              <th style={{
                border: '1px solid black',
                padding: '8px',
                textAlign: 'left',
                width: '60px'
              }}>No</th>
              <th style={{
                border: '1px solid black',
                padding: '8px',
                textAlign: 'left',
                width: '120px'
              }}>Foto Produk</th>
              <th style={{
                border: '1px solid black',
                padding: '8px',
                textAlign: 'left'
              }}>SKU</th>
              <th style={{
                border: '1px solid black',
                padding: '8px',
                textAlign: 'right',
                width: '80px'
              }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td style={{
                  border: '1px solid black',
                  padding: '8px'
                }}>{index + 1}</td>
                <td style={{
                  border: '1px solid black',
                  padding: '8px',
                  textAlign: 'center'
                }}>
                  {item.imageUrl ? (
                    <img
                      src={convertGoogleDriveUrl(item.imageUrl)}
                      alt={item.itemName}
                      style={{
                        width: '96px',
                        height: '96px',
                        objectFit: 'cover',
                        margin: '0 auto',
                        display: 'block'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '96px',
                      height: '96px',
                      backgroundColor: '#e5e7eb',
                      margin: '0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <span style={{
                        color: '#9ca3af',
                        fontSize: '12px'
                      }}>No Image</span>
                    </div>
                  )}
                </td>
                <td style={{
                  border: '1px solid black',
                  padding: '8px'
                }}>
                  <div>
                    <p style={{
                      fontWeight: '600',
                      margin: '0 0 4px 0'
                    }}>{item.skuCode || item.itemCode}</p>
                    <p style={{
                      fontSize: '14px',
                      color: '#4b5563',
                      margin: '0'
                    }}>{item.skuName || item.itemName}</p>
                  </div>
                </td>
                <td style={{
                  border: '1px solid black',
                  padding: '8px',
                  textAlign: 'right',
                  fontWeight: '600'
                }}>
                  {item.quantity}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{
              backgroundColor: '#f3f4f6',
              fontWeight: 'bold'
            }}>
              <td colSpan={3} style={{
                border: '1px solid black',
                padding: '8px',
                textAlign: 'right'
              }}>
                Total Quantity:
              </td>
              <td style={{
                border: '1px solid black',
                padding: '8px',
                textAlign: 'right'
              }}>
                {items.reduce((sum, item) => sum + item.quantity, 0)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Footer */}
        <div style={{
          marginTop: '32px',
          fontSize: '14px',
          color: '#4b5563'
        }}>
          <p style={{ margin: '0' }}>Document generated on: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
        </div>
      </div>
    );
  }
);

PODocumentPrint.displayName = 'PODocumentPrint';
