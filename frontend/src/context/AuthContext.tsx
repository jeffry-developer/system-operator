import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';
import { Usuario, AuthTokens } from '../types';

interface AuthContextType {
  user: Usuario | null;
  tokens: AuthTokens | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, nombre: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    if (api.isAuthenticated()) {
      try {
        await refreshUser();
      } catch {
        api.logout();
      }
    }
    setLoading(false);
  };

  const refreshUser = async () => {
    const userData = await api.getMe();
    setUser(userData);
  };

  const login = async (email: string, password: string) => {
    await api.login(email, password);
    await refreshUser();
  };

  const register = async (email: string, nombre: string) => {
    await api.register(email, nombre);
    await refreshUser();
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, tokens: api.getTokens(), loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}