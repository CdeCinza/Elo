'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

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
    }[];
  };
}

export function useCustomerSession(tableId: string | number) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [table, setTable] = useState<TableSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const [catRes, prodRes, tableRes] = await Promise.all([
        api.get('/categories'),
        api.get('/products'),
        api.get(`/customer/table/${tableId}`),
      ]);

      setCategories(catRes.data.data || []);
      setProducts(prodRes.data.data || []);
      setTable(tableRes.data.table || null);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao buscar dados da API:', err);
      if (!isSilent) {
        setError(err.response?.data?.message || 'Falha ao conectar com o servidor.');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    fetchSessionData();

    // Polling suave a cada 4 segundos para refletir mudanças da cozinha e do caixa
    const interval = setInterval(() => {
      fetchSessionData(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchSessionData]);

  const checkIn = async () => {
    try {
      const response = await api.post(`/customer/table/${tableId}/check-in`);
      await fetchSessionData(true);
      return { success: true, data: response.data };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || 'Erro ao iniciar atendimento.',
      };
    }
  };

  const callWaiter = async () => {
    try {
      const response = await api.post(`/customer/table/${tableId}/call-waiter`);
      await fetchSessionData(true);
      return { success: true, data: response.data };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || 'Erro ao chamar garçom.',
      };
    }
  };

  const requestBill = async () => {
    try {
      const response = await api.post(`/customer/table/${tableId}/request-bill`);
      await fetchSessionData(true);
      return { success: true, data: response.data };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || 'Erro ao pedir a conta.',
      };
    }
  };

  const sendOrder = async (items: { product_id: number; quantity: number; notes?: string }[]) => {
    try {
      const response = await api.post(`/customer/table/${tableId}/order`, { items });
      await fetchSessionData(true);
      return { success: true, data: response.data };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || 'Erro ao enviar o pedido.',
      };
    }
  };

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
