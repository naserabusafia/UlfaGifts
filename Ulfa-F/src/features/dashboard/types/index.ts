export type QuotaType = 'unlimited' | 'limited';

export interface OrderItem {
  id: string;
  customerName: string;
  customerPhone?: string;
  amount?: string;
  date?: string;
  status: 'Completed' | 'Processing' | 'Cancelled';
}

export interface MerchantDashboardData {
  storeName?: string;
  isUnlimitedQuota?: boolean;
  totalQuota?: number | 'unlimited' | null;
  availableLinks?: number | 'unlimited' | null;
  usedLinks?: number;
  totalOrders?: number;
  usedPercentageChange?: number;
  recentOrders?: OrderItem[];
}

export interface MerchantDashboardProps {
  initialData?: Partial<MerchantDashboardData>;
  isUnlimitedQuota?: boolean;
  totalQuota?: number | 'unlimited' | null;
  availableLinks?: number | 'unlimited' | null;
  usedLinks?: number;
  totalOrders?: number;
  recentOrders?: OrderItem[];
  onAddNewOrder?: () => void;
}

export interface QuotaLog {
  id: string;
  merchantId: string;
  adminId: string;
  amount: number;
  notes?: string;
  createdAt: string;
  admin?: {
    id: string;
    email: string;
    companyName?: string;
  };
}

export interface MerchantUser {
  id: string;
  email: string;
  companyName?: string;
  role: string;
  isUnlimitedQuota: boolean;
  totalQuota: number;
  usedLinks: number;
  createdAt: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING_PASSWORD_SET';
  isActive?: boolean;
  phone?: string;
}
