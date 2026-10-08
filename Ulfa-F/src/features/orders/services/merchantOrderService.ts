import apiClient from '../../../lib/axiosInstance';

export interface MerchantOrderItemInput {
  productName: string;
}

/** SEPARATE: one link per gift. SHARED: one link written to every gift in the order. */
export type LinkMode = 'SEPARATE' | 'SHARED';

/** CANCELLED is final: links locked, quota refunded, uploads deleted later. */
export type MerchantOrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

/** Where the buyer is with a link's setup. */
export type SetupState = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY';

export interface CreateMerchantOrderPayload {
  customerName: string;
  customerPhone: string;
  externalOrderId?: string;
  items: MerchantOrderItemInput[];
  linkMode?: LinkMode;
}

/** An admin's order for a merchant; chargeQuota false makes the links free. */
export interface CreateAdminOrderPayload extends CreateMerchantOrderPayload {
  merchantId: string;
  chargeQuota?: boolean;
}

export interface CreatedMerchantOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  externalOrderId?: string;
  status: MerchantOrderStatus;
  createdAt: string;
  source: 'ADMIN' | 'MERCHANT_PORTAL' | 'EXTERNAL_API';
  items: Array<{
    id: string;
    productName: string;
    nfcId: string;
    setupToken: string;
    setupPath: string;
    setupUrl: string;
    viewUrl: string;
    giftCount?: number;
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
  lockReason?: string | null;
  giftCount?: number;
  quotaCharged?: boolean;
  setupState?: SetupState;
  publishedAt?: string | null;
  setupPath: string;
  setupUrl: string;
  viewUrl: string;
}

export interface MerchantOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone?: string;
  externalOrderId?: string;
  status: MerchantOrderStatus;
  source: 'ADMIN' | 'MERCHANT_PORTAL' | 'EXTERNAL_API';
  createdAt: string;
  cancelledAt?: string | null;
  contentPurgedAt?: string | null;
  /** When the buyer's uploads will be deleted; null once done. */
  contentDeletesAt?: string | null;
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
    cancelled?: number;
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

  /** Super admin: a full order with items and links for any merchant. */
  async createAdminOrder(payload: CreateAdminOrderPayload): Promise<CreatedMerchantOrder> {
    const response = await apiClient.post('/orders/full', payload);
    return unwrap<CreatedMerchantOrder>(response.data);
  },

  async getOrders(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: MerchantOrderStatus;
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
    lockReason?: string,
  ): Promise<MerchantOrder> {
    const response = await apiClient.patch(
      `/merchant/orders/${orderId}/items/${itemId}/lock`,
      isLocked && lockReason ? { isLocked, lockReason } : { isLocked },
    );
    return unwrap<MerchantOrder>(response.data);
  },
};

/** Ready links out of all links in an order, for "1 of 2 ready" summaries. */
export const orderSetupProgress = (order: Pick<MerchantOrder, 'items'>) => {
  const items = order.items ?? [];
  const ready = items.filter((item) => item.setupState === 'READY').length;
  const started = items.filter((item) => item.setupState === 'IN_PROGRESS').length;
  const known = items.some((item) => item.setupState !== undefined);
  return { total: items.length, ready, started, known };
};

/**
 * The gifts behind one link. A shared link is saved as one item named
 * "Gift A + Gift B" with giftCount 2, so the names are split back out.
 */
export const itemGiftNames = (item: { productName: string; giftCount?: number }) => {
  const count = item.giftCount ?? 1;
  if (count <= 1) return [item.productName];
  const names = item.productName.split(' + ').map((name) => name.trim()).filter(Boolean);
  return names.length === count ? names : [item.productName];
};

/** Physical gifts in an order: a shared link counts once for every gift on it. */
export const orderGiftCount = (items: Array<{ giftCount?: number }> = []) =>
  items.reduce((sum, item) => sum + (item.giftCount ?? 1), 0);
