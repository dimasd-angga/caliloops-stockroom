
'use client';
import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Sku, Permissions } from '@/lib/types';
import { getPaginatedSkus } from '@/lib/services/skuService';
import { UserContext } from '@/app/dashboard/layout';
import { SkuList } from './components/SkuList';
import { SkuDetail } from './components/SkuDetail';
import { DocumentData, DocumentSnapshot } from 'firebase/firestore';

export default function InboundPage() {
  const { toast } = useToast();
  const { user, selectedStoreId, permissions } = React.useContext(UserContext);
  
  const [skus, setSkus] = React.useState<Sku[]>([]);
  const [loadingSkus, setLoadingSkus] = React.useState(true);
  const [selectedSku, setSelectedSku] = React.useState<Sku | null>(null);

  // Pagination state
  const [pageCursors, setPageCursors] = React.useState<(DocumentSnapshot<DocumentData> | null)[]>([null]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalSkus, setTotalSkus] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const PAGE_SIZE = 10;

  React.useEffect(() => {
    // This effect handles loading data when the store or search term changes.
    // It resets pagination and fetches the first page.
    setCurrentPage(1);
    setPageCursors([null]);
    loadSkus(1, searchTerm, true); // `true` to indicate it's a fresh load/reset
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, searchTerm]);

  const loadSkus = React.useCallback(async (page: number, search: string, isReset: boolean = false) => {
    setLoadingSkus(true);
    const storeIdToQuery = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId || null;

    if (!storeIdToQuery) {
      setSkus([]);
      setTotalSkus(0);
      setLoadingSkus(false);
      return;
    }

    try {
      // Use the cursor for the page we are navigating to.
      // If it's a reset, the cursor is null.
      const startAfterDoc = isReset ? null : pageCursors[page - 1];
      
      const { skus: fetchedSkus, last, totalCount } = await getPaginatedSkus(storeIdToQuery, PAGE_SIZE, search, startAfterDoc);
      
      setSkus(fetchedSkus);
      setTotalSkus(totalCount);

      // Store the cursor for the *next* page
      if (last) {
        setPageCursors(prev => {
            const newCursors = [...prev];
            newCursors[page] = last; // page is 1-based, so this sets the cursor for page 2
            return newCursors;
        });
      }

    } catch (error: any) {
      console.error("Error fetching SKUs:", error);
      toast({
        title: 'Error fetching SKUs',
        description: error.message,
        variant: 'destructive',
      });
      setSkus([]);
      setTotalSkus(0);
    } finally {
      setLoadingSkus(false);
    }
  }, [user, selectedStoreId, toast, pageCursors, PAGE_SIZE]);
  
  const handlePageChange = (direction: 'next' | 'prev' | 'first') => {
    if (direction === 'first') {
        setCurrentPage(1);
        loadSkus(1, searchTerm, true); // Reset
    } else if (direction === 'next' && (currentPage * PAGE_SIZE < totalSkus)) {
        const nextPage = currentPage + 1;
        setCurrentPage(nextPage);
        loadSkus(nextPage, searchTerm);
    } else if (direction === 'prev' && currentPage > 1) {
        const prevPage = currentPage - 1;
        setCurrentPage(prevPage);
        loadSkus(prevPage, searchTerm);
    }
  };

  const handleSkuUpdate = (updatedSku: Sku) => {
    setSelectedSku(updatedSku);
    setSkus(prevSkus => prevSkus.map(s => s.id === updatedSku.id ? updatedSku : s));
  };


  const handleViewDetails = (sku: Sku) => {
    setSelectedSku(sku);
  };

  const handleBackToList = () => {
    setSelectedSku(null);
    // Reload current page to reflect potential changes
    loadSkus(currentPage, searchTerm);
  };
  
  const handleSearch = (search: string) => {
    setSearchTerm(search);
  }

  if (selectedSku) {
    return <SkuDetail sku={selectedSku} onBack={handleBackToList} onSkuUpdate={handleSkuUpdate} permissions={permissions} />;
  }

  return (
    <SkuList 
      skus={skus} 
      loading={loadingSkus} 
      onViewDetails={handleViewDetails} 
      permissions={permissions}
      onPageChange={handlePageChange}
      currentPage={currentPage}
      totalSkus={totalSkus}
      pageSize={PAGE_SIZE}
      onSearch={handleSearch}
    />
  );
}
