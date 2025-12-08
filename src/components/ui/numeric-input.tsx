
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number;
  onValueChange: (value: number) => void;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onValueChange, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState('');

    React.useEffect(() => {
        if (value !== undefined && value !== null) {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                // Do not format if the user is currently editing the input
                // This check is simple, a more robust way is to check focus state
                if (document.activeElement !== ref) {
                    setDisplayValue(numValue.toLocaleString('en-US'));
                }
            }
        } else {
            setDisplayValue('');
        }
    }, [value, ref]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const sanitizedValue = inputValue.replace(/[^0-9.]/g, ''); // Allow dots for decimals
      
      setDisplayValue(sanitizedValue);
      
      const numericValue = parseFloat(sanitizedValue);
      if (!isNaN(numericValue)) {
        onValueChange(numericValue);
      } else if (sanitizedValue === '') {
        onValueChange(0);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const numericValue = parseFloat(e.target.value.replace(/,/g, ''));
      if (!isNaN(numericValue)) {
        setDisplayValue(numericValue.toLocaleString('en-US'));
      } else {
        setDisplayValue('');
      }
      props.onBlur?.(e);
    };

    return (
      <Input
        type="text"
        inputMode="decimal"
        className={cn('text-right', className)}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        ref={ref}
        {...props}
      />
    );
  }
);

NumericInput.displayName = 'NumericInput';

export { NumericInput };

    