import { api, getApiErrorMessage } from './api';
import { setActiveRestaurant, User } from './auth';

const TABLET_TABLE_KEY = 'elo_tablet_table';
const TABLET_CONFIGURED_AT_KEY = 'elo_tablet_configured_at';
const MANAGER_ROLES = ['owner', 'restaurant_admin', 'manager', 'super_admin'];

export type ManagerVerification = { success: true } | { success: false; message: string };

/**
 * Confirma as credenciais de um gerente na API sem manter a sessão aberta no tablet.
 * O restaurante do gerente passa a ser o restaurante ativo do dispositivo.
 */
export async function verifyManagerCredentials(email: string, password: string): Promise<ManagerVerification> {
  let user: User;
  let token: string;

  try {
    const response = await api.post('/auth/login', { email: email.trim(), password });
    user = response.data.user;
    token = response.data.access_token;
  } catch (error) {
    return { success: false, message: getApiErrorMessage(error, 'Credenciais inválidas.') };
  }

  const isManager = user.is_super_admin || MANAGER_ROLES.includes(user.role?.name ?? '');
  if (isManager && user.restaurant) {
    setActiveRestaurant(user.restaurant);
  }

  // O tablet fica sem sessão de funcionário: descarta o token emitido só para a verificação
  await api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);

  if (!isManager) {
    return { success: false, message: 'Apenas a gerência pode configurar o tablet.' };
  }

  if (!user.restaurant) {
    return { success: false, message: 'Use a conta de um gerente do restaurante onde o tablet ficará.' };
  }

  return { success: true };
}

export function normalizeTableNumber(value: string): string {
  const digits = value.replace(/[^0-9]/g, '');
  return digits !== '' ? String(parseInt(digits, 10)).padStart(2, '0') : value.trim();
}

export async function tableExists(tableNumber: string): Promise<boolean> {
  try {
    await api.get(`/customer/table/${encodeURIComponent(tableNumber)}`);
    return true;
  } catch {
    return false;
  }
}

export function getLinkedTable(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TABLET_TABLE_KEY);
}

export function linkTabletToTable(tableNumber: string): void {
  localStorage.setItem(TABLET_TABLE_KEY, tableNumber);
  localStorage.setItem(TABLET_CONFIGURED_AT_KEY, new Date().toISOString());
}

export function unlinkTablet(): void {
  localStorage.removeItem(TABLET_TABLE_KEY);
  localStorage.removeItem(TABLET_CONFIGURED_AT_KEY);
}
