import apiClient from '../../../lib/axiosInstance';

export interface MerchantOrderItemInput {
  productName: string;
}

export interface CreateMerchantOrderPayload {
  customerName: string;
  customerPhone: string;
  externalOrderId?: string;
  items: MerchantOrderItemInput[];
}

export interface CreatedMerchantOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  externalOrderId?: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
  source: 'MERCHANT_PORTAL' | 'EXTERNAL_API';
  items: Array<{
    id: string;
    productName: string;
    nfcId: string;
    setupToken: string;
    setupPath: string;
    setupUrl: string;
    viewUrl: string;
  }>;
  quota: {
    unlimited: boolean;
    used: number;
    total: number;
    remaining: number | null;
  };
}

export interface MerchantOrderItem {
  id: string;
  productName: string;
  nfcId: string;
  isLocked: boolean;
  setupPath: string;
  setupUrl: string;
  viewUrl: string;
}

export interface MerchantOrder {
  id: string;
  customerName: string;
  customerPhone?: string;
  externalOrderId?: string;
  status: 'PENDING' | 'COMPLETED';
  source: 'ADMIN' | 'MERCHANT_PORTAL' | 'EXTERNAL_API';
  createdAt: string;
  items: MerchantOrderItem[];
}

export interface MerchantOrdersResponse {
  items: MerchantOrder[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    total: number;
    pending: number;
    completed: number;
  };
}

const unwrap = <T>(responseData: { data?: T } | T): T => {
  if (
    responseData &&
    typeof responseData === 'object' &&
    'data' in responseData &&
    responseData.data !== undefined
  ) {
    return responseData.data as T;
  }
  return responseData as T;
};

export const merchantOrderService = {
  async createOrder(payload: CreateMerchantOrderPayload): Promise<CreatedMerchantOrder> {
    const response = await apiClient.post('/merchant/orders', payload);
    return unwrap<CreatedMerchantOrder>(response.data);
  },

  async getOrders(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'PENDING' | 'COMPLETED';
  }): Promise<MerchantOrdersResponse> {
    const response = await apiClient.get('/merchant/orders', { params });
    return unwrap<MerchantOrdersResponse>(response.data);
  },

  async getOrder(orderId: string): Promise<MerchantOrder> {
    const response = await apiClient.get(`/merchant/orders/${orderId}`);
    return unwrap<MerchantOrder>(response.data);
  },

  async updateOrderStatus(
    orderId: string,
    status: MerchantOrder['status'],
  ): Promise<MerchantOrder> {
    const response = await apiClient.patch(`/merchant/orders/${orderId}/status`, {
      status,
    });
    return unwrap<MerchantOrder>(response.data);
  },

  async updateItemLock(
    orderId: string,
    itemId: string,
    isLocked: boolean,
  ): Promise<MerchantOrder> {
    const response = await apiClient.patch(
      `/merchant/orders/${orderId}/items/${itemId}/lock`,
      { isLocked },
    );
    return unwrap<MerchantOrder>(response.data);
  },
};
