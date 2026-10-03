export type UserRole = 'SUPER_ADMIN' | 'MERCHANT' | 'admin' | 'manager' | 'user';

export interface User {
  id: string;
  email: string;
  name?: string;
  companyName?: string;
  role: UserRole;
  isUnlimitedQuota?: boolean;
  totalQuota?: number | 'unlimited' | null;
  usedLinks?: number;
  availableLinks?: number | 'unlimited' | null;
  avatar?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING_PASSWORD_SET';
  createdAt?: string;
  updatedAt?: string;
}

export interface SignInCredentials {
  email: string;
  password?: string;
}

export interface SignInResponse {
  accessToken?: string;
  token?: string;
  user?: User;
  data?: {
    accessToken?: string;
    token?: string;
    user?: User;
  };
  message?: string;
}

export interface ProfileResponse {
  user?: User;
  data?: User | { user: User };
  id?: string;
  email?: string;
  role?: UserRole;
  name?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
