import apiClient from '../../../lib/axiosInstance';
import type { SignInCredentials, SignInResponse, User, ProfileResponse } from '../types';

/**
 * Sign in user with email and password via POST /auth/signin
 */
export async function signInApi(credentials: SignInCredentials): Promise<{ token: string; user?: User }> {
  const response = await apiClient.post<SignInResponse>('/auth/signin', credentials);
  const resData = response.data;

  // Extract access token from response variations
  const token =
    resData?.accessToken ||
    resData?.token ||
    resData?.data?.accessToken ||
    resData?.data?.token;

  if (!token) {
    throw new Error('Invalid response from server: Access token missing');
  }

  // Extract user object if returned in signin response
  const user = resData?.user || resData?.data?.user;

  return { token, user };
}

/**
 * Fetch authenticated user profile via GET /auth/profile
 * @param token Optional token if calling before storing in localStorage
 */
export async function getProfileApi(token?: string): Promise<User> {
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : {};

  const response = await apiClient.get<ProfileResponse>('/auth/profile', config);
  const resData = response.data;

  // Extract user profile from different potential API response shapes
  let fetchedUser: User | undefined;

  if ('id' in resData && 'role' in resData && typeof resData.id === 'string') {
    fetchedUser = resData as unknown as User;
  } else if (resData.user) {
    fetchedUser = resData.user;
  } else if (resData.data) {
    if ('id' in resData.data && 'role' in resData.data) {
      fetchedUser = resData.data as unknown as User;
    } else if ('user' in resData.data && resData.data.user) {
      fetchedUser = resData.data.user;
    }
  }

  if (!fetchedUser || !fetchedUser.role) {
    throw new Error('Invalid user profile response received from server');
  }

  return fetchedUser;
}
