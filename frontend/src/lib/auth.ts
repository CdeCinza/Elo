export interface UserRole {
  id: number;
  name: string;
  label: string;
}

export interface Restaurant {
  id: number;
  name: string;
  slug: string;
  document?: string | null;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
  status: string;
  tables_count?: number;
  products_count?: number;
  orders_count?: number;
  users_count?: number;
  total_revenue?: number;
  owner?: {
    id: number;
    name: string;
    email: string;
    role_label: string;
  } | null;
  created_at?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  restaurant_id: number | null;
  restaurant: Restaurant | null;
  role: UserRole | null;
  is_super_admin: boolean;
  is_restaurant_admin: boolean;
  created_at?: string;
}

export interface AuthSession {
  user: User;
  token: string;
}

const USER_STORAGE_KEY = 'elo_auth_user';
const TOKEN_STORAGE_KEY = 'elo_auth_token';
const RESTAURANT_STORAGE_KEY = 'elo_active_restaurant';

export function getAuthUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthSession(user: User, token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  if (user.restaurant) {
    localStorage.setItem(RESTAURANT_STORAGE_KEY, JSON.stringify(user.restaurant));
  }
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(RESTAURANT_STORAGE_KEY);
}

export function getActiveRestaurant(): Restaurant | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RESTAURANT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveRestaurant(restaurant: Restaurant): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RESTAURANT_STORAGE_KEY, JSON.stringify(restaurant));
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}