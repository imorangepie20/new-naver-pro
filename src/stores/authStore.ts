// ============================================
// 인증 Store
// Zustand 기반 사용자 인증 상태 관리
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useThemeStore } from './themeStore';

import { API_BASE } from '../lib/api';

// 사용자 타입
export interface User {
  id: string;
  email: string;
  name: string;
  themeMode?: string | null;
  accentColor?: string | null;
  fontSize?: string | null;
  borderRadius?: string | null;
  compactMode?: boolean | null;
}

// Auth 상태 타입
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // 액션
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, name: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  // 인증된 fetch 함수
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      // 로그인
      login: async (email: string, password: string) => {
        set({ isLoading: true });

        try {
          const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
            });
            // Load theme preferences from user data
            useThemeStore.getState().loadFromUser(data.user);
            return { success: true };
          } else {
            set({ isLoading: false });
            return { success: false, error: data.error || '로그인에 실패했습니다.' };
          }
        } catch (error) {
          set({ isLoading: false });
          return { success: false, error: '네트워크 오류가 발생했습니다.' };
        }
      },

      // 회원가입
      register: async (email: string, name: string, password: string) => {
        set({ isLoading: true });

        try {
          const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, password }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
            });
            // Load theme preferences from user data
            useThemeStore.getState().loadFromUser(data.user);
            return { success: true };
          } else {
            set({ isLoading: false });
            return { success: false, error: data.error || '회원가입에 실패했습니다.' };
          }
        } catch (error) {
          set({ isLoading: false });
          return { success: false, error: '네트워크 오류가 발생했습니다.' };
        }
      },

      // 로그아웃
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      // 인증 상태 확인
      checkAuth: async () => {
        const { token } = get();
        if (!token) return;

        try {
          const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            set({
              user: data.user,
              isAuthenticated: true,
            });
            // Load theme preferences from user data
            useThemeStore.getState().loadFromUser(data.user);
          } else {
            // 토큰이 유효하지 않으면 로그아웃
            get().logout();
          }
        } catch (error) {
          console.error('Auth check failed:', error);
        }
      },

      // 인증된 fetch 함수 (Authorization 헤더 자동 추가)
      authFetch: async (url: string, options: RequestInit = {}) => {
        const { token } = get();
        const headers = new Headers(options.headers);

        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        return fetch(url, {
          ...options,
          headers,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
