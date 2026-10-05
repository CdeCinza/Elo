'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { api, getApiErrorMessage, signOut } from '@/lib/api';
import { toast } from '@/components/ui/ToastProvider';
import {
  Clock,
  CheckCircle2,
  Flame,
  Volume2,
  VolumeX,
  ArrowRight,
  AlertTriangle,
  Check,
  LogOut,
} from 'lucide-react';

interface KitchenOrderItem {
  id: number;
  quantity: number;
  name: string;
  station: 'grill' | 'fryer' | 'dessert';
  notes?: string;
  completed?: boolean;
  status?: KitchenStage;
}

type KitchenStage = 'pending' | 'preparing' | 'ready';

const stageLabels: Record<KitchenStage, string> = {
  pending: 'Na fila',
  preparing: 'Em preparo',
  ready: 'Pronto',
};

interface GroupedKitchenItem {
  key: string;
  status: KitchenStage;
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
    const status = item.status ?? 'pending';
    const key = `${item.name}:::${item.notes || ''}:::${item.station}:::${status}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        status,
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

// Pedidos com mudança de status em andamento (bloqueia cliques repetidos antes do re-render)
const ordersInFlight = new Set<number>();

/**
 * Toca um aviso curto (dois bipes) usando WebAudio, sem depender de arquivos de áudio.
 */
const playNewOrderChime = (audioContext: AudioContext) => {
  [0, 0.18].forEach((offset) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + offset + 0.15);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(audioContext.currentTime + offset);
    oscillator.stop(audioContext.currentTime + offset + 0.16);
  });
};

export default function KitchenKdsPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'forbidden' | 'network' | null>(null);
  // Sem permissão não adianta insistir: o polling para até a próxima carga manual
  const accessDeniedRef = useRef(false);
  const [stationFilter, setStationFilter] = useState<'all' | 'grill' | 'fryer' | 'dessert'>('all');
  const [mobileStage, setMobileStage] = useState<KitchenStage>('pending');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [busyOrderIds, setBusyOrderIds] = useState<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);
  const knownOrderIdsRef = useRef<Set<number> | null>(null);
  // Cada mudança de status incrementa a versão; respostas de polling iniciadas antes dela são descartadas
  const mutationVersionRef = useRef(0);

  const handleToggleSound = () => {
    const nextEnabled = !soundEnabled;
    if (nextEnabled) {
      audioContextRef.current ??= new AudioContext();
      void audioContextRef.current.resume();
      playNewOrderChime(audioContextRef.current);
    }
    soundEnabledRef.current = nextEnabled;
    setSoundEnabled(nextEnabled);
  };

  const fetchOrders = useCallback(async (isSilent = false) => {
    const versionAtStart = mutationVersionRef.current;
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/kds/orders');
      if (versionAtStart !== mutationVersionRef.current) return;
      const incomingOrders: KitchenOrder[] = res.data.orders || [];
      accessDeniedRef.current = false;
      setLoadError(null);

      const incomingIds = new Set(incomingOrders.map((order) => order.id));
      const knownIds = knownOrderIdsRef.current;
      const hasNewOrder = knownIds !== null && incomingOrders.some((order) => !knownIds.has(order.id));
      knownOrderIdsRef.current = incomingIds;
      if (hasNewOrder && soundEnabledRef.current && audioContextRef.current) {
        playNewOrderChime(audioContextRef.current);
      }

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
      accessDeniedRef.current = isAxiosError(err) && err.response?.status === 403;
      setLoadError(isAxiosError(err) && err.response?.status === 403 ? 'forbidden' : 'network');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let pollInFlight = false;

    const pollOrders = () => {
      if (document.hidden || accessDeniedRef.current || pollInFlight) return;
      pollInFlight = true;
      void fetchOrders(true).finally(() => {
        pollInFlight = false;
      });
    };

    const initialFetch = setTimeout(() => {
      pollInFlight = true;
      void fetchOrders().finally(() => {
        pollInFlight = false;
      });
    }, 0);

    // Polling a cada 4 segundos para novos pedidos caírem na hora
    const interval = setInterval(pollOrders, 4000);

    const handleVisibilityChange = () => {
      pollOrders();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchOrders]);

  const runOrderMutation = async (
    orderId: number,
    fromStage: KitchenStage,
    status: 'preparing' | 'ready' | 'delivered',
    errorFallback: string,
    itemIds: number[]
  ) => {
    ordersInFlight.add(orderId);
    mutationVersionRef.current += 1;
    setBusyOrderIds((prev) => [...prev, orderId]);
    try {
      await api.patch(`/kds/orders/${orderId}/status`, { status, from: fromStage, item_ids: itemIds });
    } catch (err) {
      toast.error('Não foi possível atualizar o pedido', getApiErrorMessage(err, errorFallback));
    } finally {
      mutationVersionRef.current += 1;
      ordersInFlight.delete(orderId);
      setBusyOrderIds((prev) => prev.filter((id) => id !== orderId));
      void fetchOrders(true);
    }
  };

  // Avança apenas os pratos que estão na etapa do card clicado (rodadas diferentes seguem independentes)
  const handleAdvanceStatus = async (orderId: number, fromStage: 'pending' | 'preparing') => {
    if (ordersInFlight.has(orderId) || loadError) return;
    const itemIds = orders.find((order) => order.id === orderId)?.items
      .filter((item) => (item.status ?? 'pending') === fromStage && (stationFilter === 'all' || item.station === stationFilter))
      .map((item) => item.id) ?? [];
    if (itemIds.length === 0) return;
    const nextStatus: 'preparing' | 'ready' = fromStage === 'pending' ? 'preparing' : 'ready';

    setOrders((prev) =>
      prev.map((order) =>
        order.id !== orderId
          ? order
          : { ...order, items: order.items.map((item) => (itemIds.includes(item.id) ? { ...item, status: nextStatus } : item)) }
      )
    );

    await runOrderMutation(orderId, fromStage, nextStatus, 'Erro ao atualizar status do pedido.', itemIds);
  };

  const handleDismissOrder = async (orderId: number) => {
    if (ordersInFlight.has(orderId) || loadError) return;
    const targetOrder = orders.find((o) => o.id === orderId);
    const readyItemIds = new Set(
      (targetOrder?.items ?? []).filter((i) => (i.status ?? targetOrder?.status) === 'ready' && (stationFilter === 'all' || i.station === stationFilter)).map((i) => i.id)
    );
    if (typeof window !== 'undefined') {
      try {
        const saved: number[] = JSON.parse(localStorage.getItem('elo_kds_completed_items') || '[]');
        localStorage.setItem('elo_kds_completed_items', JSON.stringify(saved.filter((id) => !readyItemIds.has(id))));
      } catch {}
    }

    setOrders((prev) =>
      prev
        .map((order) => (order.id !== orderId ? order : { ...order, items: order.items.filter((item) => !readyItemIds.has(item.id)) }))
        .filter((order) => order.items.length > 0)
    );

    await runOrderMutation(orderId, 'ready', 'delivered', 'Erro ao dar baixa no pedido entregue.', [...readyItemIds]);
  };

  const handleToggleGroupCompleted = (orderId: number, itemIds: number[], currentAllCompleted: boolean) => {
    if (loadError) return;
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

  const filteredOrders = orders
    .map((order) => ({ ...order, items: order.items.filter((item) => stationFilter === 'all' || item.station === stationFilter) }))
    .filter((order) => order.items.length > 0);

  // Cada coluna mostra o pedido apenas com os pratos que estão naquela etapa
  const ordersAtStage = (stage: KitchenStage): KitchenOrder[] =>
    filteredOrders
      .map((order) => ({ ...order, status: stage, items: order.items.filter((item) => (item.status ?? order.status) === stage) }))
      .filter((order) => order.items.length > 0);

  const pendingOrders = ordersAtStage('pending');
  const preparingOrders = ordersAtStage('preparing');
  const readyOrders = ordersAtStage('ready');

  const dataUnavailable = loading || !!loadError;
  const delayedCount = orders.filter((o) => o.minutesAgo >= 20 && o.status !== 'ready').length;


  const allDayProductionSummary = (() => {
    const counts: { [name: string]: { name: string; quantity: number; station: string } } = {};

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.status === 'ready') return;
        if (stationFilter !== 'all' && item.station !== stationFilter) return;
        if (!counts[item.name]) {
          counts[item.name] = { name: item.name, quantity: 0, station: item.station };
        }
        counts[item.name].quantity += item.quantity;
      });
    });

    return Object.values(counts).sort((a, b) => b.quantity - a.quantity);
  })();

  const totalActiveItemsCount = allDayProductionSummary.reduce((acc, i) => acc + i.quantity, 0);

  const waitingOrders = orders.filter((o) => o.status !== 'ready');
  const averageWaitMinutes =
    waitingOrders.length > 0
      ? Math.round(waitingOrders.reduce((acc, o) => acc + o.minutesAgo, 0) / waitingOrders.length)
      : null;

  return (
    <div className="elo-interface min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col selection:bg-[#C84E1F] selection:text-white font-sans antialiased">
      {/* 1. Header do KDS */}
      <header className="min-h-20 px-4 sm:px-6 bg-white border-b border-[#EAE6E1] flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl font-bold tracking-tight text-[#191817]">ELO</span>
            <span className="hidden sm:inline text-base text-[#6E6760] border-l border-[#E0DBD3] pl-3">
              KDS • Linha de Produção & Cozinha
            </span>
          </Link>
        </div>

        {/* Métricas Operacionais Centrais */}
        <div className="hidden 2xl:flex items-center gap-6 text-base text-[#6E6760]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Fila ativa: <strong className="text-[#191817]">{dataUnavailable ? '—' : orders.length} comandas</strong></span>
          </div>
          <div className="h-3 w-[1px] bg-[#E0DBD3]" />
          <div>
            <span>
              Espera média:{' '}
              <strong className="text-[#191817]">{dataUnavailable || averageWaitMinutes === null ? '—' : `${averageWaitMinutes} min`}</strong>
            </span>
          </div>
          <div className="h-3 w-[1px] bg-[#E0DBD3]" />
          <div className="flex items-center gap-1.5">
            {dataUnavailable ? <span>Fila não sincronizada</span> : delayedCount > 0 ? (
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
            onClick={handleToggleSound}
            aria-pressed={soundEnabled}
            title={soundEnabled ? 'Silenciar aviso de novos pedidos' : 'Tocar um aviso quando chegar pedido novo'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] text-base text-[#57534E] hover:text-[#191817] hover:border-[#C84E1F] transition-colors cursor-pointer shadow-2xs"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Alerta sonoro ligado</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-[#6E6760]" />
                <span>Ativar alerta sonoro</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              void signOut().then(() => router.push('/login'));
            }}
            title="Sair do sistema"
            aria-label="Sair do sistema"
            className="p-1.5 rounded-lg bg-white border border-[#E0DBD3] hover:text-rose-600 text-[#6E6760] transition-colors shadow-2xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. Barra de Filtros por Praça da Cozinha */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-[#EAE6E1] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto bg-[#FAF8F5] p-1 rounded-xl border border-[#EAE6E1]">
          <span className="text-base text-[#6E6760] px-2 font-medium hidden sm:inline">Praças:</span>
          <button
            onClick={() => setStationFilter('all')}
            aria-pressed={stationFilter === 'all'}
            className={`shrink-0 px-3 py-2.5 rounded-lg text-base font-medium whitespace-nowrap transition-colors cursor-pointer ${
              stationFilter === 'all'
                ? 'bg-white text-[#191817] shadow-xs font-semibold'
                : 'text-[#6E6760] hover:text-[#191817]'
            }`}
          >
            Todas ({orders.length})
          </button>
          <button
            onClick={() => setStationFilter('grill')}
            aria-pressed={stationFilter === 'grill'}
            className={`shrink-0 px-3 py-2.5 rounded-lg text-base font-medium whitespace-nowrap transition-colors cursor-pointer ${
              stationFilter === 'grill'
                ? 'bg-[#C84E1F] text-white shadow-xs font-semibold'
                : 'text-[#6E6760] hover:text-[#191817]'
            }`}
          >
            Chapa & Grelha
          </button>
          <button
            onClick={() => setStationFilter('fryer')}
            aria-pressed={stationFilter === 'fryer'}
            className={`shrink-0 px-3 py-2.5 rounded-lg text-base font-medium whitespace-nowrap transition-colors cursor-pointer ${
              stationFilter === 'fryer'
                ? 'bg-[#C84E1F] text-white shadow-xs font-semibold'
                : 'text-[#6E6760] hover:text-[#191817]'
            }`}
          >
            Frituras & Entradas
          </button>
          <button
            onClick={() => setStationFilter('dessert')}
            aria-pressed={stationFilter === 'dessert'}
            className={`shrink-0 px-3 py-2.5 rounded-lg text-base font-medium whitespace-nowrap transition-colors cursor-pointer ${
              stationFilter === 'dessert'
                ? 'bg-[#C84E1F] text-white shadow-xs font-semibold'
                : 'text-[#6E6760] hover:text-[#191817]'
            }`}
          >
            Sobremesas
          </button>
        </div>

        <div className="text-base text-[#6E6760] hidden sm:block">
          Toque no prato para dar baixa em lote • Avanço com 1 clique
        </div>
      </div>

      {/* 2.1 Régua Global de Produção ("All-Day Count" / Linha de Fogo) */}
      <div className="px-6 py-2.5 bg-[#FAF8F5] border-b border-[#EAE6E1] flex flex-col sm:flex-row items-start sm:items-center gap-3 overflow-x-auto text-base shrink-0">
        <div className="flex items-center gap-1.5 font-bold text-[#191817] shrink-0">
          <Flame className="w-4 h-4 text-[#9E3712]" />
          <span>Linha de fogo ({dataUnavailable ? '—' : totalActiveItemsCount} {totalActiveItemsCount === 1 ? 'item' : 'itens'} no salão):</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          {allDayProductionSummary.length === 0 ? (
            <span className="text-[#6E6760] italic text-base">{dataUnavailable ? 'Produção não sincronizada.' : 'Nenhuma produção pendente no momento.'}</span>
          ) : (
            allDayProductionSummary.map((item) => (
              <span
                key={item.name}
                className="inline-flex items-center gap-1.5 px-2.5 py-2.5 rounded-lg bg-white border border-[#E0DBD3] shadow-2xs font-medium text-[#191817] whitespace-nowrap"
              >
                <span className="font-bold text-[#9E3712]">{item.quantity}x</span>
                <span>{item.name}</span>
              </span>
            ))
          )}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mx-6 mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <p className="text-base font-bold text-amber-900">
                {loadError === 'forbidden' ? 'Seu perfil não acessa a cozinha' : 'Sem conexão com o servidor'}
              </p>
              <p className="text-sm text-amber-800">
                {loadError === 'forbidden'
                  ? 'O painel da cozinha é usado pela gerência e pelos cozinheiros.'
                  : orders.length > 0
                  ? 'Exibindo os últimos pedidos carregados. Tentando novamente...'
                  : 'Tentando reconectar automaticamente...'}
              </p>
            </div>
          </div>
          {loadError === 'forbidden' && (
            <Link href="/counter" className="text-base text-[#9E3712] hover:underline font-semibold shrink-0">
              Ir para o caixa
            </Link>
          )}
        </div>
      )}

      {/* 3. Banner Informativo de Fila Limpa */}
      {!loadError && !loading && orders.length === 0 && (
        <div className="mx-6 mt-4 p-4 rounded-2xl bg-white border border-[#EAE6E1] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-base font-bold text-[#191817]">Fila de produção em dia (0 pedidos)</p>
              <p className="text-sm text-[#6E6760]">
                A cozinha está aguardando novos pedidos. Ao enviar um pedido pelo tablet ou salão, ele aparecerá aqui instantaneamente.
              </p>
            </div>
          </div>
        </div>
      )}

      <nav aria-label="Etapas da cozinha" className="md:hidden flex gap-2 px-4 pt-4">
        {(['pending', 'preparing', 'ready'] as KitchenStage[]).map((stage) => (
          <button key={stage} type="button" aria-pressed={mobileStage === stage} onClick={() => setMobileStage(stage)}
            className={`flex-1 rounded-xl border px-2 py-3 font-semibold ${mobileStage === stage ? 'bg-[#191817] text-white border-[#191817]' : 'bg-white border-[#E0DBD3]'}`}>
            {stageLabels[stage]} ({dataUnavailable ? '—' : ordersAtStage(stage).length})
          </button>
        ))}
      </nav>
      {/* 4. Colunas Kanban Densas e Estruturadas */}
      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-5 overflow-y-auto">
        {/* Coluna 1: Fila de Entrada */}
        <div className={`bg-white rounded-2xl border border-[#EAE6E1] p-4 flex-col min-h-[300px] md:min-h-[500px] shadow-xs ${mobileStage === 'pending' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#EAE6E1] shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-sm font-semibold text-[#191817]">Fila de entrada</h2>
            </div>
            <span className="text-base font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              {dataUnavailable ? '—' : pendingOrders.length} aguardando
            </span>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto">
            {pendingOrders.length === 0 && (
              <div className="py-16 text-center text-[#57534E] text-base">
                {dataUnavailable ? 'Não foi possível confirmar os pedidos desta etapa.' : 'Nenhum pedido pendente nesta praça.'}
              </div>
            )}

            {pendingOrders.map((order) => {
              const grouped = groupOrderItems(order.items);
              const allChecked = order.items.length > 0 && order.items.every((i) => i.completed);

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD3] space-y-3 shadow-2xs hover:border-[#C84E1F] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-base font-bold text-[#191817]">Mesa {order.tableNumber}</span>
                      <span className="text-sm text-[#6E6760] ml-2">#{order.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleGroupCompleted(order.id, order.items.map((i) => i.id), allChecked)}
                        className="text-sm text-[#6E6760] hover:text-[#9E3712] font-medium underline transition-colors cursor-pointer"
                        title="Marcar ou desmarcar todos os itens deste pedido"
                      >
                        {allChecked ? 'Desmarcar todos' : 'Marcar todos'}
                      </button>
                      <span
                        className={`text-base font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          order.minutesAgo >= 15
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {order.minutesAgo} min
                      </span>
                    </div>
                  </div>

                  {/* Lista de Itens Consolidados */}
                  <div className="space-y-2 border-t border-[#E0DBD3] pt-2.5 text-base">
                    {grouped.map((item) => (
                      <div
                        key={item.key}
                        onClick={() => handleToggleGroupCompleted(order.id, item.itemIds, item.allCompleted)}
                        role="checkbox"
                        aria-checked={item.allCompleted}
                        aria-disabled={!!loadError}
                        tabIndex={loadError ? -1 : 0}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            handleToggleGroupCompleted(order.id, item.itemIds, item.allCompleted);
                          }
                        }}
                        className="cursor-pointer group select-none min-h-11 py-2 rounded-lg focus-visible:outline-2 focus-visible:outline-[#191817]"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                              item.allCompleted
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-[#D4CEC5] bg-white group-hover:border-[#C84E1F]'
                            }`}
                          >
                            {item.allCompleted && <Check className="w-3 h-3" />}
                          </div>
                          <span className={`font-medium ${item.allCompleted ? 'line-through text-[#6E6760]' : 'text-[#191817]'}`}>
                            <strong className={item.allCompleted ? 'text-[#6E6760]' : 'text-[#9E3712] font-bold'}>
                              {item.totalQuantity}x
                            </strong>{' '}
                            {item.name}
                          </span>
                          {item.status !== order.status && (
                            <span className="text-sm font-semibold px-1.5 py-0.5 rounded bg-white border border-[#E0DBD3] text-[#57534E]">
                              {stageLabels[item.status]}
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-sm text-[#9E3712] pl-6 mt-0.5 font-medium">
                            • {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleAdvanceStatus(order.id, 'pending')}
                    disabled={busyOrderIds.includes(order.id) || !!loadError}
                    className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-[#C84E1F] border border-[#E0DBD3] hover:border-[#C84E1F] text-[#191817] hover:text-white font-medium text-base flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-wait"
                  >
                    <span>Iniciar preparo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna 2: Em Preparo */}
        <div className={`bg-white rounded-2xl border border-[#EAE6E1] p-4 flex-col min-h-[300px] md:min-h-[500px] shadow-xs ${mobileStage === 'preparing' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#EAE6E1] shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C84E1F] animate-pulse" />
              <h2 className="text-sm font-semibold text-[#191817]">Em preparo</h2>
            </div>
            <span className="text-base font-medium px-2 py-0.5 rounded-full bg-[#C84E1F]/15 text-[#9E3712] border border-[#C84E1F]/25 font-semibold">
              {dataUnavailable ? '—' : preparingOrders.length} no fogo
            </span>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto">
            {preparingOrders.length === 0 && (
              <div className="py-16 text-center text-[#57534E] text-base">
                {dataUnavailable ? 'Não foi possível confirmar os pedidos desta etapa.' : 'Nenhum pedido sendo preparado no momento.'}
              </div>
            )}

            {preparingOrders.map((order) => {
              const grouped = groupOrderItems(order.items);
              const allChecked = order.items.length > 0 && order.items.every((i) => i.completed);

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#C84E1F]/30 space-y-3 shadow-2xs hover:border-[#C84E1F] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-base font-bold text-[#191817]">Mesa {order.tableNumber}</span>
                      <span className="text-sm text-[#6E6760] ml-2">#{order.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleGroupCompleted(order.id, order.items.map((i) => i.id), allChecked)}
                        className="text-sm text-[#6E6760] hover:text-[#9E3712] font-medium underline transition-colors cursor-pointer"
                        title="Marcar ou desmarcar todos os itens deste pedido"
                      >
                        {allChecked ? 'Desmarcar todos' : 'Marcar todos'}
                      </button>
                      <span
                        className={`text-base font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          order.minutesAgo >= 20
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold'
                            : 'bg-[#C84E1F]/15 text-[#9E3712]'
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5" />
                        {order.minutesAgo} min
                      </span>
                    </div>
                  </div>

                  {/* Lista de Itens Consolidados */}
                  <div className="space-y-2 border-t border-[#E0DBD3] pt-2.5 text-base">
                    {grouped.map((item) => (
                      <div
                        key={item.key}
                        onClick={() => handleToggleGroupCompleted(order.id, item.itemIds, item.allCompleted)}
                        role="checkbox"
                        aria-checked={item.allCompleted}
                        aria-disabled={!!loadError}
                        tabIndex={loadError ? -1 : 0}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            handleToggleGroupCompleted(order.id, item.itemIds, item.allCompleted);
                          }
                        }}
                        className="cursor-pointer group select-none min-h-11 py-2 rounded-lg focus-visible:outline-2 focus-visible:outline-[#191817]"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                              item.allCompleted
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-[#D4CEC5] bg-white group-hover:border-[#C84E1F]'
                            }`}
                          >
                            {item.allCompleted && <Check className="w-3 h-3" />}
                          </div>
                          <span className={`font-medium ${item.allCompleted ? 'line-through text-[#6E6760]' : 'text-[#191817]'}`}>
                            <strong className={item.allCompleted ? 'text-[#6E6760]' : 'text-[#9E3712] font-bold'}>
                              {item.totalQuantity}x
                            </strong>{' '}
                            {item.name}
                          </span>
                          {item.status !== order.status && (
                            <span className="text-sm font-semibold px-1.5 py-0.5 rounded bg-white border border-[#E0DBD3] text-[#57534E]">
                              {stageLabels[item.status]}
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-sm text-[#9E3712] pl-6 mt-0.5 font-medium">
                            • {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleAdvanceStatus(order.id, 'preparing')}
                    disabled={busyOrderIds.includes(order.id) || !!loadError}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-base flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-wait"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Concluir prato e chamar garçom</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna 3: Pronto para Entrega */}
        <div className={`bg-white rounded-2xl border border-[#EAE6E1] p-4 flex-col min-h-[300px] md:min-h-[500px] shadow-xs ${mobileStage === 'ready' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#EAE6E1] shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h2 className="text-sm font-semibold text-[#191817]">Pronto para servir</h2>
            </div>
            <span className="text-base font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {dataUnavailable ? '—' : readyOrders.length} na bancada
            </span>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto">
            {readyOrders.length === 0 && (
              <div className="py-16 text-center text-[#57534E] text-base">
                {dataUnavailable ? 'Não foi possível confirmar os pedidos desta etapa.' : 'Nenhum prato na bancada de expedição.'}
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
                      <span className="text-sm text-[#6E6760] ml-2">#{order.id}</span>
                    </div>
                    <span className="text-base text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Bancada pronta
                    </span>
                  </div>

                  <div className="space-y-1.5 border-t border-[#E0DBD3] pt-2.5 text-base">
                    {grouped.map((item) => (
                      <div key={item.key} className="font-medium text-[#191817]">
                        <strong className="text-emerald-700 font-bold">{item.totalQuantity}x</strong> {item.name}
                        {item.notes && (
                          <p className="text-sm text-[#6E6760] pl-5 mt-0.5 font-normal">
                            • {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="text-center py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-base font-medium">
                    Aguardando retirada pelo garçom
                  </div>

                  <button
                    onClick={() => handleDismissOrder(order.id)}
                    disabled={busyOrderIds.includes(order.id) || !!loadError}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-[#E0DBD3] hover:bg-stone-50 text-[#57534E] hover:text-[#191817] text-base font-medium transition-colors cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-wait"
                  >
                    Entregue ao salão (baixar)
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
