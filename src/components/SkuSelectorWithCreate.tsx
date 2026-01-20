'use client';
import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, PlusCircle, Loader2 } from 'lucide-react';
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

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Only search if 3+ characters
    if (search.length < 3) {
      setSkus([]);
      return;
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchSkus(storeId, search, 20);
        setSkus(results);
      } catch (error) {
        console.error('Error searching SKUs:', error);
      } finally {
        setLoading(false);
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
            {selectedSku ? `${selectedSku.skuCode} - ${selectedSku.skuName}` : placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <div className="flex items-center px-2 pb-2 gap-2">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Type 3+ chars to search..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-8"
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
              {sku.skuCode} - {sku.skuName}
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
