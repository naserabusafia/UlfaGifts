import apiClient from '../../../lib/axiosInstance';
import type {
  CreateOrderPayload,
  OrdersQueryParams,
  PaginatedOrdersResponse,
  SystemOrder,
  UpdateOrderPayload,
} from '../types';
import { mockOrderService } from './mockOrderService';

// TEMPORARY MOCK SWITCH: set this to false (or remove mockOrderService.ts) to use the real API.
const USE_TEMPORARY_MOCK_ORDERS = true;

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

export const orderService = {
  isMockMode: USE_TEMPORARY_MOCK_ORDERS,
  getMockMerchants: () => mockOrderService.getMerchants(),
  resetMockOrders: () => mockOrderService.resetOrders(),

  async createOrder(payload: CreateOrderPayload): Promise<SystemOrder> {
    if (USE_TEMPORARY_MOCK_ORDERS) return mockOrderService.createOrder(payload);
    const response = await apiClient.post('/orders', payload);
    return unwrap<SystemOrder>(response.data);
  },

  async getOrders(params: OrdersQueryParams): Promise<PaginatedOrdersResponse> {
    if (USE_TEMPORARY_MOCK_ORDERS) return mockOrderService.getOrders(params);
    const response = await apiClient.get('/orders', { params });
    return unwrap<PaginatedOrdersResponse>(response.data);
  },

  async getOrder(orderId: string): Promise<SystemOrder> {
    if (USE_TEMPORARY_MOCK_ORDERS) return mockOrderService.getOrder(orderId);
    const response = await apiClient.get(`/orders/${orderId}`);
    return unwrap<SystemOrder>(response.data);
  },

  async updateOrder(orderId: string, payload: UpdateOrderPayload): Promise<SystemOrder> {
    if (USE_TEMPORARY_MOCK_ORDERS) return mockOrderService.updateOrder(orderId, payload);
    const response = await apiClient.patch(`/orders/${orderId}`, payload);
    return unwrap<SystemOrder>(response.data);
  },

  async deleteOrder(orderId: string): Promise<void> {
    if (USE_TEMPORARY_MOCK_ORDERS) return mockOrderService.deleteOrder(orderId);
    await apiClient.delete(`/orders/${orderId}`);
  },
};

export default orderService;
