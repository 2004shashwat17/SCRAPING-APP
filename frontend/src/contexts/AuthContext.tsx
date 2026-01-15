/**
 * Authentication context for managing user state and authentication logic
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient, { User, UserData, AuthResponse } from '../services/apiClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<AuthResponse>;
  register: (userData: UserData) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in on app start
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          apiClient.setToken(token);
          const userData = await apiClient.getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('access_token');
          apiClient.setToken(null);
        }
      }
      setLoading(false);
    };

    checkAuthStatus();
  }, []);

  // Listen for auth token being set elsewhere (e.g., OAuth redirect) and refresh user
  useEffect(() => {
    const onTokenSet = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          apiClient.setToken(token);
          const userData = await apiClient.getCurrentUser();
          setUser(userData);
        }
      } catch (error) {
        console.error('Auth refresh failed:', error);
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener('auth:token_set', onTokenSet);
    return () => window.removeEventListener('auth:token_set', onTokenSet);
  }, []);

  // Note: we attach 'avatarChanged' listener above; ensure removal on unmount
  useEffect(() => {
    const onAvatarChanged = async () => {
      try {
        const userData = await apiClient.getCurrentUser();
        setUser(userData);
      } catch (e) {
        console.error('Failed to refresh user after avatar change', e);
      }
    };
    window.addEventListener('avatarChanged', onAvatarChanged as EventListener);
    return () => window.removeEventListener('avatarChanged', onAvatarChanged as EventListener);
  }, []);

  const login = async (username: string, password: string): Promise<AuthResponse> => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await apiClient.login(username, password);
      apiClient.setToken(response.access_token);
      setUser(response.user);
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: UserData): Promise<AuthResponse> => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await apiClient.register(userData);
      apiClient.setToken(response.access_token);
      setUser(response.user);
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear all authentication state
      setUser(null);
      setError(null);
      apiClient.setToken(null);
      // Ensure we remove the stored access token
      localStorage.removeItem('access_token');
    }
  };

  const clearError = (): void => setError(null);

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    clearError,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;