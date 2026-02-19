'use client';
import * as React from 'react';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, PlusCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { SkuCreationModal } from './SkuCreationModal';
import type { Sku } from '@/lib/types';
import { searchSkus, getSkuById } from '@/lib/services/skuService';

interface SkuSelectorWithCreateProps {
  storeId: string;
  value?: string; // SKU ID
  onValueChange: (skuId: string, sku: Sku | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function SkuSelectorWithCreate({
  storeId,
  value,
  onValueChange,
  disabled = false,
  placeholder = 'Type to search SKU...',
}: SkuSelectorWithCreateProps) {
  const [skus, setSkus] = React.useState<Sku[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [selectedSku, setSelectedSku] = React.useState<Sku | null>(null);

  // Debounce search
  const searchTimeoutRef = React.useRef<NodeJS.Timeout>();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const shouldRestoreFocusRef = React.useRef(false);

  // Restore focus after state updates
  React.useEffect(() => {
    if (shouldRestoreFocusRef.current && searchInputRef.current) {
      searchInputRef.current.focus();
      shouldRestoreFocusRef.current = false;
    }
  }, [skus, loading]);

  // Fetch selected SKU details if value is provided
  React.useEffect(() => {
    const loadSelectedSku = async () => {
      if (!value) {
        setSelectedSku(null);
        return;
      }

      // If selectedSku already matches the value, no need to refetch
      if (selectedSku && selectedSku.id === value) {
        return;
      }

      // First try to find in current skus list
      const found = skus.find(s => s.id === value);
      if (found) {
        setSelectedSku(found);
        return;
      }

      // If not found in list, fetch from database
      try {
        console.log('[SkuSelector] Fetching SKU by ID:', value);
        const sku = await getSkuById(value);
        if (sku) {
          console.log('[SkuSelector] SKU loaded:', sku);
          setSelectedSku(sku);
          // Also add to skus list so it appears in dropdown
          setSkus(prev => {
            const exists = prev.find(s => s.id === value);
            if (exists) return prev;
            return [sku, ...prev];
          });
        } else {
          console.log('[SkuSelector] SKU not found in database');
          setSelectedSku(null);
        }
      } catch (error) {
        console.error('[SkuSelector] Error fetching SKU:', error);
        setSelectedSku(null);
      }
    };

    loadSelectedSku();
  }, [value, storeId]); // Removed skus and selectedSku from deps to prevent loops

  // Search SKUs when user types
  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
    // Mark that we should restore focus after state updates
    shouldRestoreFocusRef.current = true;

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Only search if 3+ characters
    if (search.length < 3) {
      // Use startTransition to prevent interrupting user input
      React.startTransition(() => {
        setSkus([]);
      });
      return;
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      // Use startTransition to prevent interrupting user input
      React.startTransition(() => {
        setLoading(true);
      });
      try {
        const results = await searchSkus(storeId, search, 20);
        // Use startTransition to prevent interrupting user input
        React.startTransition(() => {
          setSkus(results);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error searching SKUs:', error);
        React.startTransition(() => {
          setLoading(false);
        });
      }
    }, 300);
  };

  const handleValueChange = (selectedValue: string) => {
    if (selectedValue === '__create_new__') {
      setIsCreateModalOpen(true);
      return;
    }

    const sku = skus.find((s) => s.id === selectedValue) || null;
    setSelectedSku(sku);
    onValueChange(selectedValue, sku);
  };

  const handleSkuCreated = (newSku: Sku) => {
    // Add new SKU to list
    setSkus((prev) => [newSku, ...prev]);
    setSelectedSku(newSku);
    // Automatically select the newly created SKU
    onValueChange(newSku.id, newSku);
  };

  return (
    <>
      <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder}>
            {selectedSku ? (
              <div className="flex items-center gap-2">
                {selectedSku.imageUrl ? (
                  <div className="w-6 h-6 relative flex-shrink-0">
                    <Image
                      src={selectedSku.imageUrl}
                      alt={selectedSku.skuName}
                      fill
                      className="rounded object-cover"
                      sizes="24px"
                    />
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-muted rounded flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <span className="truncate">{selectedSku.skuCode} - {selectedSku.skuName}</span>
              </div>
            ) : (
              placeholder
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <div className="flex items-center px-2 pb-2 gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <Input
              ref={searchInputRef}
              placeholder="Type 3+ chars to search..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-8"
              autoFocus
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          <SelectItem value="__create_new__" className="font-semibold text-primary">
            <div className="flex items-center">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New SKU
            </div>
          </SelectItem>
          {searchTerm.length > 0 && searchTerm.length < 3 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Type at least 3 characters to search
            </div>
          )}
          {searchTerm.length >= 3 && skus.length === 0 && !loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No SKU found. Click "Create New SKU" above.
            </div>
          )}
          {skus.map((sku) => (
            <SelectItem key={sku.id} value={sku.id}>
              <div className="flex items-center gap-2">
                {sku.imageUrl ? (
                  <div className="w-8 h-8 relative flex-shrink-0">
                    <Image
                      src={sku.imageUrl}
                      alt={sku.skuName}
                      fill
                      className="rounded object-cover"
                      sizes="32px"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{sku.skuCode}</span>
                  <span className="text-xs text-muted-foreground truncate">{sku.skuName}</span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <SkuCreationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        storeId={storeId}
        onSkuCreated={handleSkuCreated}
      />
    </>
  );
}
