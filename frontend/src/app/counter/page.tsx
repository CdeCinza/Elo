'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { api, getApiErrorMessage, signOut } from '@/lib/api';
import { toast } from '@/components/ui/ToastProvider';
import { formatBRL } from '@/lib/format';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { getAuthUser, getActiveRestaurant, User, Restaurant } from '@/lib/auth';
import {
  LayoutGrid,
  Users,
  AlertCircle,
  Plus,
  CreditCard,
  Search,
  Printer,
  ChefHat,
  Bell,
  X,
  Trash2,
  Edit3,
  RefreshCw,
  Smartphone,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Store,
  LogOut,
  BookOpen,
} from 'lucide-react';
import { StripePaymentModal, isStripeConfigured } from '@/components/payment/StripePaymentModal';

interface OrderLineItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  subtotal?: number;
  status: string;
  notes?: string;
}

interface TableData {
  id: number;
  number: string;
  raw_number?: string;
  capacity?: number;
  status: 'free' | 'occupied' | 'bill_requested';
  waiter_called?: boolean;
  waiter?: string;
  opened_at?: string;
  total?: number;
  subtotal?: number;
  items_count?: number;
  items?: OrderLineItem[];
}

interface ProductItem {
  id: number;
  name: string;
  price: number;
  description?: string;
}

const runningCounterActions = new Set<string>();
// Sem permissão não adianta insistir: o polling para até a próxima carga manual
const posAccess = { denied: false };

/**
 * Impede que cliques repetidos disparem a mesma ação (ex.: lançar item duas vezes) antes do re-render.
 */
const withActionLock = <Args extends unknown[]>(actionKey: string, action: (...args: Args) => Promise<void>) =>
  async (...args: Args): Promise<void> => {
    if (runningCounterActions.has(actionKey)) return;
    runningCounterActions.add(actionKey);
    try {
      await action(...args);
    } finally {
      runningCounterActions.delete(actionKey);
    }
  };

const tableStatusLabels: Record<string, string> = {
  free: 'livre',
  occupied: 'ocupada',
  bill_requested: 'pedindo conta',
  reserved: 'reservada',
};

