export type OrderStatus = 'PENDING' | 'COMPLETED';

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
  createdAt: string;
}

export interface SystemOrder {
  id: string;
  externalOrderId?: string;
  customerName: string;
  customerPhone?: string;
  status: OrderStatus;
  createdAt: string;
  merchant?: OrderMerchant;
  nfcItems?: OrderNfcItem[];
}

export interface OrdersSummary {
  total: number;
  pending: number;
  completed: number;
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
