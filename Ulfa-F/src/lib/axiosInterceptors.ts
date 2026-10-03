import type { AxiosInstance, InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';

// LocalStorage Keys for Authentication
export const AUTH_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const AUTH_USER_KEY = 'auth_user';

/**
 * Helper to retrieve stored access token.
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * Helper to retrieve stored refresh token.
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Helper to clear local authentication tokens.
 */
export const clearAuthTokens = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

// Queue mechanism for handling concurrent requests during refresh token flow
interface QueueItem {
  resolve: (token: string) => void;
  reject: (error: AxiosError | Error) => void;
}

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

const processQueue = (error: AxiosError | Error | null, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Extends internal Axios request config to support retry flag.
 */
export interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Setup Request and Response Interceptors for the provided Axios instance.
 */
export function setupInterceptors(axiosInstance: AxiosInstance): AxiosInstance {
  // =========================================================================
  // 1. REQUEST INTERCEPTOR: Attach Bearer Authorization Token
  // =========================================================================
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    }
  );

  // =========================================================================
  // 2. RESPONSE INTERCEPTOR: Handle Errors & Future Refresh Token Mechanism
  // =========================================================================
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as CustomAxiosRequestConfig;

      if (!originalRequest) {
        return Promise.reject(error);
      }

      // Handle 401 Unauthorized Error
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // If refresh token call is already in progress, queue subsequent requests
          return new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((newToken) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
              return axiosInstance(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        // =========================================================================
        // TODO / FUTURE-PROOF REFRESH TOKEN MECHANISM:
        // The backend currently ONLY issues an access token and does NOT support
        // refresh tokens yet.
        //
        // When backend refresh token endpoint is available (e.g. POST /auth/refresh):
        // 1. Uncomment the token refresh logic block below.
        // 2. Call the refresh endpoint passing getRefreshToken().
        // 3. Save the new access token: localStorage.setItem(AUTH_TOKEN_KEY, newToken).
        // 4. Call processQueue(null, newToken).
        // 5. Retry original request with updated Authorization header.
        // =========================================================================
        /*
        try {
          const refreshToken = getRefreshToken();
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          // Example refresh token call:
          // const response = await axios.post('/auth/refresh', { refreshToken });
          // const { accessToken: newAccessToken } = response.data;
          // localStorage.setItem(AUTH_TOKEN_KEY, newAccessToken);

          // processQueue(null, newAccessToken);
          // originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          // return axiosInstance(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError as AxiosError, null);
          clearAuthTokens();
          // Optional: trigger auth store logout or window location redirect
          // window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
        */

        // Current Fallback: Clear invalid tokens on 401 Unauthorized
        isRefreshing = false;
        processQueue(error, null);
        clearAuthTokens();
      }

      // Handle 403 Forbidden Error
      if (error.response?.status === 403) {
        console.warn('[API Client] Access forbidden:', error.response.data);
      }

      // Handle 500 Internal Server Error
      if (error.response?.status === 500) {
        console.error('[API Client] Server error occurred:', error.response.data);
      }

      return Promise.reject(error);
    }
  );

  return axiosInstance;
}
