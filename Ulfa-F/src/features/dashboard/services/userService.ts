import apiClient from '../../../lib/axiosInstance';
import { type MerchantUser, type QuotaLog } from '../types';

export interface PaginatedUsersResponse {
  items: MerchantUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const userService = {
  async getMerchants(page = 1, limit = 50): Promise<PaginatedUsersResponse> {
    const response = await apiClient.get<any>('/users', {
      params: { page, limit, role: 'MERCHANT' },
    });
    // Unwrap NestJS TransformInterceptor response envelope ({ success: true, data: { items: [...] } })
    const resData = response.data?.data || response.data;
    return resData;
  },

  async addQuota(merchantId: string, amount: number, notes?: string): Promise<{ merchant: MerchantUser; log: QuotaLog }> {
    const response = await apiClient.post<any>(`/users/${merchantId}/quota`, {
      amount,
      notes,
    });
    const resData = response.data?.data || response.data;
    return resData;
  },

  async getQuotaLogs(merchantId: string): Promise<QuotaLog[]> {
    const response = await apiClient.get<any>(`/users/${merchantId}/quota-logs`);
    const resData = response.data?.data || response.data;
    return resData;
  },

  async updateMerchant(merchantId: string, payload: Partial<MerchantUser>): Promise<MerchantUser> {
    const response = await apiClient.patch<any>(`/users/${merchantId}`, payload);
    const resData = response.data?.data || response.data;
    return resData;
  },

  async toggleMerchantStatus(merchantId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<MerchantUser> {
    const response = await apiClient.patch<any>(`/users/${merchantId}/status`, { status });
    const resData = response.data?.data || response.data;
    return resData;
  },

  async createMerchant(payload: Partial<MerchantUser>): Promise<MerchantUser> {
    const response = await apiClient.post<any>('/users', {
      ...payload,
      role: 'MERCHANT',
    });
    const resData = response.data?.data || response.data;
    return resData;
  },

  async changeFirstLoginPassword(merchantId: string, newPassword: string): Promise<MerchantUser> {
    const response = await apiClient.patch<any>(`/users/${merchantId}/first-login-password`, {
      newPassword,
    });
    const resData = response.data?.data || response.data;
    return resData;
  },

  async resetMerchantPassword(merchantId: string): Promise<MerchantUser> {
    const response = await apiClient.post<any>(`/users/${merchantId}/reset-password`);
    const resData = response.data?.data || response.data;
    return resData;
  },
};

export default userService;
