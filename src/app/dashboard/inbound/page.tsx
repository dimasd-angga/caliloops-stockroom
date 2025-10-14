
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
  
  // Effect for fetching data when filters or page change
  React.useEffect(() => {
    const fetchFirstPage = async () => {
      setLoadingSkus(true);
      setCurrentPage(1);
      setPageCursors([null]);

      const storeIdToQuery = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId || null;

      if (!storeIdToQuery) {
        setSkus([]);
        setTotalSkus(0);
        setLoadingSkus(false);
        return;
      }

      try {
        const { skus: fetchedSkus, last, totalCount } = await getPaginatedSkus(storeIdToQuery, PAGE_SIZE, searchTerm, null);
        
        setSkus(fetchedSkus);
        setTotalSkus(totalCount);
        
        setPageCursors(prev => {
            const newCursors = [null]; // Reset cursors
            if (last) {
              newCursors[1] = last;
            }
            return newCursors;
        });

      } catch (error: any) {
        toast({ title: 'Error fetching SKUs', description: error.message, variant: 'destructive' });
        setSkus([]);
        setTotalSkus(0);
      } finally {
        setLoadingSkus(false);
      }
    };
    
    fetchFirstPage();
  }, [selectedStoreId, searchTerm, user, toast]);

  // Effect for handling page navigation (next/prev)
  React.useEffect(() => {
    if (currentPage === 1) return; // This is handled by the effect above

    const loadSkusForPage = async () => {
      setLoadingSkus(true);
      const storeIdToQuery = user?.email === 'superadmin@caliloops.com' ? selectedStoreId : user?.storeId || null;

      if (!storeIdToQuery) {
          setLoadingSkus(false);
          return;
      }

      try {
        const startAfterDoc = pageCursors[currentPage - 1] || null;
        
        const { skus: fetchedSkus, last, totalCount } = await getPaginatedSkus(storeIdToQuery, PAGE_SIZE, searchTerm, startAfterDoc);
        
        setSkus(fetchedSkus);
        setTotalSkus(totalCount); // Keep total updated

        if (last && pageCursors.length <= currentPage) {
          setPageCursors(prev => {
              const newCursors = [...prev];
              newCursors[currentPage] = last;
              return newCursors;
          });
        }
      } catch (error: any) {
        toast({ title: 'Error fetching next page', description: error.message, variant: 'destructive' });
      } finally {
        setLoadingSkus(false);
      }
    };
    
    loadSkusForPage();
  }, [currentPage]);
  
  const handlePageChange = (direction: 'next' | 'prev' | 'first') => {
    if (direction === 'first') {
        if (currentPage !== 1) {
            setCurrentPage(1);
        }
    } else if (direction === 'next' && (currentPage * PAGE_SIZE < totalSkus)) {
      setCurrentPage(prev => prev + 1);
    } else if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };
  
  const handleSearch = (search: string) => {
    setSearchTerm(search);
  }

  const handleSkuUpdate = (updatedSku: Sku) => {
    setSelectedSku(updatedSku);
    setSkus(prevSkus => prevSkus.map(s => s.id === updatedSku.id ? updatedSku : s));
  };


  const handleViewDetails = (sku: Sku) => {
    setSelectedSku(sku);
  };

  const handleBackToList = () => {
    setSelectedSku(null);
    // Trigger a re-fetch of the first page to ensure data is fresh
    setSearchTerm(st => st ? '' : ' '); // Toggling to trigger effect
    setSearchTerm('');
  };

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
