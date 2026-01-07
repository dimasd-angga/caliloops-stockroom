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
import { Search, PlusCircle } from 'lucide-react';
import { SkuCreationModal } from './SkuCreationModal';
import type { Sku } from '@/lib/types';
import { getAllSkusByStore } from '@/lib/services/skuService';

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
  placeholder = 'Select or create SKU',
}: SkuSelectorWithCreateProps) {
  const [skus, setSkus] = React.useState<Sku[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

  // Fetch SKUs on mount
  React.useEffect(() => {
    const fetchSkus = async () => {
      if (!storeId) return;
      setLoading(true);
      try {
        const fetchedSkus = await getAllSkusByStore(storeId);
        setSkus(fetchedSkus);
      } catch (error) {
        console.error('Error fetching SKUs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSkus();
  }, [storeId]);

  // Filter SKUs based on search term
  const filteredSkus = React.useMemo(() => {
    if (!searchTerm) return skus;
    const lowerSearch = searchTerm.toLowerCase();
    return skus.filter(
      (sku) =>
        sku.skuCode.toLowerCase().includes(lowerSearch) ||
        sku.skuName.toLowerCase().includes(lowerSearch)
    );
  }, [skus, searchTerm]);

  const handleValueChange = (selectedValue: string) => {
    if (selectedValue === '__create_new__') {
      setIsCreateModalOpen(true);
      return;
    }

    const selectedSku = skus.find((s) => s.id === selectedValue) || null;
    onValueChange(selectedValue, selectedSku);
  };

  const handleSkuCreated = (newSku: Sku) => {
    // Add new SKU to the list
    setSkus((prev) => [newSku, ...prev]);
    // Automatically select the newly created SKU
    onValueChange(newSku.id, newSku);
  };

  const selectedSku = skus.find((s) => s.id === value);

  return (
    <>
      <Select value={value} onValueChange={handleValueChange} disabled={disabled || loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? 'Loading...' : placeholder}>
            {selectedSku ? `${selectedSku.skuCode} - ${selectedSku.skuName}` : placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <div className="flex items-center px-2 pb-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8"
            />
          </div>
          <SelectItem value="__create_new__" className="font-semibold text-primary">
            <div className="flex items-center">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New SKU
            </div>
          </SelectItem>
          {filteredSkus.length === 0 && searchTerm && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No SKU found. Click "Create New SKU" above.
            </div>
          )}
          {filteredSkus.map((sku) => (
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
