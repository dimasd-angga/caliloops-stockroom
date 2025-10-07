'use client';

import { Scanner, ScannerProps } from '@yudiel/react-qr-scanner';

export const ClientScanner = (props: ScannerProps) => {
  return <Scanner {...props} />;
};
