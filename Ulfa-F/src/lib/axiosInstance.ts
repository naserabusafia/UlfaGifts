import axios, { type AxiosInstance, type CreateAxiosDefaults } from 'axios';
import { setupInterceptors } from './axiosInterceptors';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const DEFAULT_TIMEOUT_MS = 15000;

const config: CreateAxiosDefaults = {
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
};

/**
 * Main application Axios client instance with configured base URL, defaults, and interceptors.
 */
export const apiClient: AxiosInstance = setupInterceptors(axios.create(config));

export default apiClient;
