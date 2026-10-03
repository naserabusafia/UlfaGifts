import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, clearAuthTokens } from '../lib/axiosInterceptors';
import {
  signInApi,
  getProfileApi,
  type User,
  type UserRole,
  type SignInCredentials,
} from '../features/auth';

export type { UserRole, User };

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: SignInCredentials) => Promise<User>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  refetchProfile: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to retrieve cached user profile from localStorage safely
const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const cachedUser = getStoredUser();
    // Only show full loading if we have a token but no cached user profile yet
    return !!storedToken && !cachedUser;
  });
  const navigate = useNavigate();

  // Helper to persist user state and localStorage
  const saveUserSession = (newUser: User | null, newToken?: string | null) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
    if (newToken !== undefined) {
      setToken(newToken);
      if (newToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, newToken);
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    }
  };

  // Restore Session on Page Reload / Mount
  const restoreSession = useCallback(async () => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const cachedUser = getStoredUser();

    if (!storedToken) {
      saveUserSession(null, null);
      setIsLoading(false);
      return;
    }

    setToken(storedToken);

    // If using a development mock token, retain cached or mock user without hitting backend endpoint
    if (storedToken.startsWith('jwt_mock_') || storedToken.startsWith('mock_')) {
      if (cachedUser) {
        setUser(cachedUser);
      } else {
        const mockRole: UserRole = storedToken.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : 'MERCHANT';
        saveUserSession({
          id: 'usr_mock_dev',
          email: `${mockRole.toLowerCase()}@ulfa.app`,
          name: `${mockRole} User`,
          role: mockRole,
        });
      }
      setIsLoading(false);
      return;
    }

    // Try fetching fresh user profile from real backend
    try {
      if (!cachedUser) {
        setIsLoading(true);
      }
      const profile = await getProfileApi(storedToken);
      saveUserSession(profile, storedToken);
    } catch (error) {
      console.warn('[AuthContext] Profile verification during refresh failed:', error);
      const axiosErr = error as AxiosError;
      
      // Clear authentication ONLY on explicit 401 Unauthorized status from server
      if (axiosErr.response?.status === 401) {
        clearAuthTokens();
        saveUserSession(null, null);
      } else if (cachedUser) {
        // If network error, 500 server error, or backend unreachable: retain cached user session
        setUser(cachedUser);
      } else {
        clearAuthTokens();
        saveUserSession(null, null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  /**
   * Real API Sign In Method
   */
  const login = async (credentials: SignInCredentials): Promise<User> => {
    setIsLoading(true);
    try {
      const { token: newAccessToken, user: returnedUser } = await signInApi(credentials);

      // Fetch or derive user profile
      let userProfile = returnedUser;
      if (!userProfile || !userProfile.role) {
        userProfile = await getProfileApi(newAccessToken);
      }

      // Block login if user status is INACTIVE / deactivated (Soft Delete)
      if ((userProfile as any).status === 'INACTIVE' || (userProfile as any).isActive === false) {
        clearAuthTokens();
        saveUserSession(null, null);
        const err = new Error('ACCOUNT_INACTIVE');
        (err as any).response = { data: { message: 'ACCOUNT_INACTIVE' } };
        throw err;
      }

      // Store access token and user session
      localStorage.setItem(AUTH_TOKEN_KEY, newAccessToken);
      setToken(newAccessToken);
      saveUserSession(userProfile, newAccessToken);
      return userProfile;
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      clearAuthTokens();
      saveUserSession(null, null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign Out Method
   */
  const logout = () => {
    clearAuthTokens();
    saveUserSession(null, null);
    navigate('/login', { replace: true });
  };

  /**
   * Refetch current profile
   */
  const refetchProfile = async (): Promise<User | null> => {
    if (!token) return null;
    try {
      const profile = await getProfileApi(token);
      saveUserSession(profile, token);
      return profile;
    } catch {
      logout();
      return null;
    }
  };

  /**
   * Mock Role Switcher for development/testing UI fallback
   */
  const switchRole = (newRole: UserRole) => {
    const updatedUser: User = user
      ? { ...user, role: newRole }
      : {
          id: 'usr_demo_' + Math.random().toString(36).substring(2, 7),
          email: `${newRole.toLowerCase()}@ulfa.app`,
          name: `${newRole} User`,
          role: newRole,
        };
    const mockToken = `jwt_mock_${newRole}_${Date.now()}`;
    saveUserSession(updatedUser, mockToken);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        switchRole,
        refetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
