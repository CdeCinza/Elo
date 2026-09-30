'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Clock,
  CheckCircle2,
  Flame,
  Volume2,
  VolumeX,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

interface KitchenOrderItem {
  id: number;
  quantity: number;
  name: string;
  station: 'grill' | 'fryer' | 'dessert';
  notes?: string;
  completed?: boolean;
}

interface GroupedKitchenItem {
  key: string;
  name: string;
  totalQuantity: number;
  station: 'grill' | 'fryer' | 'dessert';
  notes?: string;
  itemIds: number[];
  allCompleted: boolean;
}

const groupOrderItems = (items: KitchenOrderItem[]): GroupedKitchenItem[] => {
  const groups: { [key: string]: GroupedKitchenItem } = {};

  items.forEach((item) => {
    const key = `${item.name}:::${item.notes || ''}:::${item.station}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        name: item.name,
        totalQuantity: 0,
        station: item.station,
        notes: item.notes,
        itemIds: [],
        allCompleted: true,
      };
    }
    groups[key].totalQuantity += item.quantity;
    groups[key].itemIds.push(item.id);
    if (!item.completed) {
      groups[key].allCompleted = false;
    }
  });

  return Object.values(groups);
};

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
      const incomingOrders: KitchenOrder[] = res.data.orders || [];

      setOrders((prevOrders) => {
        // Coleta itens já marcados como concluídos no estado anterior
        const completedIds = new Set<number>();
        prevOrders.forEach((order) => {
          order.items.forEach((item) => {
            if (item.completed) completedIds.add(item.id);
          });
        });

        // Também recupera do localStorage para não perder ao recarregar a página
        if (typeof window !== 'undefined') {
          try {
            const saved: number[] = JSON.parse(localStorage.getItem('elo_kds_completed_items') || '[]');
            saved.forEach((id) => completedIds.add(id));
          } catch {}
        }

        return incomingOrders.map((order) => ({
          ...order,
          items: order.items.map((item) => ({
            ...item,
            completed: completedIds.has(item.id) || !!item.completed,
          })),
        }));
      });
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
    const targetOrder = orders.find((o) => o.id === orderId);
    if (targetOrder && typeof window !== 'undefined') {
      try {
        const orderItemIds = new Set(targetOrder.items.map((i) => i.id));
        const saved: number[] = JSON.parse(localStorage.getItem('elo_kds_completed_items') || '[]');
        const filtered = saved.filter((id) => !orderItemIds.has(id));
        localStorage.setItem('elo_kds_completed_items', JSON.stringify(filtered));
      } catch {}
    }

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

  const handleToggleGroupCompleted = (orderId: number, itemIds: number[], currentAllCompleted: boolean) => {
    const targetState = !currentAllCompleted;
    setOrders((prev) => {
      const updated = prev.map((order) => {
        if (order.id !== orderId) return order;
        const idSet = new Set(itemIds);
        return {
          ...order,
          items: order.items.map((item) => {
            if (!idSet.has(item.id)) return item;
            return { ...item, completed: targetState };
          }),
        };
      });

      if (typeof window !== 'undefined') {
        try {
          const completedIds: number[] = [];
          updated.forEach((o) => {
            o.items.forEach((i) => {
              if (i.completed) completedIds.push(i.id);
            });
          });
          localStorage.setItem('elo_kds_completed_items', JSON.stringify(completedIds));
        } catch {}
      }

      return updated;
    });
  };

  const filteredOrders = orders.filter((order) => {
    if (stationFilter === 'all') return true;
    return order.items.some((item) => item.station === stationFilter);
  });

  const pendingOrders = filteredOrders.filter((o) => o.status === 'pending');
  const preparingOrders = filteredOrders.filter((o) => o.status === 'preparing');
  const readyOrders = filteredOrders.filter((o) => o.status === 'ready');

  const delayedCount = orders.filter((o) => o.minutesAgo >= 20 && o.status !== 'ready').length;

  const activeOrdersForSummary = filteredOrders.filter(
    (o) => o.status === 'pending' || o.status === 'preparing'
  );

  const allDayProductionSummary = React.useMemo(() => {
    const counts: { [name: string]: { name: string; quantity: number; station: string } } = {};

    activeOrdersForSummary.forEach((order) => {
      order.items.forEach((item) => {
        if (stationFilter !== 'all' && item.station !== stationFilter) return;
        if (!counts[item.name]) {
          counts[item.name] = { name: item.name, quantity: 0, station: item.station };
        }
        counts[item.name].quantity += item.quantity;
      });
    });

    return Object.values(counts).sort((a, b) => b.quantity - a.quantity);
  }, [activeOrdersForSummary, stationFilter]);

  const totalActiveItemsCount = allDayProductionSummary.reduce((acc, i) => acc + i.quantity, 0);

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

        <div className="text-xs text-[#78716A] font-medium hidden sm:block">
          ⚡ Toque no botão grande para avançar a comanda inteira • Riscar o item é 100% opcional
        </div>
      </div>

      {/* 2.1 Régua Global de Produção ("All-Day Count" / Linha de Fogo) */}
      <div className="px-6 py-2.5 bg-[#FAF8F5] border-b border-[#EAE6E1] flex items-center gap-3 overflow-x-auto text-xs shrink-0">
        <div className="flex items-center gap-1.5 font-bold text-[#191817] shrink-0">
          <Flame className="w-4 h-4 text-[#C84E1F]" />
          <span>Linha de fogo ({totalActiveItemsCount} {totalActiveItemsCount === 1 ? 'item' : 'itens'} no salão):</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          {allDayProductionSummary.length === 0 ? (
            <span className="text-[#78716A] italic text-xs">Nenhuma produção pendente no momento.</span>
          ) : (
            allDayProductionSummary.map((item) => (
              <span
                key={item.name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E0DBD3] shadow-2xs font-medium text-[#191817] whitespace-nowrap"
              >
                <span className="font-bold text-[#C84E1F]">{item.quantity}x</span>
                <span>{item.name}</span>
              </span>
            ))
          )}
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
              <div className="py-16 text-center text-[#57534E] text-xs">
                Nenhum pedido pendente nesta praça.
              </div>
            )}

            {pendingOrders.map((order) => {
              const grouped = groupOrderItems(order.items);

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD3] space-y-3.5 shadow-2xs hover:border-[#C84E1F] transition-all"
                >
                  {/* Topo do Ticket: Mesa em destaque e Cronômetro */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-[#191817] tracking-tight">
                        Mesa {order.tableNumber}
                      </span>
                      <span className="text-xs font-mono text-[#78716A]">#{order.id}</span>
                    </div>

                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                        order.minutesAgo >= 15
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 font-extrabold animate-pulse'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{order.minutesAgo} min</span>
                    </span>
                  </div>

                  {/* Lista de Itens do Pedido (Limpo, Rápido, Sem Checkbox Pequena) */}
                  <div className="space-y-1.5 border-t border-[#E0DBD3] pt-3">
                    {grouped.map((item) => (
                      <div
                        key={item.key}
                        role="checkbox"
                        aria-checked={item.allCompleted}
                        tabIndex={0}
                        onClick={() => handleToggleGroupCompleted(order.id, item.itemIds, item.allCompleted)}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            handleToggleGroupCompleted(order.id, item.itemIds, item.allCompleted);
                          }
                        }}
                        className={`p-2 rounded-xl transition-all cursor-pointer select-none ${
                          item.allCompleted
                            ? 'opacity-40 bg-stone-200/50'
                            : 'bg-white hover:bg-stone-50 border border-[#EAE6E1]'
                        }`}
                        title="Toque no item para riscar (opcional)"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`text-sm font-black px-2 py-0.5 rounded-lg shrink-0 ${
                              item.allCompleted
                                ? 'bg-stone-300 text-stone-600 line-through'
                                : 'bg-[#C84E1F] text-white'
                            }`}
                          >
                            {item.totalQuantity}x
                          </span>
                          <span
                            className={`text-sm font-bold flex-1 leading-snug ${
                              item.allCompleted ? 'line-through text-stone-500' : 'text-[#191817]'
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>
                        {item.notes && (
                          <div className="mt-1.5 pl-8">
                            <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                              Obs: {item.notes}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Ação Rápida de Avanço da Comanda (1 Toque Grande) */}
                  <button
                    type="button"
                    onClick={() => handleAdvanceStatus(order.id)}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#191817] hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                  >
                    <span>▶ Iniciar Preparo</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna 2: Em Preparo */}
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex flex-col min-h-[500px] shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#EAE6E1] shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C84E1F] animate-pulse" />
              <h2 className="text-sm font-semibold text-[#191817]">Em preparo</h2>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#C84E1F]/15 text-[#9E3712] border border-[#C84E1F]/25 font-semibold">
              {preparingOrders.length} no fogo
            </span>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto">
            {preparingOrders.length === 0 && (
              <div className="py-16 text-center text-[#57534E] text-xs">
                Nenhum pedido sendo preparado no momento.
              </div>
            )}

            {preparingOrders.map((order) => {
              const grouped = groupOrderItems(order.items);

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-[#FAF8F5] border-2 border-[#C84E1F]/40 space-y-3.5 shadow-sm hover:border-[#C84E1F] transition-all"
                >
                  {/* Topo do Ticket: Mesa em destaque e Cronômetro */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-[#191817] tracking-tight">
                        Mesa {order.tableNumber}
                      </span>
                      <span className="text-xs font-mono text-[#78716A]">#{order.id}</span>
                    </div>

                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                        order.minutesAgo >= 20
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 font-extrabold animate-pulse'
                          : 'bg-[#C84E1F]/15 text-[#C84E1F] border border-[#C84E1F]/30'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>{order.minutesAgo} min</span>
                    </span>
                  </div>

                  {/* Lista de Itens do Pedido */}
                  <div className="space-y-1.5 border-t border-[#E0DBD3] pt-3">
                    {grouped.map((item) => (
                      <div
                        key={item.key}
                        role="checkbox"
                        aria-checked={item.allCompleted}
                        tabIndex={0}
                        onClick={() => handleToggleGroupCompleted(order.id, item.itemIds, item.allCompleted)}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            handleToggleGroupCompleted(order.id, item.itemIds, item.allCompleted);
                          }
                        }}
                        className={`p-2 rounded-xl transition-all cursor-pointer select-none ${
                          item.allCompleted
                            ? 'opacity-40 bg-stone-200/50'
                            : 'bg-white hover:bg-stone-50 border border-[#EAE6E1]'
                        }`}
                        title="Toque no item para riscar (opcional)"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`text-sm font-black px-2 py-0.5 rounded-lg shrink-0 ${
                              item.allCompleted
                                ? 'bg-stone-300 text-stone-600 line-through'
                                : 'bg-[#C84E1F] text-white'
                            }`}
                          >
                            {item.totalQuantity}x
                          </span>
                          <span
                            className={`text-sm font-bold flex-1 leading-snug ${
                              item.allCompleted ? 'line-through text-stone-500' : 'text-[#191817]'
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>
                        {item.notes && (
                          <div className="mt-1.5 pl-8">
                            <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                              Obs: {item.notes}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Ação Rápida: Concluir Pedido e Chamar Salão */}
                  <button
                    type="button"
                    onClick={() => handleAdvanceStatus(order.id)}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-[#C84E1F]/20 active:scale-[0.98]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✓ Concluir Prato • Chamar Garçom</span>
                  </button>
                </div>
              );
            })}
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
              <div className="py-16 text-center text-[#57534E] text-xs">
                Nenhum prato na bancada de expedição.
              </div>
            )}

            {readyOrders.map((order) => {
              const grouped = groupOrderItems(order.items);

              return (
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
                    {grouped.map((item) => (
                      <div key={item.key} className="font-medium text-[#191817]">
                        <strong className="text-emerald-700 font-bold">{item.totalQuantity}x</strong> {item.name}
                        {item.notes && (
                          <p className="text-[11px] text-[#78716A] pl-5 mt-0.5 font-normal">
                            • {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="text-center py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                    Garçom sinalizado para retirada
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDismissOrder(order.id)}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    <span>✓ Entregue ao Garçom (Baixar)</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
