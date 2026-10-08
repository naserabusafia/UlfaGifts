import apiClient from '../../lib/axiosInstance';

export type QuotaRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface QuotaRequest {
  id: string;
  merchantId: string;
  requestedAmount: number;
  /** What was actually added; may differ from the request. */
  approvedAmount?: number | null;
  status: QuotaRequestStatus;
  merchantReason?: string | null;
  adminReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  merchant?: {
    id: string;
    email: string;
    companyName?: string;
    isUnlimitedQuota: boolean;
    totalQuota: number;
    usedLinks: number;
  } | null;
  reviewedBy?: { id: string; email: string; companyName?: string } | null;
}

export interface QuotaRequestsResponse {
  items: QuotaRequest[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  summary: { pending: number };
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

export const quotaRequestService = {
  // --- merchant ---
  async create(amount: number, reason?: string): Promise<QuotaRequest> {
    const response = await apiClient.post('/quota-requests', reason ? { amount, reason } : { amount });
    return unwrap<QuotaRequest>(response.data);
  },

  async getMine(): Promise<QuotaRequest[]> {
    const response = await apiClient.get('/quota-requests/mine');
    return unwrap<QuotaRequest[]>(response.data) ?? [];
  },

  async cancel(id: string): Promise<QuotaRequest> {
    const response = await apiClient.patch(`/quota-requests/${id}/cancel`);
    return unwrap<QuotaRequest>(response.data);
  },

  // --- super admin ---
  async getAll(params: {
    page?: number;
    limit?: number;
    status?: QuotaRequestStatus;
    merchantId?: string;
  }): Promise<QuotaRequestsResponse> {
    const response = await apiClient.get('/quota-requests', { params });
    return unwrap<QuotaRequestsResponse>(response.data);
  },

  async pendingCount(): Promise<number> {
    const response = await apiClient.get('/quota-requests/pending-count');
    return unwrap<{ pending: number }>(response.data)?.pending ?? 0;
  },

  async approve(id: string, amount?: number, reason?: string): Promise<QuotaRequest> {
    const response = await apiClient.patch(`/quota-requests/${id}/approve`, {
      ...(amount !== undefined ? { amount } : {}),
      ...(reason ? { reason } : {}),
    });
    return unwrap<QuotaRequest>(response.data);
  },

  async reject(id: string, reason?: string): Promise<QuotaRequest> {
    const response = await apiClient.patch(`/quota-requests/${id}/reject`, reason ? { reason } : {});
    return unwrap<QuotaRequest>(response.data);
  },
};

/** The error code the API sent, if any. */
export const apiErrorCode = (error: unknown): string | undefined =>
  (error as { response?: { data?: { code?: string; message?: unknown } } })?.response?.data?.code;

export default quotaRequestService;
