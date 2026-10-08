/** CANCELLED: links locked and quota refunded; restorable for a while. */
export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface OrderMerchant {
  id: string;
  email: string;
  companyName?: string;
}

export interface OrderNfcItem {
  id: string;
  productName: string;
  nfcId: string;
  isLocked: boolean;
  lockReason?: string | null;
  giftCount?: number;
  quotaCharged?: boolean;
  setupState?: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY';
  /** Only on the order details; null for items without a setup token. */
  setupUrl?: string | null;
  viewUrl?: string;
  createdAt: string;
}

export interface SystemOrder {
  id: string;
  orderNumber: number;
  externalOrderId?: string;
  customerName: string;
  customerPhone?: string;
  status: OrderStatus;
  source?: 'ADMIN' | 'MERCHANT_PORTAL' | 'EXTERNAL_API';
  createdAt: string;
  merchant?: OrderMerchant;
  nfcItems?: OrderNfcItem[];
}

export interface OrdersSummary {
  total: number;
  pending: number;
  completed: number;
  cancelled?: number;
}

export interface OrdersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: OrderStatus;
  merchantId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedOrdersResponse {
  items: SystemOrder[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: OrdersSummary;
}

export interface UpdateOrderPayload {
  merchantId?: string;
  customerName?: string;
  customerPhone?: string;
  externalOrderId?: string;
  status?: OrderStatus;
}

export interface CreateOrderPayload {
  merchantId: string;
  customerName: string;
  customerPhone: string;
  externalOrderId?: string;
  status?: OrderStatus;
}