export default function PosCounterPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const router = useRouter();
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const detailsPanelRef = useRef<HTMLElement>(null);

  // Abaixo de lg o painel de detalhes fica sob o mapa de mesas: rola até ele para dar retorno imediato
  const handleSelectTable = (table: TableData) => {
    setSelectedTable(table);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => detailsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'occupied' | 'bill_requested' | 'free'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeService, setIncludeService] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix' | 'cash'>(isStripeConfigured ? 'credit_card' : 'pix');
  const [isClosing, setIsClosing] = useState(false);



  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loadError, setLoadError] = useState<'forbidden' | 'network' | null>(null);
  const roleName = authUser?.is_super_admin ? 'super_admin' : authUser?.role?.name ?? '';
  const canManageTables = ['owner', 'restaurant_admin', 'manager', 'super_admin'].includes(roleName);
  const canAccessKitchen = ['owner', 'restaurant_admin', 'manager', 'chef', 'super_admin'].includes(roleName);
  const [activeRestaurant, setActiveRestaurantState] = useState<Restaurant | null>(null);

  // Modal para criar nova mesa
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(4);
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal para editar mesa existente
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTableNumber, setEditingTableNumber] = useState('');
  const [editingTableCapacity, setEditingTableCapacity] = useState(4);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal para lançar prato na comanda
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [addItemQuantity, setAddItemQuantity] = useState(1);
  const [addItemNotes, setAddItemNotes] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [showStripeModal, setShowStripeModal] = useState(false);

  // Modal customizado de confirmação
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // Esc fecha o modal aberto mais recente (confirmação > lançamento > edição > criação)
  useEscapeKey(!!confirmModal || showAddModal || showEditModal || showCreateModal, () => {
    if (confirmModal) setConfirmModal(null);
    else if (showAddModal) setShowAddModal(false);
    else if (showEditModal) setShowEditModal(false);
    else setShowCreateModal(false);
  });

  // Determina turno dinamicamente de acordo com horário local
  const currentShift = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'Café da Manhã (06h - 12h)';
    if (hour >= 12 && hour < 16) return 'Almoço Executivo (12h - 16h)';
    if (hour >= 16 && hour < 19) return 'Happy Hour & Café (16h - 19h)';
    if (hour >= 19 && hour <= 23) return 'Jantar (19h - 23h59)';
    return 'Madrugada (00h - 06h)';
  }, []);

  // Busca mesas do backend
  const fetchTables = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/pos/tables');
      const loadedTables: TableData[] = res.data.tables || [];
      setTables(loadedTables);
      posAccess.denied = false;
      setLoadError(null);

      // Sincroniza mesa selecionada
      setSelectedTable((prev) => {
        if (!prev) return null;
        return loadedTables.find((t) => t.id === prev.id) || null;
      });
    } catch (err) {
      console.error('Erro ao buscar mesas do POS:', err);
      posAccess.denied = isAxiosError(err) && err.response?.status === 403;
      setLoadError(isAxiosError(err) && err.response?.status === 403 ? 'forbidden' : 'network');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Busca cardápio para lançamento manual
  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/products', { params: { per_page: 200, available: 1 } });
      setProducts(res.data.data || []);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    }
  }, []);

  useEffect(() => {
    let pollInFlight = false;

    const pollTables = () => {
      if (document.hidden || posAccess.denied || pollInFlight) return;
      pollInFlight = true;
      void fetchTables(true).finally(() => {
        pollInFlight = false;
      });
    };

    const initialLoad = setTimeout(() => {
      const user = getAuthUser();
      const rest = getActiveRestaurant();
      if (user) {
        setAuthUser(user);

      }
      if (rest) {
        setActiveRestaurantState(rest);
      }

      pollInFlight = true;
      void fetchTables().finally(() => {
        pollInFlight = false;
      });
      void fetchProducts();
    }, 0);

    // Polling a cada 3,5 segundos
    const interval = setInterval(pollTables, 3500);

    const handleVisibilityChange = () => {
      pollTables();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchTables, fetchProducts]);

  // Abertura manual de mesa
  const handleOpenTable = withActionLock('handleOpenTable', async (tableNumber: string) => {
    try {
      await api.post(`/pos/tables/${tableNumber}/open`);
      toast.success(`Mesa ${tableNumber} aberta com sucesso.`);
      await fetchTables(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao abrir mesa.'));
    }
  });

  // Fechamento e baixa no caixa
  const performCloseTable = withActionLock('performCloseTable', async (tableNumber: string) => {
    if (paymentMethod === 'credit_card') {
      setShowStripeModal(true);
      return;
    }

    setIsClosing(true);
    try {
      await api.post(`/pos/tables/${tableNumber}/close`, {
        payment_method: paymentMethod,
        include_service: includeService,
      });
      toast.success(`Mesa ${tableNumber} finalizada com sucesso! Baixa realizada.`);
      setSelectedTable(null);
      await fetchTables(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao fechar mesa.'));
    } finally {
      setIsClosing(false);
    }
  });

  // Avisa antes de fechar uma conta com pratos que a cozinha ainda não entregou
  const handleCloseTable = (tableNumber: string) => {
    const itemsInKitchen = (selectedTable?.items ?? []).filter((item) => item.status !== 'delivered').length;
    if (itemsInKitchen === 0) {
      void performCloseTable(tableNumber);
      return;
    }

    setConfirmModal({
      title: 'Ainda há pratos na cozinha',
      message: `${itemsInKitchen} ${itemsInKitchen === 1 ? 'item ainda não foi entregue' : 'itens ainda não foram entregues'} na Mesa ${tableNumber}. Ao fechar a conta, eles saem da fila da cozinha. Deseja fechar mesmo assim?`,
      confirmText: 'Fechar conta mesmo assim',
      isDestructive: true,
      onConfirm: () => performCloseTable(tableNumber),
    });
  };

  const isMounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  // Abrir modal de criação de mesa sugerindo o próximo número
  const handleOpenCreateModal = () => {
    setCreateError(null);
    try {
      const existingNumbers = (tables || [])
        .map((t) => {
          if (!t) return NaN;
          const val = String(t.number ?? t.raw_number ?? '');
          const cleaned = val.replace(/\D/g, '');
          return cleaned ? parseInt(cleaned, 10) : NaN;
        })
        .filter((n) => !isNaN(n) && isFinite(n));

      const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      const nextFormatted = String(maxNumber + 1).padStart(2, '0');
      setNewTableNumber(nextFormatted);
      setNewTableCapacity(4);
    } catch (err) {
      console.error('Erro ao calcular numeração da próxima mesa:', err);
      setNewTableNumber('');
      setNewTableCapacity(4);
    } finally {
      setShowCreateModal(true);
    }
  };

  // Criar nova mesa no banco de dados
  const handleCreateTable = withActionLock('handleCreateTable', async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const trimmedNumber = newTableNumber.trim();
    if (!trimmedNumber) {
      setCreateError('Por favor, informe a numeração ou identificação da mesa.');
      return;
    }

    setIsCreatingTable(true);
    try {
      const res = await api.post('/pos/tables', {
        number: trimmedNumber,
        capacity: newTableCapacity,
      });
      toast.success(res.data?.message || `Mesa ${trimmedNumber} criada com sucesso!`);
      setShowCreateModal(false);
      await fetchTables(true);
      if (res.data?.table) {
        setSelectedTable(res.data.table);
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Erro ao cadastrar nova mesa. Verifique a conexão com o servidor.');
      setCreateError(msg);
      toast.error(msg);
    } finally {
      setIsCreatingTable(false);
    }
  });

  // Abrir modal para editar capacidade/número da mesa
  const handleOpenEditModal = (table: TableData) => {
    setSelectedTable(table);
    setEditingTableNumber(table.number);
    setEditingTableCapacity(table.capacity || 4);
    setShowEditModal(true);
  };

  // Salvar edição da mesa
  const handleSaveEditTable = withActionLock('handleSaveEditTable', async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;

    setIsSavingEdit(true);
    try {
      await api.put(`/pos/tables/${selectedTable.number}`, {
        number: editingTableNumber.trim(),
        capacity: editingTableCapacity,
      });
      toast.success('Mesa atualizada com sucesso!');
      setShowEditModal(false);
      await fetchTables(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao atualizar dados da mesa.'));
    } finally {
      setIsSavingEdit(false);
    }
  });

  // Excluir mesa (apenas se estiver livre)
  const handleDeleteTable = (table: TableData) => {
    setConfirmModal({
      title: 'Excluir Mesa',
      message: `Tem certeza que deseja excluir a Mesa ${table.number} do salão? Esta ação não poderá ser desfeita.`,
      confirmText: 'Sim, excluir mesa',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api.delete(`/pos/tables/${table.number}`);
          toast.success(`Mesa ${table.number} excluída com sucesso.`);
          if (selectedTable?.id === table.id) {
            setSelectedTable(null);
          }
          await fetchTables(true);
        } catch (err) {
          toast.error(getApiErrorMessage(err, 'Erro ao excluir mesa.'));
        }
      },
    });
  };

  // Atender / silenciar chamado de garçom
  const handleClearWaiterCall = withActionLock('handleClearWaiterCall', async (tableNumber: string) => {
    try {
      await api.post(`/pos/tables/${tableNumber}/clear-waiter`);
      toast.info(`Chamado da Mesa ${tableNumber} atendido.`);
      await fetchTables(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao atender chamado.'));
    }
  });

  // Forçar liberação / limpeza de mesa
  const handleResetTable = (tableNumber: string) => {
    setConfirmModal({
      title: 'Liberar e Limpar Mesa',
      message: `Deseja forçar a liberação da Mesa ${tableNumber}? Os pedidos ativos serão cancelados e o status voltará para livre.`,
      confirmText: 'Sim, liberar mesa',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api.post(`/pos/tables/${tableNumber}/reset`);
          toast.success(`Mesa ${tableNumber} liberada com sucesso.`);
          await fetchTables(true);
        } catch (err) {
          toast.error(getApiErrorMessage(err, 'Erro ao liberar mesa.'));
        }
      },
    });
  };

  // Gerar mesas padrão (01 a 10) caso o banco esteja vazio
  const handleSeedDefaults = withActionLock('handleSeedDefaults', async () => {
    try {
      await api.post('/pos/tables/seed-defaults');
      toast.success('Mesas 01 a 10 geradas com sucesso!');
      await fetchTables();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao gerar mesas padrão.'));
    }
  });

  // Lançar item na comanda ativa
  const handleAddItemToComanda = withActionLock('handleAddItemToComanda', async () => {
    if (!selectedTable || !selectedProductId) return;
    setIsAddingItem(true);
    try {
      await api.post(`/pos/tables/${selectedTable.number}/items`, {
        product_id: selectedProductId,
        quantity: addItemQuantity,
        notes: addItemNotes || undefined,
      });
      toast.success('Item lançado na comanda com sucesso!');
      setShowAddModal(false);
      setSelectedProductId(null);
      setAddItemQuantity(1);
      setAddItemNotes('');
      await fetchTables(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao adicionar item.'));
    } finally {
      setIsAddingItem(false);
    }
  });

  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const billCount = tables.filter((t) => t.status === 'bill_requested').length;
  const freeCount = tables.filter((t) => t.status === 'free').length;
  const totalOpenRevenue = tables.reduce((acc, t) => acc + (t.total || 0), 0);

  const filteredTables = tables.filter((t) => {
    if (filter === 'occupied' && t.status !== 'occupied') return false;
    if (filter === 'bill_requested' && t.status !== 'bill_requested') return false;
    if (filter === 'free' && t.status !== 'free') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = t.number.toLowerCase().includes(q) || (t.raw_number && t.raw_number.toLowerCase().includes(q));
      const matchWaiter = t.waiter && t.waiter.toLowerCase().includes(q);
      if (!matchNumber && !matchWaiter) return false;
    }
    return true;
  });

  const subtotal = selectedTable?.subtotal ?? selectedTable?.total ?? 0;
  const orderTotal = selectedTable?.total ?? subtotal;
  const adjustment = Math.round((orderTotal - subtotal) * 100) / 100;
  const serviceFee = includeService ? Math.round(subtotal * 10) / 100 : 0;
  const grandTotal = Math.max(Math.round((orderTotal + serviceFee) * 100) / 100, 0);

  return (
    <>
    <div className="print:hidden min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col selection:bg-[#C84E1F] selection:text-white font-sans antialiased">
      {/* 1. Header do Balcão */}
      <header className="h-16 px-4 sm:px-6 gap-2 bg-white border-b border-[#EAE6E1] flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl font-bold tracking-tight text-[#191817]">ELO</span>
            <span className="hidden sm:inline text-xs text-[#78716A] border-l border-[#E0DBD3] pl-3">
              Frente de Caixa & Salão
            </span>
          </Link>

          {canAccessKitchen && (
          <Link
            href="/kitchen"
            target="_blank"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#57534E] hover:text-[#191817] hover:border-[#C84E1F] transition-colors"
          >
            <ChefHat className="w-3.5 h-3.5 text-[#C84E1F]" />
            <span>KDS Cozinha</span>
          </Link>
          )}

          {canManageTables && (
          <Link
            href="/menu"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#57534E] hover:text-[#191817] hover:border-[#C84E1F] transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#C84E1F]" />
            <span>Cardápio</span>
          </Link>
          )}

          {/* Badge do Restaurante Ativo */}
          {activeRestaurant && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
              <Store className="w-3.5 h-3.5 text-amber-700" />
              <span>{activeRestaurant.name}</span>
            </div>
          )}

          {/* Link para Super Admin se aplicável */}
          {authUser?.is_super_admin && (
            <Link
              href="/superadmin"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-xs text-stone-700 hover:bg-stone-200 font-medium transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-stone-600" />
              <span>Super Admin</span>
            </Link>
          )}
        </div>

        {/* Métricas Resumidas no Topo */}
        <div className="hidden lg:flex items-center gap-6 text-xs text-[#78716A]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>
              Salão:{' '}
              <strong className="text-[#191817]">
                {occupiedCount + billCount}/{tables.length} ocupadas
              </strong>
            </span>
          </div>
          <div className="h-3 w-[1px] bg-[#E0DBD3]" />
          <div>
            <span>
              Total aberto:{' '}
              <strong className="text-[#C84E1F] font-semibold">
                {formatBRL(totalOpenRevenue)}
              </strong>
            </span>
          </div>
          <div className="h-3 w-[1px] bg-[#E0DBD3]" />
          <div>
            <span>
              Turno: <strong className="text-[#191817]">{isMounted ? currentShift : '---'}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Operador logado */}
          <div
            title="Usuário logado neste caixa"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] text-xs shadow-2xs max-w-[220px]"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
            <span className="text-[#78716A]">Operador:</span>
            <span className="font-medium text-[#191817] truncate">{authUser?.name ?? '—'}</span>
          </div>

          <button
            onClick={() => fetchTables(false)}
            title="Atualizar mesas agora"
            aria-label="Atualizar mesas agora"
            className="p-1.5 rounded-lg bg-white border border-[#E0DBD3] hover:text-[#191817] text-[#78716A] transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C84E1F]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              void signOut().then(() => router.push('/login'));
            }}
            title="Sair do sistema"
            aria-label="Sair do sistema"
            className="p-1.5 rounded-lg bg-white border border-[#E0DBD3] hover:text-rose-600 text-[#78716A] transition-colors shadow-2xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. Barra de Métricas em Cards + Filtros e Ações */}
      <div className="px-6 py-4 bg-white border-b border-[#EAE6E1] shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1]">
            <span className="text-[11px] text-[#78716A] font-medium">Mesas ocupadas</span>
            <p className="text-xl font-bold text-[#191817] mt-0.5">
              {occupiedCount}{' '}
              <span className="text-xs text-[#78716A] font-normal">mesas</span>
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
            <span className="text-[11px] text-amber-800 font-medium">Pedindo conta</span>
            <p className="text-xl font-bold text-amber-900 mt-0.5">
              {billCount}{' '}
              <span className="text-xs text-amber-700 font-normal">urgente</span>
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[11px] text-emerald-800 font-medium">Mesas livres</span>
            <p className="text-xl font-bold text-emerald-900 mt-0.5">
              {freeCount}{' '}
              <span className="text-xs text-emerald-700 font-normal">disponíveis</span>
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#C84E1F]/5 border border-[#C84E1F]/20">
            <span className="text-[11px] text-[#9E3712] font-semibold">Total em aberto no salão</span>
            <p className="text-xl font-bold text-[#9E3712] mt-0.5">
              {formatBRL(totalOpenRevenue)}
            </p>
          </div>
        </div>

        {/* Filtros de Mesa e Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 bg-[#FAF8F5] p-1 rounded-xl border border-[#EAE6E1]">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-[#191817] shadow-xs font-semibold'
                  : 'text-[#78716A] hover:text-[#191817]'
              }`}
            >
              Todas ({tables.length})
            </button>
            <button
              onClick={() => setFilter('occupied')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === 'occupied'
                  ? 'bg-[#C84E1F] text-white shadow-xs font-semibold'
                  : 'text-[#78716A] hover:text-[#191817]'
              }`}
            >
              Ocupadas ({occupiedCount})
            </button>
            <button
              onClick={() => setFilter('bill_requested')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === 'bill_requested'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                  : 'text-[#78716A] hover:text-amber-800'
              }`}
            >
              Pedindo conta ({billCount})
            </button>
            <button
              onClick={() => setFilter('free')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === 'free'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'text-[#78716A] hover:text-emerald-800'
              }`}
            >
              Livres ({freeCount})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A199]" />
              <input
                type="text"
                maxLength={40}
                placeholder="Buscar mesa ou garçom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.slice(0, 40))}
                className="w-full bg-[#FAF8F5] border border-[#E0DBD3] rounded-xl pl-9 pr-7 py-1.5 text-xs text-[#191817] placeholder-[#A8A199] focus:outline-none focus:border-[#C84E1F] focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A8A199] hover:text-[#191817] p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Botão Real de Criar Mesa */}
{canManageTables && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-3.5 py-1.5 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors shrink-0 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Nova mesa</span>
            </button>
)}
          </div>
        </div>
      </div>

      {/* 3. Grid Principal: Salão à Esquerda + Comanda / Gestão da Mesa à Direita */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Lado Esquerdo: Grid Rico de Mesas */}
        <section className="flex-1 p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-[#EAE6E1]">
          {loadError && tables.length > 0 && (
            <div role="status" className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Conexão instável: exibindo os últimos dados carregados. Tentando novamente...</span>
            </div>
          )}

          {loadError && tables.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-white border border-[#EAE6E1] flex items-center justify-center mb-4 shadow-xs">
                <AlertTriangle className="w-8 h-8 text-[#C84E1F]" />
              </div>
              <h3 className="text-base font-semibold text-[#191817] mb-1">
                {loadError === 'forbidden' ? 'Seu perfil não acessa o caixa' : 'Não foi possível carregar o salão'}
              </h3>
              <p className="text-xs text-[#78716A] mb-6">
                {loadError === 'forbidden'
                  ? 'Esta tela é usada por gerência, garçons e caixa. Entre com outra conta ou vá para a sua área.'
                  : 'Verifique a conexão com o servidor e tente novamente.'}
              </p>
              <div className="flex items-center gap-3">
                {loadError === 'forbidden' && canAccessKitchen && (
                  <Link href="/kitchen" className="px-4 py-2 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold">
                    Ir para a cozinha
                  </Link>
                )}
                {loadError === 'network' && (
                  <button
                    type="button"
                    onClick={() => void fetchTables(false)}
                    className="px-4 py-2 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold cursor-pointer"
                  >
                    Tentar novamente
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Caso não haja mesas cadastradas */}
          {!loadError && tables.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-white border border-[#EAE6E1] flex items-center justify-center text-[#A8A199] mb-4 shadow-xs">
                <LayoutGrid className="w-8 h-8 text-[#C84E1F]" />
              </div>
              <h3 className="text-base font-semibold text-[#191817] mb-1">
                Nenhuma mesa cadastrada no salão
              </h3>
              <p className="text-xs text-[#78716A] mb-6">
                Cadastre as mesas do seu restaurante ou inicialize com o layout padrão de 10 mesas.
              </p>
{canManageTables && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Mesa</span>
                </button>
                <button
                  onClick={handleSeedDefaults}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-stone-50 border border-[#E0DBD3] text-xs text-[#191817] font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Gerar Mesas 01 a 10</span>
                </button>
              </div>
)}
            </div>
          )}

          {/* Caso filtros não encontrem nada */}
          {tables.length > 0 && filteredTables.length === 0 && (
            <div className="py-16 text-center text-xs text-[#78716A]">
              Nenhuma mesa encontrada para o filtro ou busca selecionada.
            </div>
          )}

          {/* Grid de Mesas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTables.map((table) => {
              const isSelected = selectedTable?.id === table.id;
              const isFree = table.status === 'free';
              const isBill = table.status === 'bill_requested';

              return (
                <div
                  key={table.id}
                  onClick={() => handleSelectTable(table)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Mesa ${table.number}, ${tableStatusLabels[table.status] ?? table.status}`}
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      handleSelectTable(table);
                    }
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[160px] relative group focus:outline-none focus:ring-2 focus:ring-[#C84E1F] ${
                    isSelected
                      ? 'border-[#C84E1F] bg-white ring-2 ring-[#C84E1F]/20 shadow-md'
                      : isBill
                      ? 'border-amber-300 bg-amber-50/40 hover:border-amber-400'
                      : isFree
                      ? 'border-[#EAE6E1] bg-white hover:border-[#D4CEC5] hover:shadow-xs'
                      : 'border-[#EAE6E1] bg-white hover:border-[#D4CEC5] hover:shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-bold text-[#191817]">
                          Mesa {table.number}
                        </span>
                        {table.capacity && (
                          <span className="text-[10px] text-[#78716A] flex items-center gap-0.5 font-medium">
                            <Users className="w-3 h-3 text-[#A8A199]" />
                            {table.capacity}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {table.waiter_called && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearWaiterCall(table.number);
                            }}
                            title="Clique para atender e dispensar chamado"
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse hover:bg-rose-600 hover:text-white transition-colors"
                          >
                            <Bell className="w-3 h-3" />
                            Garçom!
                          </button>
                        )}
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            isBill
                              ? 'bg-amber-100 text-amber-800 border border-amber-200 font-semibold'
                              : isFree
                              ? 'bg-stone-100 text-[#78716A]'
                              : 'bg-[#C84E1F]/10 text-[#C84E1F] border border-[#C84E1F]/20 font-semibold'
                          }`}
                        >
                          {isBill ? 'Pede conta' : isFree ? 'Livre' : 'Ocupada'}
                        </span>
                      </div>
                    </div>

                    {/* Informações Centrais */}
                    {!isFree ? (
                      <div className="space-y-1 text-xs mt-3">
                        <div className="flex items-center justify-between text-[#78716A]">
                          <span>Garçom</span>
                          <span className="text-[#191817] font-medium">{table.waiter}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#78716A]">
                          <span>Aberta às</span>
                          <span className="text-[#191817]">{table.opened_at || 'Agora'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#78716A]">
                          <span>Itens lançados</span>
                          <span className="text-[#191817] font-medium">
                            {table.items_count || 0} itens
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-[#78716A] text-xs flex flex-col items-center justify-center gap-0.5">
                        <span className="font-medium text-[#44403C]">Mesa livre</span>
                        <span className="text-[11px] text-[#A8A199]">
                          Capacidade: {table.capacity || 4} lugares
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Rodapé do Card */}
                  {!isFree ? (
                    <div className="pt-2.5 mt-2.5 border-t border-[#EAE6E1] flex items-center justify-between">
                      <span className="text-xs text-[#78716A]">Consumo:</span>
                      <span className="text-sm font-bold text-[#191817]">
                        {formatBRL((table.total || 0))}
                      </span>
                    </div>
                  ) : (
                    <div className="pt-2 mt-2 flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTable(table.number);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] hover:bg-[#C84E1F] hover:border-[#C84E1F] hover:text-white text-xs text-[#191817] transition-colors cursor-pointer font-medium"
                      >
                        + Abrir mesa
                      </button>
{canManageTables && (<>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(table);
                        }}
                        title="Editar mesa"
                        className="p-1.5 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] hover:border-[#191817] text-[#78716A] hover:text-[#191817] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(table);
                        }}
                        title="Excluir mesa"
                        className="p-1.5 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] hover:border-rose-300 hover:text-rose-600 text-[#78716A] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
</>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Lado Direito: Comanda Digital Completa & Gestão da Mesa */}
        <aside ref={detailsPanelRef} className="w-full lg:w-[420px] bg-white p-6 scroll-mt-4 flex flex-col justify-between shrink-0 overflow-y-auto border-t lg:border-t-0 shadow-2xs">
          {selectedTable ? (
            selectedTable.status !== 'free' ? (
              /* Mesa Ocupada ou Pedindo Conta */
              <div className="flex flex-col h-full justify-between space-y-6">
                <div>
                  {/* Cabeçalho do Cupom / Comanda */}
                  <div className="pb-4 border-b border-[#EAE6E1]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-[#191817]">
                            Mesa {selectedTable.number}
                          </h2>
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                              selectedTable.status === 'bill_requested'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-[#C84E1F]/10 text-[#C84E1F] border border-[#C84E1F]/20 font-semibold'
                            }`}
                          >
                            {selectedTable.status === 'bill_requested'
                              ? 'Pede conta'
                              : 'Comanda ativa'}
                          </span>
                        </div>
                        <p className="text-xs text-[#78716A] mt-1">
                          Atendente: <strong className="text-[#191817]">{selectedTable.waiter}</strong>{' '}
                          • Aberta às {selectedTable.opened_at || 'Agora'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/table/${selectedTable.number}`}
                          target="_blank"
                          className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] hover:border-[#191817] text-[#78716A] hover:text-[#191817] transition-colors shadow-2xs"
                          title="Abrir tablet do cliente"
                        >
                          <Smartphone className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>

                    {/* Alerta de Garçom se acionado */}
                    {selectedTable.waiter_called && (
                      <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-rose-800">
                          <Bell className="w-4 h-4 text-rose-600 animate-bounce" />
                          <span>Cliente solicitou atendimento no salão</span>
                        </div>
                        <button
                          onClick={() => handleClearWaiterCall(selectedTable.number)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Atender
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Lista de Itens Lançados */}
                  <div className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-[#191817]">
                        Itens consumidos ({selectedTable.items?.length || 0})
                      </span>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="text-xs text-[#C84E1F] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Lançar item</span>
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                      {(!selectedTable.items || selectedTable.items.length === 0) && (
                        <div className="py-8 text-center text-xs text-[#A8A199]">
                          Nenhum item lançado ainda nesta mesa.
                        </div>
                      )}

                      {(selectedTable.items || []).map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1] flex items-start justify-between text-xs"
                        >
                          <div className="flex-1 pr-2">
                            <div className="flex items-center gap-1.5 font-medium text-[#191817]">
                              <span className="font-bold text-[#C84E1F]">{item.quantity}x</span>
                              <span>{item.name}</span>
                            </div>
                            {item.notes && (
                              <p className="text-[11px] text-[#78716A] mt-0.5 pl-5">
                                {/^(Obs|Ponto|Extras):/.test(item.notes) ? item.notes : `Obs: ${item.notes}`}
                              </p>
                            )}
                            <div className="mt-1 pl-5">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  item.status === 'delivered'
                                    ? 'bg-stone-100 text-[#44403C] border border-stone-200 font-semibold'
                                    : item.status === 'ready'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : item.status === 'preparing'
                                    ? 'bg-[#C84E1F]/10 text-[#C84E1F] border border-[#C84E1F]/20'
                                    : 'bg-stone-100 text-[#78716A]'
                                }`}
                              >
                                {item.status === 'delivered'
                                  ? '✓ Entregue na mesa'
                                  : item.status === 'ready'
                                  ? 'Pronto na cozinha'
                                  : item.status === 'preparing'
                                  ? 'Em preparo'
                                  : 'Na fila'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-[#191817]">
                              {formatBRL((item.price * item.quantity))}
                            </span>
                            <p className="text-[10px] text-[#78716A]">
                              {formatBRL(item.price)} un
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fechamento Financeiro & Meios de Pagamento */}
                <div className="pt-4 border-t border-[#EAE6E1] space-y-4">
                  {/* Resumo Financeiro */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-[#78716A]">
                      <span>Subtotal dos itens</span>
                      <span>{formatBRL(subtotal)}</span>
                    </div>

                    {adjustment !== 0 && (
                      <div className="flex justify-between text-[#78716A]">
                        <span>Taxas e descontos da comanda</span>
                        <span>{formatBRL(adjustment)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[#78716A]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeService}
                          onChange={(e) => setIncludeService(e.target.checked)}
                          className="rounded border-[#E0DBD3] text-[#C84E1F] focus:ring-0 bg-[#FAF8F5]"
                        />
                        <span>Serviço garçom (10%)</span>
                      </label>
                      <span>{formatBRL(serviceFee)}</span>
                    </div>

                    <div className="flex justify-between text-base font-bold text-[#191817] pt-2 border-t border-[#EAE6E1]">
                      <span>Total da conta</span>
                      <span className="text-[#C84E1F]">
                        {formatBRL(grandTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Formas de Pagamento Rápido */}
                  <div>
                    <span className="text-[11px] text-[#78716A] block mb-2 font-medium">
                      Meio de recebimento
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('pix')}
                        className={`py-2 px-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          paymentMethod === 'pix'
                            ? 'bg-[#C84E1F] border-[#C84E1F] text-white font-semibold shadow-xs'
                            : 'bg-[#FAF8F5] border-[#E0DBD3] text-[#191817] hover:border-[#C84E1F]'
                        }`}
                      >
                        PIX
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('credit_card')}
                        disabled={!isStripeConfigured}
                        title={isStripeConfigured ? undefined : 'Pagamento com cartão não configurado neste ambiente'}
                        className={`py-2 px-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          paymentMethod === 'credit_card'
                            ? 'bg-[#C84E1F] border-[#C84E1F] text-white font-semibold shadow-xs'
                            : 'bg-[#FAF8F5] border-[#E0DBD3] text-[#191817] hover:border-[#C84E1F]'
                        }`}
                      >
                        Cartão (Stripe)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`py-2 px-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          paymentMethod === 'cash'
                            ? 'bg-[#C84E1F] border-[#C84E1F] text-white font-semibold shadow-xs'
                            : 'bg-[#FAF8F5] border-[#E0DBD3] text-[#191817] hover:border-[#C84E1F]'
                        }`}
                      >
                        Dinheiro
                      </button>
                    </div>
                  </div>

                  {/* Botões Principais de Ação */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCloseTable(selectedTable.number)}
                      disabled={isClosing}
                      className="py-3 px-3 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{isClosing ? 'Baixando...' : 'Fechar mesa'}</span>
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="py-3 px-3 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-[#191817] border border-[#E0DBD3] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir</span>
                    </button>
                  </div>

                  {/* Ação de Gerência: Forçar Liberação / Desocupação */}
{canManageTables && (
                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={() => handleResetTable(selectedTable.number)}
                      className="text-[11px] text-[#78716A] hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Forçar liberação da mesa</span>
                    </button>
                  </div>
)}
                </div>
              </div>
            ) : (
              /* Mesa Livre Selecionada */
              <div className="flex flex-col h-full justify-between space-y-6">
                <div>
                  <div className="pb-4 border-b border-[#EAE6E1]">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-[#191817]">
                          Mesa {selectedTable.number}
                        </h2>
                        <span className="inline-block mt-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                          Mesa Livre • Disponível
                        </span>
                      </div>

{canManageTables && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(selectedTable)}
                          title="Editar capacidade/número"
                          className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] hover:border-[#191817] text-[#78716A] hover:text-[#191817] transition-colors cursor-pointer shadow-2xs"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTable(selectedTable)}
                          title="Excluir mesa do salão"
                          className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] hover:border-rose-300 hover:text-rose-600 text-[#78716A] transition-colors cursor-pointer shadow-2xs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
)}
                    </div>
                  </div>

                  <div className="py-6 space-y-4">
                    <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6E1] space-y-2">
                      <div className="flex justify-between text-xs text-[#78716A]">
                        <span>Capacidade de pessoas:</span>
                        <strong className="text-[#191817] flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-[#C84E1F]" />
                          {selectedTable.capacity || 4} lugares
                        </strong>
                      </div>
                      <div className="flex justify-between text-xs text-[#78716A]">
                        <span>Identificação no salão:</span>
                        <strong className="text-[#191817]">
                          {selectedTable.raw_number || `Mesa ${selectedTable.number}`}
                        </strong>
                      </div>
                      <div className="flex justify-between text-xs text-[#78716A]">
                        <span>Status atual:</span>
                        <strong className="text-emerald-700">Livre para receber clientes</strong>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6E1] flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-[#191817]">Cardápio do Tablet</p>
                        <p className="text-[11px] text-[#78716A]">
                          Simule a visão do cliente nesta mesa
                        </p>
                      </div>
                      <Link
                        href={`/table/${selectedTable.number}`}
                        target="_blank"
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#E0DBD3] hover:border-[#C84E1F] text-xs font-medium text-[#191817] flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-[#C84E1F]" />
                        <span>Abrir</span>
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#EAE6E1] space-y-3">
                  <button
                    onClick={() => handleOpenTable(selectedTable.number)}
                    className="w-full py-3 px-4 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Abrir Comanda no Salão</span>
                  </button>

{canManageTables && (
                  <div className="flex items-center justify-between text-xs text-[#78716A] px-1">
                    <button
                      onClick={() => handleOpenEditModal(selectedTable)}
                      className="hover:text-[#191817] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Alterar lugares</span>
                    </button>
                    <button
                      onClick={() => handleDeleteTable(selectedTable)}
                      className="hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Excluir mesa</span>
                    </button>
                  </div>
)}
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-[#78716A] p-6">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E0DBD3] flex items-center justify-center text-[#A8A199] mb-3 shadow-2xs">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#191817] mb-1">
                Nenhuma mesa selecionada
              </h3>
              <p className="text-xs text-[#78716A] max-w-xs mb-4">
                Selecione uma mesa no mapa para abrir comanda, consultar itens, gerenciar lugares ou
                registrar pagamentos.
              </p>
{canManageTables && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-3.5 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] hover:border-[#C84E1F] text-[#191817] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#C84E1F]" />
                <span>Cadastrar nova mesa</span>
              </button>
)}
            </div>
          )}
        </aside>
      </div>

      {/* MODAL 1: Cadastrar Nova Mesa */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateTable}
            className="w-full max-w-md bg-white border border-[#EAE6E1] rounded-2xl p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE6E1]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#C84E1F]/10 flex items-center justify-center text-[#C84E1F]">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-[#191817]">Cadastrar Nova Mesa</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-[#78716A] hover:text-[#191817] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{createError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#44403C] block mb-1.5 font-medium">
                  Número ou identificação da mesa
                </label>
                <input
                  type="text"
                  maxLength={30}
                  placeholder="Ex: 11, 12, 15..."
                  inputMode="numeric"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value.slice(0, 30))}
                  className="w-full p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#191817] focus:outline-none focus:border-[#C84E1F] focus:bg-white"
                  required
                  autoFocus
                />
                <span className="text-[10px] text-[#78716A] mt-1 block">
                  Ex: Se digitar &quot;11&quot;, ficará &quot;Mesa 11&quot; no sistema e tablet.
                </span>
              </div>

              <div>
                <label className="text-xs text-[#44403C] block mb-1.5 font-medium">
                  Capacidade de lugares (pessoas)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[2, 4, 6, 8].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setNewTableCapacity(cap)}
                      className={`py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                        newTableCapacity === cap
                          ? 'bg-[#C84E1F] border-[#C84E1F] text-white font-semibold shadow-xs'
                          : 'bg-[#FAF8F5] border-[#E0DBD3] text-[#191817] hover:border-[#C84E1F]'
                      }`}
                    >
                      {cap} pessoas
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 1)}
                  className="w-full p-2 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#191817] focus:outline-none focus:border-[#C84E1F] focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#EAE6E1] flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs text-[#57534E] font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreatingTable}
                className="px-5 py-2 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isCreatingTable ? 'Criando...' : 'Salvar Mesa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Editar Capacidade da Mesa */}
      {showEditModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveEditTable}
            className="w-full max-w-sm bg-white border border-[#EAE6E1] rounded-2xl p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE6E1]">
              <h3 className="text-base font-semibold text-[#191817]">
                Editar Mesa {selectedTable.number}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-[#78716A] hover:text-[#191817] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#44403C] block mb-1">Identificação / Número</label>
                <input
                  type="text"
                  maxLength={30}
                  value={editingTableNumber}
                  onChange={(e) => setEditingTableNumber(e.target.value.slice(0, 30))}
                  className="w-full p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#191817] focus:outline-none focus:border-[#C84E1F] focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#44403C] block mb-1">Capacidade (Lugares)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={editingTableCapacity}
                  onChange={(e) => setEditingTableCapacity(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#191817] focus:outline-none focus:border-[#C84E1F] focus:bg-white"
                  required
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#EAE6E1] flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs text-[#57534E] font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Lançar Item na Comanda */}
      {showAddModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-[#EAE6E1] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE6E1]">
              <h3 className="text-base font-semibold text-[#191817]">
                Lançar item na Mesa {selectedTable.number}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-[#78716A] hover:text-[#191817] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#44403C] block mb-1">Selecione o produto</label>
                <select
                  value={selectedProductId || ''}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#191817] focus:outline-none focus:border-[#C84E1F] focus:bg-white"
                >
                  <option value="">Escolha um prato ou bebida...</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} — {formatBRL(Number(prod.price))}
                    </option>
                  ))}
                </select>
                {products.length === 0 && (
                  <p className="text-[11px] text-[#78716A] mt-1.5">
                    Nenhum prato à venda.{' '}
                    {canManageTables ? (
                      <Link href="/menu" className="text-[#C84E1F] font-semibold hover:underline">Cadastrar no cardápio</Link>
                    ) : (
                      'Peça à gerência para cadastrar o cardápio.'
                    )}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <div className="w-1/3">
                  <label className="text-xs font-medium text-[#44403C] block mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    value={addItemQuantity}
                    onChange={(e) => setAddItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#191817] focus:outline-none focus:border-[#C84E1F] focus:bg-white"
                  />
                </div>
                <div className="w-2/3">
                  <label className="text-xs font-medium text-[#44403C] block mb-1">Observações (opcional)</label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Ex: ao ponto, sem gelo..."
                    value={addItemNotes}
                    onChange={(e) => setAddItemNotes(e.target.value.slice(0, 100))}
                    className="w-full p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#191817] focus:outline-none focus:border-[#C84E1F] focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#EAE6E1] flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs text-[#57534E] font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddItemToComanda}
                disabled={!selectedProductId || isAddingItem}
                className="px-4 py-2 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isAddingItem ? 'Lançando...' : 'Confirmar lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Confirmação Customizada Elegante */}
      {confirmModal && (
        <div
          onClick={() => setConfirmModal(null)}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white border border-[#EAE6E1] rounded-2xl p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.isDestructive
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-[#C84E1F]/10 text-[#C84E1F] border border-[#C84E1F]/20'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#191817]">{confirmModal.title}</h3>
                <p className="text-xs text-[#78716A] mt-0.5 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#EAE6E1] flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs text-[#57534E] font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal(null);
                  await action();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs ${
                  confirmModal.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#C84E1F] hover:bg-[#B34217]'
                }`}
              >
                {confirmModal.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTable && (
        <StripePaymentModal
          isOpen={showStripeModal}
          onClose={() => setShowStripeModal(false)}
          tableNumber={selectedTable.number}
          amount={grandTotal}
          includeService={includeService}
          onSuccess={() => {
            toast.success(`Mesa ${selectedTable.number} paga via Stripe e liberada com sucesso!`);
            setSelectedTable(null);
            fetchTables(true);
          }}
        />
      )}
    </div>

      {/* Pré-conta impressa: só aparece na impressão ("Imprimir" no painel da mesa) */}
      {selectedTable && (
        <section aria-hidden="true" className="hidden print:block p-6 text-black font-mono text-xs max-w-[80mm]">
          <p className="text-center text-base font-bold">{activeRestaurant?.name ?? 'ELO Gastronomia'}</p>
          <p className="text-center mb-3">Pré-conta • Mesa {selectedTable.number}</p>
          <p>Aberta às {selectedTable.opened_at ?? '—'}</p>
          <p className="mb-2">Emitida em {new Date().toLocaleString('pt-BR')}</p>
          <hr className="border-dashed border-black my-2" />
          {(selectedTable.items ?? []).map((item) => (
            <div key={item.id} className="flex justify-between gap-2">
              <span>
                {item.quantity}x {item.name}
              </span>
              <span>{formatBRL(item.subtotal ?? item.price * item.quantity)}</span>
            </div>
          ))}
          <hr className="border-dashed border-black my-2" />
          <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
          {adjustment !== 0 && (
            <div className="flex justify-between"><span>Taxas e descontos</span><span>{formatBRL(adjustment)}</span></div>
          )}
          {includeService && (
            <div className="flex justify-between"><span>Serviço (10%)</span><span>{formatBRL(serviceFee)}</span></div>
          )}
          <div className="flex justify-between font-bold text-sm mt-1"><span>Total</span><span>{formatBRL(grandTotal)}</span></div>
          <p className="text-center mt-4">Documento sem valor fiscal</p>
        </section>
      )}
    </>
  );
}
