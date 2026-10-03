import { useState, useEffect } from 'react';
import type { MerchantDashboardData } from '../types';

export const useMerchantDashboard = (initialData?: Partial<MerchantDashboardData>) => {
  const [data, setData] = useState<MerchantDashboardData>({
    storeName: initialData?.storeName,
    isUnlimitedQuota: initialData?.isUnlimitedQuota,
    totalQuota: initialData?.totalQuota,
    availableLinks: initialData?.availableLinks,
    usedLinks: initialData?.usedLinks,
    totalOrders: initialData?.totalOrders,
    usedPercentageChange: initialData?.usedPercentageChange,
    recentOrders: initialData?.recentOrders ?? [],
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Endpoint call for live backend integration when connected
    } catch (err: any) {
      setError(err?.message || 'Failed to load merchant data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialData) {
      setData((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [initialData]);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
};
