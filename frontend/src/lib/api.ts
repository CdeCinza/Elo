import axios from 'axios';
import { getAuthToken, getActiveRestaurant, getAuthUser, clearAuthSession } from './auth';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api/v1' : 'http://127.0.0.1:8000/api/v1'),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
      return data.message;
    }
  }

  return fallback;
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const activeRestaurant = getActiveRestaurant();
    const user = getAuthUser();
    const restId = activeRestaurant?.id || user?.restaurant_id;
    if (restId) {
      config.headers['X-Restaurant-Id'] = restId.toString();
    }
  }
  return config;
});

// Sessão ausente ou expirada nas telas operacionais: volta ao login preservando o destino
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && axios.isAxiosError(error) && error.response?.status === 401) {
      const { pathname, search } = window.location;
      const isPublicArea = pathname === '/' || pathname.startsWith('/table') || pathname.startsWith('/login');
      if (!isPublicArea) {
        clearAuthSession();
        window.location.assign(`/login?redirect=${encodeURIComponent(pathname + search)}`);
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Encerra a sessão no backend (revoga o token) e limpa os dados locais do operador.
 */
export async function signOut(): Promise<void> {
  await api.post('/auth/logout').catch(() => undefined);
  clearAuthSession();
}
