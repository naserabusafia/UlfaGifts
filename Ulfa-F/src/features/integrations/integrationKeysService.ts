import apiClient from '../../lib/axiosInstance';

export interface IntegrationKey {
  id: string;
  label: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string | null;
}

/** Returned once on creation: the only time the full key is visible. */
export interface CreatedIntegrationKey extends IntegrationKey {
  apiKey: string;
}

const unwrap = <T>(responseData: { data?: T } | T): T =>
  responseData && typeof responseData === 'object' && 'data' in responseData && responseData.data !== undefined
    ? (responseData.data as T)
    : (responseData as T);

export const integrationKeysService = {
  async list(): Promise<IntegrationKey[]> {
    const response = await apiClient.get('/merchant/integration-keys');
    return unwrap<IntegrationKey[]>(response.data) ?? [];
  },

  async create(label: string): Promise<CreatedIntegrationKey> {
    const response = await apiClient.post('/merchant/integration-keys', { label });
    return unwrap<CreatedIntegrationKey>(response.data);
  },

  async revoke(id: string): Promise<void> {
    await apiClient.delete(`/merchant/integration-keys/${id}`);
  },
};

export default integrationKeysService;
