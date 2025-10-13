
'use client';
import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Sku, Permissions } from '@/lib/types';
import { subscribeToSkus } from '@/lib/services/skuService';
import { UserContext } from '@/app/dashboard/layout';
import { SkuList } from './components/SkuList';
import { SkuDetail } from './components/SkuDetail';

export default function InboundPage() {
  const { toast } = useToast();
  const { user, selectedStoreId, permissions } = React.useContext(UserContext);
  
  const [allSkus, setAllSkus] = React.useState<Sku[]>([]);
  const [loadingSkus, setLoadingSkus] = React.useState(true);
  const [selectedSku, setSelectedSku] = React.useState<Sku | null>(null);

  React.useEffect(() => {
    if (!user) return;
    setLoadingSkus(true);

    const storeIdToQuery = user.email === 'superadmin@caliloops.com' ? selectedStoreId : user.storeId || null;
    
    // For non-superadmin users without a storeId, they see nothing.
    if (user.email !== 'superadmin@caliloops.com' && !user.storeId) {
      setAllSkus([]);
      setLoadingSkus(false);
      return;
    }

    const unsubscribe = subscribeToSkus(
      storeIdToQuery,
      (skuData) => {
        setAllSkus(skuData);
        setLoadingSkus(false);
        // If a SKU was selected, refresh its data from the new subscription update.
        if (selectedSku) {
            const refreshedSku = skuData.find(s => s.id === selectedSku.id);
            if (refreshedSku) {
                setSelectedSku(refreshedSku);
            } else {
                // The selected SKU might no longer exist or be in the current store view
                setSelectedSku(null);
            }
        }
      },
      (error) => {
        toast({
          title: 'Error fetching SKUs',
          description: error.message,
          variant: 'destructive',
        });
        setLoadingSkus(false);
      }
    );
    return () => unsubscribe();
  }, [toast, user, selectedStoreId, selectedSku?.id]); // Dependency on selectedSku.id to potentially re-trigger if needed, though subscribeToSkus handles real-time.

  const handleViewDetails = (sku: Sku) => {
    setSelectedSku(sku);
  };

  const handleBackToList = () => {
    setSelectedSku(null);
  };

  if (selectedSku) {
    return <SkuDetail sku={selectedSku} onBack={handleBackToList} onSkuUpdate={setSelectedSku} permissions={permissions} />;
  }

  return <SkuList skus={allSkus} loading={loadingSkus} onViewDetails={handleViewDetails} permissions={permissions} />;
}
