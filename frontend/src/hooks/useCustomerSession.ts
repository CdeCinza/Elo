'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';

export interface Category {
  id: number;
  name: string;
  description: string;
}

export interface Product {
  id: number;
  category_id: number;
  category_name?: string;
  name: string;
  description: string;
  price: number;
  available: boolean;
  image_url?: string;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
  duplicate?: boolean;
}

export interface TableSession {
  id: number;
  number: string;
  capacity: number;
  status: 'free' | 'occupied' | 'bill_requested' | 'reserved';
  active_order?: {
    id: number;
    status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'canceled';
    subtotal: number;
    total: number;
    items: {
      id: number;
      product_id: number;
      product_name: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      notes?: string;
      status?: 'pending' | 'preparing' | 'ready' | 'delivered';
    }[];
  };
}

export function useCustomerSession(tableId: string | number) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [table, setTable] = useState<TableSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightActionsRef = useRef(new Map<string, Promise<ActionResult>>());

  // Toques repetidos enquanto a mesma ação está em andamento reaproveitam a requisição original
  const runExclusive = (actionKey: string, action: () => Promise<ActionResult>): Promise<ActionResult> => {
    const pending = inFlightActionsRef.current.get(actionKey);
    if (pending) return pending.then((result) => ({ ...result, duplicate: true }));
    const request = action().finally(() => inFlightActionsRef.current.delete(actionKey));
    inFlightActionsRef.current.set(actionKey, request);
    return request;
  };

  const fetchSessionData = useCallback(async (isSilent = false) => {
    try {
      const [catRes, prodRes, tableRes] = await Promise.all([
        api.get('/categories', { params: { active: 1 } }),
        api.get('/products', { params: { per_page: 200 } }),
        api.get(`/customer/table/${tableId}`),
      ]);

      const activeCategories: Category[] = catRes.data.data || [];
      const activeCategoryIds = new Set(activeCategories.map((category) => category.id));
      setCategories(activeCategories);
      // Pratos de categorias ocultas pelo gerente também saem do tablet
      setProducts((prodRes.data.data || []).filter((product: Product) => activeCategoryIds.has(product.category_id)));
      setTable(tableRes.data.table || null);
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar dados da API:', err);
      if (!isSilent) {
        setError('Não foi possível carregar o cardápio. Verifique a conexão e tente novamente.');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    const initialFetch = setTimeout(() => {
      void fetchSessionData();
    }, 0);

    // Polling suave a cada 4 segundos para refletir mudanças da cozinha e do caixa
    const interval = setInterval(() => {
      fetchSessionData(true);
    }, 4000);

    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [fetchSessionData]);

  const checkIn = () => runExclusive('check-in', async () => {
    try {
      const response = await api.post(`/customer/table/${tableId}/check-in`);
      await fetchSessionData(true);
      return { success: true, data: response.data };
    } catch (err) {
      return {
        success: false,
        message: getApiErrorMessage(err, 'Erro ao iniciar atendimento.'),
      };
    }
  });

  const callWaiter = () => runExclusive('call-waiter', async () => {
    try {
      const response = await api.post(`/customer/table/${tableId}/call-waiter`);
      await fetchSessionData(true);
      return { success: true, data: response.data };
    } catch (err) {
      return {
        success: false,
        message: getApiErrorMessage(err, 'Erro ao chamar garçom.'),
      };
    }
  });

  const requestBill = () => runExclusive('request-bill', async () => {
    try {
      const response = await api.post(`/customer/table/${tableId}/request-bill`);
      await fetchSessionData(true);
      return { success: true, data: response.data };
    } catch (err) {
      return {
        success: false,
        message: getApiErrorMessage(err, 'Erro ao pedir a conta.'),
      };
    }
  });

  const sendOrder = (items: { product_id: number; quantity: number; notes?: string }[]) => runExclusive('send-order', async () => {
    try {
      const response = await api.post(`/customer/table/${tableId}/order`, { items });
      await fetchSessionData(true);
      return { success: true, data: response.data };
    } catch (err) {
      return {
        success: false,
        message: getApiErrorMessage(err, 'Erro ao enviar o pedido.'),
      };
    }
  });

  return {
    categories,
    products,
    table,
    loading,
    error,
    refresh: fetchSessionData,
    checkIn,
    callWaiter,
    requestBill,
    sendOrder,
  };
}
