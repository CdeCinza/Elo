'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Flame,
  Volume2,
  VolumeX,
  ArrowRight,
  UtensilsCrossed,
  Layers,
  AlertTriangle,
  RotateCcw,
  Check,
} from 'lucide-react';

interface KitchenOrderItem {
  id: number;
  quantity: number;
  name: string;
  station: 'grill' | 'fryer' | 'dessert';
  notes?: string;
  completed?: boolean;
}

interface KitchenOrder {
  id: number;
  tableNumber: string;
  openedAt: string;
  minutesAgo: number;
  items: KitchenOrderItem[];
  status: 'pending' | 'preparing' | 'ready';
}

export default function KitchenKdsPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationFilter, setStationFilter] = useState<'all' | 'grill' | 'fryer' | 'dessert'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const fetchOrders = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/kds/orders');
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error('Erro ao buscar pedidos do KDS:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    // Polling a cada 4 segundos para novos pedidos caírem na hora
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleAdvanceStatus = async (orderId: number) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    let nextStatus: 'preparing' | 'ready' = 'preparing';
    if (targetOrder.status === 'pending') nextStatus = 'preparing';
    else if (targetOrder.status === 'preparing') nextStatus = 'ready';

    // Atualização otimista
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        return { ...order, status: nextStatus };
      })
    );

    try {
      await api.patch(`/kds/orders/${orderId}/status`, { status: nextStatus });
      fetchOrders(true);
    } catch (err) {
      console.error('Erro ao atualizar status do pedido:', err);
      fetchOrders(true);
    }
  };

  const handleDismissOrder = async (orderId: number) => {
    // Atualização otimista
    setOrders((prev) => prev.filter((o) => o.id !== orderId));

    try {
      await api.patch(`/kds/orders/${orderId}/status`, { status: 'delivered' });
      fetchOrders(true);
    } catch (err) {
      console.error('Erro ao dar baixa no pedido entregue:', err);
      fetchOrders(true);
    }
  };

  const handleToggleItemCompleted = (orderId: number, itemId: number) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          items: order.items.map((item) => {
            if (item.id !== itemId) return item;
            return { ...item, completed: !item.completed };
          }),
        };
      })
    );
  };

  const filteredOrders = orders.filter((order) => {
    if (stationFilter === 'all') return true;
    return order.items.some((item) => item.station === stationFilter);
  });

  const pendingOrders = filteredOrders.filter((o) => o.status === 'pending');
  const preparingOrders = filteredOrders.filter((o) => o.status === 'preparing');
  const readyOrders = filteredOrders.filter((o) => o.status === 'ready');

  const delayedCount = orders.filter((o) => o.minutesAgo >= 20 && o.status !== 'ready').length;

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col selection:bg-[#C84E1F] selection:text-white font-sans antialiased">
      {/* 1. Header do KDS */}
      <header className="h-16 px-6 bg-white border-b border-[#EAE6E1] flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl font-bold tracking-tight text-[#191817]">ELO</span>
            <span className="text-xs text-[#78716A] border-l border-[#E0DBD3] pl-3">
              KDS • Linha de Produção & Cozinha
            </span>
          </Link>
        </div>

        {/* Métricas Operacionais Centrais */}
        <div className="hidden lg:flex items-center gap-6 text-xs text-[#78716A]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Fila ativa: <strong className="text-[#191817]">{orders.length} comandas</strong></span>
          </div>
          <div className="h-3 w-[1px] bg-[#E0DBD3]" />
          <div>
            <span>Tempo médio: <strong className="text-[#191817]">14 min</strong></span>
          </div>
          <div className="h-3 w-[1px] bg-[#E0DBD3]" />
          <div className="flex items-center gap-1.5">
            {delayedCount > 0 ? (
              <span className="text-rose-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                {delayedCount} {delayedCount === 1 ? 'pedido em atraso (>20m)' : 'pedidos em atraso'}
              </span>
            ) : (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Sem atrasos críticos
              </span>
            )}
          </div>
        </div>

        {/* Ações Rápidas do KDS */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#57534E] hover:text-[#191817] hover:border-[#C84E1F] transition-colors cursor-pointer shadow-2xs"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Alerta sonoro</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-[#A8A199]" />
                <span>Silenciado</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. Barra de Filtros por Praça da Cozinha */}
      <div className="px-6 py-3 bg-white border-b border-[#EAE6E1] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto bg-[#FAF8F5] p-1 rounded-xl border border-[#EAE6E1]">
          <span className="text-xs text-[#78716A] px-2 font-medium hidden sm:inline">Praças:</span>
          <button
            onClick={() => setStationFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              stationFilter === 'all'
                ? 'bg-white text-[#191817] shadow-xs font-semibold'
                : 'text-[#78716A] hover:text-[#191817]'
            }`}
          >
            Todas ({orders.length})
          </button>
          <button
            onClick={() => setStationFilter('grill')}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              stationFilter === 'grill'
                ? 'bg-[#C84E1F] text-white shadow-xs font-semibold'
                : 'text-[#78716A] hover:text-[#191817]'
            }`}
          >
            Chapa & Grelha
          </button>
          <button
            onClick={() => setStationFilter('fryer')}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              stationFilter === 'fryer'
                ? 'bg-[#C84E1F] text-white shadow-xs font-semibold'
                : 'text-[#78716A] hover:text-[#191817]'
            }`}
          >
            Frituras & Entradas
          </button>
          <button
            onClick={() => setStationFilter('dessert')}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              stationFilter === 'dessert'
                ? 'bg-[#C84E1F] text-white shadow-xs font-semibold'
                : 'text-[#78716A] hover:text-[#191817]'
            }`}
          >
            Sobremesas
          </button>
        </div>

        <div className="text-xs text-[#78716A] hidden sm:block">
          Dica: clique no prato para dar check ao aprontar
        </div>
      </div>

      {/* 3. Banner Informativo de Fila Limpa */}
      {orders.length === 0 && (
        <div className="mx-6 mt-4 p-4 rounded-2xl bg-white border border-[#EAE6E1] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#191817]">Fila de produção em dia (0 pedidos)</p>
              <p className="text-[11px] text-[#78716A]">
                A cozinha está aguardando novos pedidos. Ao enviar um pedido pelo tablet ou salão, ele aparecerá aqui instantaneamente.
              </p>
            </div>
          </div>
          <Link
            href="/table/01"
            target="_blank"
            className="text-xs text-[#C84E1F] hover:underline font-semibold flex items-center gap-1 shrink-0"
          >
            <span>Testar na Mesa 01</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 4. Colunas Kanban Densas e Estruturadas */}
      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-5 overflow-y-auto">
        {/* Coluna 1: Fila de Entrada */}
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex flex-col min-h-[500px] shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#EAE6E1] shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-sm font-semibold text-[#191817]">Fila de entrada</h2>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              {pendingOrders.length} aguardando
            </span>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto">
            {pendingOrders.length === 0 && (
              <div className="py-16 text-center text-[#A8A199] text-xs">
                Nenhum pedido pendente nesta praça.
              </div>
            )}

            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD3] space-y-3 shadow-2xs hover:border-[#C84E1F] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-base font-bold text-[#191817]">Mesa {order.tableNumber}</span>
                    <span className="text-[11px] text-[#78716A] ml-2">#{order.id}</span>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      order.minutesAgo >= 15
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {order.minutesAgo} min
                  </span>
                </div>

                {/* Lista de Itens */}
                <div className="space-y-2 border-t border-[#E0DBD3] pt-2.5 text-xs">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItemCompleted(order.id, item.id)}
                      className="cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            item.completed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-[#D4CEC5] bg-white'
                          }`}
                        >
                          {item.completed && <Check className="w-3 h-3" />}
                        </div>
                        <span className={`font-medium ${item.completed ? 'line-through text-[#A8A199]' : 'text-[#191817]'}`}>
                          {item.quantity}x {item.name}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-[#C84E1F] pl-6 mt-0.5 font-medium">
                          • {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleAdvanceStatus(order.id)}
                  className="w-full py-2 px-3 rounded-xl bg-white hover:bg-[#C84E1F] border border-[#E0DBD3] hover:border-[#C84E1F] text-[#191817] hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <span>Iniciar preparo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna 2: Em Preparo */}
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex flex-col min-h-[500px] shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#EAE6E1] shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C84E1F] animate-pulse" />
              <h2 className="text-sm font-semibold text-[#191817]">Em preparo</h2>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#C84E1F]/10 text-[#C84E1F] border border-[#C84E1F]/20 font-semibold">
              {preparingOrders.length} no fogo
            </span>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto">
            {preparingOrders.length === 0 && (
              <div className="py-16 text-center text-[#A8A199] text-xs">
                Nenhum pedido sendo preparado no momento.
              </div>
            )}

            {preparingOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#C84E1F]/30 space-y-3 shadow-2xs hover:border-[#C84E1F] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-base font-bold text-[#191817]">Mesa {order.tableNumber}</span>
                    <span className="text-[11px] text-[#78716A] ml-2">#{order.id}</span>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      order.minutesAgo >= 20
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold'
                        : 'bg-[#C84E1F]/15 text-[#C84E1F]'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    {order.minutesAgo} min
                  </span>
                </div>

                {/* Lista de Itens */}
                <div className="space-y-2 border-t border-[#E0DBD3] pt-2.5 text-xs">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItemCompleted(order.id, item.id)}
                      className="cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            item.completed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-[#D4CEC5] bg-white'
                          }`}
                        >
                          {item.completed && <Check className="w-3 h-3" />}
                        </div>
                        <span className={`font-medium ${item.completed ? 'line-through text-[#A8A199]' : 'text-[#191817]'}`}>
                          {item.quantity}x {item.name}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-[#C84E1F] pl-6 mt-0.5 font-medium">
                          • {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleAdvanceStatus(order.id)}
                  className="w-full py-2 px-3 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Concluir prato e chamar garçom</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna 3: Pronto para Entrega */}
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex flex-col min-h-[500px] shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#EAE6E1] shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h2 className="text-sm font-semibold text-[#191817]">Pronto para servir</h2>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {readyOrders.length} na bancada
            </span>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto">
            {readyOrders.length === 0 && (
              <div className="py-16 text-center text-[#A8A199] text-xs">
                Nenhum prato na bancada de expedição.
              </div>
            )}

            {readyOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-[#FAF8F5] border border-emerald-300 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-base font-bold text-[#191817]">Mesa {order.tableNumber}</span>
                    <span className="text-[11px] text-[#78716A] ml-2">#{order.id}</span>
                  </div>
                  <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Bancada pronta
                  </span>
                </div>

                <div className="space-y-1.5 border-t border-[#E0DBD3] pt-2.5 text-xs">
                  {order.items.map((item) => (
                    <div key={item.id} className="font-medium text-[#191817]">
                      {item.quantity}x {item.name}
                    </div>
                  ))}
                </div>

                <div className="text-center py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                  Garçom sinalizado para retirada
                </div>

                <button
                  onClick={() => handleDismissOrder(order.id)}
                  className="w-full py-2 px-3 rounded-xl bg-white border border-[#E0DBD3] hover:bg-stone-50 text-[#57534E] hover:text-[#191817] text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                >
                  Entregue ao salão (baixar)
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
