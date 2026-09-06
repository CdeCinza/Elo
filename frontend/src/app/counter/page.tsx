'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/ToastProvider';
import {
  LayoutGrid,
  Receipt,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  CreditCard,
  Search,
  ArrowUpRight,
  Printer,
  DollarSign,
  Coffee,
  ChefHat,
  ChevronRight,
  TrendingUp,
  Bell,
  X,
  Trash2,
  Edit3,
  Check,
  RefreshCw,
  Smartphone,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

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

export default function PosCounterPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'occupied' | 'bill_requested' | 'free'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeService, setIncludeService] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix' | 'cash'>('credit_card');
  const [isClosing, setIsClosing] = useState(false);
  const [operatorName, setOperatorName] = useState('Matheus');
  const [isEditingOperator, setIsEditingOperator] = useState(false);
  const [tempOperatorName, setTempOperatorName] = useState('');

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

  // Modal customizado de confirmação
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

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

      // Sincroniza mesa selecionada
      setSelectedTable((prev) => {
        if (!prev) return null;
        return loadedTables.find((t) => t.id === prev.id) || null;
      });
    } catch (err) {
      console.error('Erro ao buscar mesas do POS:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Busca cardápio para lançamento manual
  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data.data || []);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    }
  }, []);

  useEffect(() => {
    fetchTables();
    fetchProducts();

    // Polling a cada 3,5 segundos
    const interval = setInterval(() => {
      fetchTables(true);
    }, 3500);

    return () => clearInterval(interval);
  }, [fetchTables, fetchProducts]);

  // Abertura manual de mesa
  const handleOpenTable = async (tableNumber: string) => {
    try {
      await api.post(`/pos/tables/${tableNumber}/open`);
      toast.success(`Mesa ${tableNumber} aberta com sucesso.`);
      await fetchTables(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao abrir mesa.');
    }
  };

  // Fechamento e baixa no caixa
  const handleCloseTable = async (tableNumber: string) => {
    setIsClosing(true);
    try {
      await api.post(`/pos/tables/${tableNumber}/close`, {
        payment_method: paymentMethod,
      });
      toast.success(`Mesa ${tableNumber} finalizada com sucesso! Baixa realizada.`);
      setSelectedTable(null);
      await fetchTables(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao fechar mesa.');
    } finally {
      setIsClosing(false);
    }
  };

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Abrir modal de criação de mesa sugerindo o próximo número
  const handleOpenCreateModal = () => {
    console.log('[POS] Clicou para abrir modal de nova mesa');
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
  const handleCreateTable = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao cadastrar nova mesa. Verifique a conexão com o servidor.';
      setCreateError(msg);
      toast.error(msg);
    } finally {
      setIsCreatingTable(false);
    }
  };

  // Abrir modal para editar capacidade/número da mesa
  const handleOpenEditModal = (table: TableData) => {
    setSelectedTable(table);
    setEditingTableNumber(table.number);
    setEditingTableCapacity(table.capacity || 4);
    setShowEditModal(true);
  };

  // Salvar edição da mesa
  const handleSaveEditTable = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao atualizar dados da mesa.');
    } finally {
      setIsSavingEdit(false);
    }
  };

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
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Erro ao excluir mesa.');
        }
      },
    });
  };

  // Atender / silenciar chamado de garçom
  const handleClearWaiterCall = async (tableNumber: string) => {
    try {
      await api.post(`/pos/tables/${tableNumber}/clear-waiter`);
      toast.info(`Chamado da Mesa ${tableNumber} atendido.`);
      await fetchTables(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao atender chamado.');
    }
  };

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
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Erro ao liberar mesa.');
        }
      },
    });
  };

  // Gerar mesas padrão (01 a 10) caso o banco esteja vazio
  const handleSeedDefaults = async () => {
    try {
      await api.post('/pos/tables/seed-defaults');
      toast.success('Mesas 01 a 10 geradas com sucesso!');
      await fetchTables();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao gerar mesas padrão.');
    }
  };

  // Lançar item na comanda ativa
  const handleAddItemToComanda = async () => {
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao adicionar item.');
    } finally {
      setIsAddingItem(false);
    }
  };

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

  const subtotal = selectedTable?.total || 0;
  const serviceFee = includeService ? subtotal * 0.1 : 0;
  const grandTotal = subtotal + serviceFee;

  return (
    <div className="min-h-screen bg-[#141312] text-[#F9F8F6] flex flex-col selection:bg-[#C84E1F]/20 font-sans">
      {/* 1. Header do Balcão */}
      <header className="h-16 px-6 bg-[#1A1918] border-b border-[#2D2B28] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl font-bold tracking-tight text-[#F9F8F6]">ELO</span>
            <span className="text-xs text-[#A19A91] border-l border-[#3D3A36] pl-3">
              Frente de Caixa & Salão
            </span>
          </Link>

          <Link
            href="/kitchen"
            target="_blank"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#22201E] border border-[#2D2B28] text-xs text-[#A19A91] hover:text-[#F9F8F6] hover:border-[#3D3A36] transition-colors"
          >
            <ChefHat className="w-3.5 h-3.5 text-[#C84E1F]" />
            <span>KDS Cozinha</span>
          </Link>
        </div>

        {/* Métricas Resumidas no Topo */}
        <div className="hidden lg:flex items-center gap-6 text-xs text-[#A19A91]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
            <span>
              Salão:{' '}
              <strong className="text-[#F9F8F6]">
                {occupiedCount + billCount}/{tables.length} ocupadas
              </strong>
            </span>
          </div>
          <div className="h-3 w-[1px] bg-[#3D3A36]" />
          <div>
            <span>
              Total aberto:{' '}
              <strong className="text-[#C84E1F]">
                R$ {totalOpenRevenue.toFixed(2).replace('.', ',')}
              </strong>
            </span>
          </div>
          <div className="h-3 w-[1px] bg-[#3D3A36]" />
          <div>
            <span>
              Turno: <strong className="text-[#F9F8F6]">{isMounted ? currentShift : '---'}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Operador Dinâmico */}
          {isEditingOperator ? (
            <div className="flex items-center gap-1 bg-[#22201E] border border-[#C84E1F] rounded-lg px-2 py-1">
              <input
                type="text"
                value={tempOperatorName}
                onChange={(e) => setTempOperatorName(e.target.value)}
                className="bg-transparent text-xs text-[#F9F8F6] w-24 outline-none"
                placeholder="Nome..."
                autoFocus
              />
              <button
                onClick={() => {
                  if (tempOperatorName.trim()) setOperatorName(tempOperatorName.trim());
                  setIsEditingOperator(false);
                }}
                className="text-[#2D6A4F] hover:text-emerald-400 p-0.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsEditingOperator(false)}
                className="text-[#A19A91] hover:text-rose-400 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setTempOperatorName(operatorName);
                setIsEditingOperator(true);
              }}
              title="Clique para alterar operador do caixa"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#22201E] border border-[#2D2B28] hover:border-[#3D3A36] text-xs cursor-pointer transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
              <span className="text-[#A19A91]">Operador:</span>
              <span className="font-medium text-[#F9F8F6] flex items-center gap-1">
                {operatorName}
                <Edit3 className="w-2.5 h-2.5 text-[#A19A91]" />
              </span>
            </button>
          )}

          <button
            onClick={() => fetchTables(false)}
            title="Atualizar mesas agora"
            className="p-1.5 rounded-lg bg-[#22201E] border border-[#2D2B28] hover:text-[#F9F8F6] text-[#A19A91] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C84E1F]' : ''}`} />
          </button>
        </div>
      </header>

      {/* 2. Barra de Métricas em Cards + Filtros e Ações */}
      <div className="px-6 py-4 bg-[#171615] border-b border-[#2D2B28] shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-[#1E1D1B] border border-[#2D2B28]">
            <span className="text-[11px] text-[#A19A91]">Mesas ocupadas</span>
            <p className="text-xl font-bold text-[#F9F8F6] mt-0.5">
              {occupiedCount}{' '}
              <span className="text-xs text-[#A19A91] font-normal">mesas</span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#1E1D1B] border border-[#2D2B28]">
            <span className="text-[11px] text-[#A19A91]">Pedindo conta</span>
            <p className="text-xl font-bold text-amber-400 mt-0.5">
              {billCount}{' '}
              <span className="text-xs text-amber-400/80 font-normal">urgente</span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#1E1D1B] border border-[#2D2B28]">
            <span className="text-[11px] text-[#A19A91]">Mesas livres</span>
            <p className="text-xl font-bold text-[#2D6A4F] mt-0.5">
              {freeCount}{' '}
              <span className="text-xs text-[#A19A91] font-normal">disponíveis</span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#1E1D1B] border border-[#2D2B28]">
            <span className="text-[11px] text-[#A19A91]">Total em aberto no salão</span>
            <p className="text-xl font-bold text-[#C84E1F] mt-0.5">
              R$ {totalOpenRevenue.toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>

        {/* Filtros de Mesa e Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-[#F9F8F6] text-[#141312]'
                  : 'bg-[#1E1D1B] border border-[#2D2B28] text-[#A19A91] hover:border-[#4A4742]'
              }`}
            >
              Todas ({tables.length})
            </button>
            <button
              onClick={() => setFilter('occupied')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === 'occupied'
                  ? 'bg-[#C84E1F] text-white'
                  : 'bg-[#1E1D1B] border border-[#2D2B28] text-[#A19A91] hover:border-[#4A4742]'
              }`}
            >
              Ocupadas ({occupiedCount})
            </button>
            <button
              onClick={() => setFilter('bill_requested')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === 'bill_requested'
                  ? 'bg-amber-500 text-stone-950 font-semibold'
                  : 'bg-[#1E1D1B] border border-[#2D2B28] text-amber-400 hover:border-amber-500/40'
              }`}
            >
              Pedindo conta ({billCount})
            </button>
            <button
              onClick={() => setFilter('free')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === 'free'
                  ? 'bg-[#2D6A4F] text-white'
                  : 'bg-[#1E1D1B] border border-[#2D2B28] text-[#A19A91] hover:border-[#4A4742]'
              }`}
            >
              Livres ({freeCount})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A19A91]" />
              <input
                type="text"
                placeholder="Buscar mesa ou garçom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1E1D1B] border border-[#2D2B28] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#F9F8F6] placeholder-[#A19A91] focus:outline-none focus:border-[#4A4742]"
              />
            </div>

            {/* Botão Real de Criar Mesa */}
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-3.5 py-1.5 rounded-lg bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors shrink-0 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Nova mesa</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Grid Principal: Salão à Esquerda + Comanda / Gestão da Mesa à Direita */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Lado Esquerdo: Grid Rico de Mesas */}
        <section className="flex-1 p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-[#2D2B28]">
          {/* Caso não haja mesas cadastradas */}
          {tables.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-[#1E1D1B] border border-[#2D2B28] flex items-center justify-center text-[#A19A91] mb-4">
                <LayoutGrid className="w-8 h-8 text-[#C84E1F]" />
              </div>
              <h3 className="text-base font-bold text-[#F9F8F6] mb-1">
                Nenhuma mesa cadastrada no salão
              </h3>
              <p className="text-xs text-[#A19A91] mb-6">
                Cadastre as mesas do seu restaurante ou inicialize com o layout padrão de 10 mesas.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Mesa</span>
                </button>
                <button
                  onClick={handleSeedDefaults}
                  className="px-4 py-2 rounded-xl bg-[#22201E] hover:bg-[#2D2B28] border border-[#2D2B28] text-xs text-[#F9F8F6] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Gerar Mesas 01 a 10</span>
                </button>
              </div>
            </div>
          )}

          {/* Caso filtros não encontrem nada */}
          {tables.length > 0 && filteredTables.length === 0 && (
            <div className="py-16 text-center text-xs text-[#A19A91]">
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
                  onClick={() => setSelectedTable(table)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[160px] relative group ${
                    isSelected
                      ? 'border-[#C84E1F] bg-[#22201E] ring-1 ring-[#C84E1F] shadow-lg'
                      : isBill
                      ? 'border-amber-500/60 bg-amber-500/5 hover:border-amber-500'
                      : isFree
                      ? 'border-[#2D2B28] bg-[#171615] hover:border-[#3D3A36]'
                      : 'border-[#2D2B28] bg-[#1C1B19] hover:border-[#3D3A36]'
                  }`}
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold text-[#F9F8F6]">
                          Mesa {table.number}
                        </span>
                        {table.capacity && (
                          <span className="text-[10px] text-[#A19A91] flex items-center gap-0.5">
                            <Users className="w-3 h-3 text-[#6E6760]" />
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
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse hover:bg-rose-500 hover:text-white transition-colors"
                          >
                            <Bell className="w-3 h-3" />
                            Garçom!
                          </button>
                        )}
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                            isBill
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                              : isFree
                              ? 'bg-[#252321] text-[#A19A91]'
                              : 'bg-[#C84E1F]/15 text-[#C84E1F] border border-[#C84E1F]/30'
                          }`}
                        >
                          {isBill ? 'Pede conta' : isFree ? 'Livre' : 'Ocupada'}
                        </span>
                      </div>
                    </div>

                    {/* Informações Centrais */}
                    {!isFree ? (
                      <div className="space-y-1.5 text-xs mt-3">
                        <div className="flex items-center justify-between text-[#A19A91]">
                          <span>Garçom</span>
                          <span className="text-[#F9F8F6] font-medium">{table.waiter}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#A19A91]">
                          <span>Aberta às</span>
                          <span className="text-[#F9F8F6]">{table.opened_at || 'Agora'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#A19A91]">
                          <span>Itens lançados</span>
                          <span className="text-[#F9F8F6] font-medium">
                            {table.items_count || 0} itens
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-5 text-center text-[#6E6760] text-xs flex flex-col items-center justify-center gap-1">
                        <span>Mesa livre • Disponível</span>
                        <span className="text-[10px] text-[#A19A91]">
                          Capacidade: {table.capacity || 4} lugares
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Rodapé do Card */}
                  {!isFree ? (
                    <div className="pt-3 mt-3 border-t border-[#2D2B28] flex items-center justify-between">
                      <span className="text-xs text-[#A19A91]">Consumo:</span>
                      <span className="text-sm font-bold text-[#F9F8F6]">
                        R$ {(table.total || 0).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  ) : (
                    <div className="pt-2 mt-2 flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTable(table.number);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-[#22201E] border border-[#2D2B28] hover:bg-[#C84E1F] hover:border-[#C84E1F] text-xs text-[#F9F8F6] transition-colors cursor-pointer font-medium"
                      >
                        + Abrir mesa
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(table);
                        }}
                        title="Editar mesa"
                        className="p-1.5 rounded-lg bg-[#22201E] border border-[#2D2B28] hover:border-[#4A4742] text-[#A19A91] hover:text-[#F9F8F6] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(table);
                        }}
                        title="Excluir mesa"
                        className="p-1.5 rounded-lg bg-[#22201E] border border-[#2D2B28] hover:border-rose-500/40 hover:text-rose-400 text-[#A19A91] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Lado Direito: Comanda Digital Completa & Gestão da Mesa */}
        <aside className="w-full lg:w-[420px] bg-[#181716] p-6 flex flex-col justify-between shrink-0 overflow-y-auto border-t lg:border-t-0">
          {selectedTable ? (
            selectedTable.status !== 'free' ? (
              /* Mesa Ocupada ou Pedindo Conta */
              <div className="flex flex-col h-full justify-between space-y-6">
                <div>
                  {/* Cabeçalho do Cupom / Comanda */}
                  <div className="pb-4 border-b border-[#2D2B28]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-[#F9F8F6]">
                            Mesa {selectedTable.number}
                          </h2>
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${
                              selectedTable.status === 'bill_requested'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-[#C84E1F]/15 text-[#C84E1F]'
                            }`}
                          >
                            {selectedTable.status === 'bill_requested'
                              ? 'Pede conta'
                              : 'Comanda ativa'}
                          </span>
                        </div>
                        <p className="text-xs text-[#A19A91] mt-1">
                          Atendente: <strong className="text-[#F9F8F6]">{selectedTable.waiter}</strong>{' '}
                          • Aberta às {selectedTable.opened_at || 'Agora'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/table/${selectedTable.number}`}
                          target="_blank"
                          className="p-2 rounded-lg bg-[#22201E] border border-[#2D2B28] hover:border-[#4A4742] text-[#A19A91] hover:text-[#F9F8F6] transition-colors"
                          title="Abrir tablet do cliente"
                        >
                          <Smartphone className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>

                    {/* Alerta de Garçom se acionado */}
                    {selectedTable.waiter_called && (
                      <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-rose-300">
                          <Bell className="w-4 h-4 text-rose-400 animate-bounce" />
                          <span>Cliente solicitou atendimento no salão</span>
                        </div>
                        <button
                          onClick={() => handleClearWaiterCall(selectedTable.number)}
                          className="px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Atender
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Lista de Itens Lançados */}
                  <div className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-[#F9F8F6]">
                        Itens consumidos ({selectedTable.items?.length || 0})
                      </span>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="text-xs text-[#C84E1F] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Lançar item</span>
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                      {(!selectedTable.items || selectedTable.items.length === 0) && (
                        <div className="py-8 text-center text-xs text-[#6E6760]">
                          Nenhum item lançado ainda nesta mesa.
                        </div>
                      )}

                      {(selectedTable.items || []).map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg bg-[#1E1D1B] border border-[#2D2B28] flex items-start justify-between text-xs"
                        >
                          <div className="flex-1 pr-2">
                            <div className="flex items-center gap-1.5 font-medium text-[#F9F8F6]">
                              <span className="font-bold text-[#C84E1F]">{item.quantity}x</span>
                              <span>{item.name}</span>
                            </div>
                            {item.notes && (
                              <p className="text-[11px] text-[#A19A91] mt-0.5 pl-5">
                                Obs: {item.notes}
                              </p>
                            )}
                            <div className="mt-1 pl-5">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  item.status === 'ready'
                                    ? 'bg-[#2D6A4F]/20 text-[#4EBA87]'
                                    : item.status === 'preparing'
                                    ? 'bg-[#C84E1F]/20 text-[#C84E1F]'
                                    : 'bg-[#2D2B28] text-[#A19A91]'
                                }`}
                              >
                                {item.status === 'ready'
                                  ? 'Pronto na cozinha'
                                  : item.status === 'preparing'
                                  ? 'Em preparo'
                                  : 'Na fila'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-[#F9F8F6]">
                              R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                            </span>
                            <p className="text-[10px] text-[#A19A91]">
                              R$ {item.price.toFixed(2).replace('.', ',')} un
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fechamento Financeiro & Meios de Pagamento */}
                <div className="pt-4 border-t border-[#2D2B28] space-y-4">
                  {/* Resumo Financeiro */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-[#A19A91]">
                      <span>Subtotal dos itens</span>
                      <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>

                    <div className="flex justify-between items-center text-[#A19A91]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeService}
                          onChange={(e) => setIncludeService(e.target.checked)}
                          className="rounded border-[#3D3A36] text-[#C84E1F] focus:ring-0 bg-[#22201E]"
                        />
                        <span>Serviço garçom (10%)</span>
                      </label>
                      <span>R$ {serviceFee.toFixed(2).replace('.', ',')}</span>
                    </div>

                    <div className="flex justify-between text-base font-bold text-[#F9F8F6] pt-2 border-t border-[#2D2B28]">
                      <span>Total da conta</span>
                      <span className="text-[#C84E1F]">
                        R$ {grandTotal.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>

                  {/* Formas de Pagamento Rápido */}
                  <div>
                    <span className="text-[11px] text-[#A19A91] block mb-2 font-medium">
                      Meio de recebimento
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('pix')}
                        className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          paymentMethod === 'pix'
                            ? 'bg-[#C84E1F] border-[#C84E1F] text-white'
                            : 'bg-[#22201E] border-[#2D2B28] text-[#F9F8F6] hover:border-[#C84E1F]'
                        }`}
                      >
                        PIX
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('credit_card')}
                        className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          paymentMethod === 'credit_card'
                            ? 'bg-[#C84E1F] border-[#C84E1F] text-white'
                            : 'bg-[#22201E] border-[#2D2B28] text-[#F9F8F6] hover:border-[#C84E1F]'
                        }`}
                      >
                        Cartão
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          paymentMethod === 'cash'
                            ? 'bg-[#C84E1F] border-[#C84E1F] text-white'
                            : 'bg-[#22201E] border-[#2D2B28] text-[#F9F8F6] hover:border-[#C84E1F]'
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
                      className="py-3 px-3 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{isClosing ? 'Baixando...' : 'Fechar mesa'}</span>
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="py-3 px-3 rounded-xl bg-[#22201E] hover:bg-[#2D2B28] text-[#F9F8F6] border border-[#2D2B28] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir</span>
                    </button>
                  </div>

                  {/* Ação de Gerência: Forçar Liberação / Desocupação */}
                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={() => handleResetTable(selectedTable.number)}
                      className="text-[11px] text-[#A19A91] hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Forçar liberação da mesa</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Mesa Livre Selecionada */
              <div className="flex flex-col h-full justify-between space-y-6">
                <div>
                  <div className="pb-4 border-b border-[#2D2B28]">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-[#F9F8F6]">
                          Mesa {selectedTable.number}
                        </h2>
                        <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded bg-[#2D6A4F]/20 text-[#4EBA87] border border-[#2D6A4F]/30 font-medium">
                          Mesa Livre • Disponível
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(selectedTable)}
                          title="Editar capacidade/número"
                          className="p-2 rounded-lg bg-[#22201E] border border-[#2D2B28] hover:border-[#4A4742] text-[#A19A91] hover:text-[#F9F8F6] transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTable(selectedTable)}
                          title="Excluir mesa do salão"
                          className="p-2 rounded-lg bg-[#22201E] border border-[#2D2B28] hover:border-rose-500/40 hover:text-rose-400 text-[#A19A91] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="py-6 space-y-4">
                    <div className="p-4 rounded-xl bg-[#1E1D1B] border border-[#2D2B28] space-y-2">
                      <div className="flex justify-between text-xs text-[#A19A91]">
                        <span>Capacidade de pessoas:</span>
                        <strong className="text-[#F9F8F6] flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-[#C84E1F]" />
                          {selectedTable.capacity || 4} lugares
                        </strong>
                      </div>
                      <div className="flex justify-between text-xs text-[#A19A91]">
                        <span>Identificação no salão:</span>
                        <strong className="text-[#F9F8F6]">
                          {selectedTable.raw_number || `Mesa ${selectedTable.number}`}
                        </strong>
                      </div>
                      <div className="flex justify-between text-xs text-[#A19A91]">
                        <span>Status atual:</span>
                        <strong className="text-[#2D6A4F]">Livre para receber clientes</strong>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#1A1918] border border-[#2D2B28] flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-[#F9F8F6]">Cardápio do Tablet</p>
                        <p className="text-[11px] text-[#A19A91]">
                          Simule a visão do cliente nesta mesa
                        </p>
                      </div>
                      <Link
                        href={`/table/${selectedTable.number}`}
                        target="_blank"
                        className="px-3 py-1.5 rounded-lg bg-[#22201E] border border-[#2D2B28] hover:border-[#4A4742] text-xs font-medium text-[#F9F8F6] flex items-center gap-1.5 transition-colors"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-[#C84E1F]" />
                        <span>Abrir</span>
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#2D2B28] space-y-3">
                  <button
                    onClick={() => handleOpenTable(selectedTable.number)}
                    className="w-full py-3 px-4 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Abrir Comanda no Salão</span>
                  </button>

                  <div className="flex items-center justify-between text-xs text-[#A19A91] px-1">
                    <button
                      onClick={() => handleOpenEditModal(selectedTable)}
                      className="hover:text-[#F9F8F6] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Alterar lugares</span>
                    </button>
                    <button
                      onClick={() => handleDeleteTable(selectedTable)}
                      className="hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Excluir mesa</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-[#A19A91] p-6">
              <div className="w-12 h-12 rounded-xl bg-[#22201E] border border-[#2D2B28] flex items-center justify-center text-[#A19A91] mb-3">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#F9F8F6] mb-1">
                Nenhuma mesa selecionada
              </h3>
              <p className="text-xs text-[#A19A91] max-w-xs mb-4">
                Selecione uma mesa no mapa para abrir comanda, consultar itens, gerenciar lugares ou
                registrar pagamentos.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-3.5 py-1.5 rounded-lg bg-[#22201E] border border-[#2D2B28] hover:border-[#4A4742] text-[#F9F8F6] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#C84E1F]" />
                <span>Cadastrar nova mesa</span>
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* MODAL 1: Cadastrar Nova Mesa */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateTable}
            className="w-full max-w-md bg-[#1A1918] border border-[#2D2B28] rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2D2B28]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#C84E1F]/15 flex items-center justify-center text-[#C84E1F]">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#F9F8F6]">Cadastrar Nova Mesa</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-[#A19A91] hover:text-[#F9F8F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#A19A91] block mb-1.5 font-medium">
                  Número ou identificação da mesa
                </label>
                <input
                  type="text"
                  placeholder="Ex: 11, 12, Varanda 01..."
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#22201E] border border-[#2D2B28] text-sm text-[#F9F8F6] focus:outline-none focus:border-[#C84E1F]"
                  required
                  autoFocus
                />
                <span className="text-[10px] text-[#6E6760] mt-1 block">
                  Ex: Se digitar &quot;11&quot;, ficará &quot;Mesa 11&quot; no sistema e tablet.
                </span>
              </div>

              <div>
                <label className="text-xs text-[#A19A91] block mb-1.5 font-medium">
                  Capacidade de lugares (pessoas)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[2, 4, 6, 8].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setNewTableCapacity(cap)}
                      className={`py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        newTableCapacity === cap
                          ? 'bg-[#C84E1F] border-[#C84E1F] text-white'
                          : 'bg-[#22201E] border-[#2D2B28] text-[#A19A91] hover:border-[#4A4742]'
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
                  className="w-full p-2 rounded-xl bg-[#22201E] border border-[#2D2B28] text-xs text-[#F9F8F6] focus:outline-none focus:border-[#C84E1F]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#2D2B28] flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-[#22201E] hover:bg-[#2D2B28] text-xs text-[#A19A91] font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreatingTable}
                className="px-5 py-2 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isCreatingTable ? 'Criando...' : 'Salvar Mesa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Editar Capacidade da Mesa */}
      {showEditModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveEditTable}
            className="w-full max-w-sm bg-[#1A1918] border border-[#2D2B28] rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2D2B28]">
              <h3 className="text-base font-bold text-[#F9F8F6]">
                Editar Mesa {selectedTable.number}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-[#A19A91] hover:text-[#F9F8F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#A19A91] block mb-1">Identificação / Número</label>
                <input
                  type="text"
                  value={editingTableNumber}
                  onChange={(e) => setEditingTableNumber(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#22201E] border border-[#2D2B28] text-xs text-[#F9F8F6] focus:outline-none focus:border-[#C84E1F]"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-[#A19A91] block mb-1">Capacidade (Lugares)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={editingTableCapacity}
                  onChange={(e) => setEditingTableCapacity(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 rounded-xl bg-[#22201E] border border-[#2D2B28] text-xs text-[#F9F8F6] focus:outline-none focus:border-[#C84E1F]"
                  required
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#2D2B28] flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-xl bg-[#22201E] hover:bg-[#2D2B28] text-xs text-[#A19A91] font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Lançar Item na Comanda */}
      {showAddModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#1A1918] border border-[#2D2B28] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2D2B28]">
              <h3 className="text-base font-bold text-[#F9F8F6]">
                Lançar item na Mesa {selectedTable.number}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-[#A19A91] hover:text-[#F9F8F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#A19A91] block mb-1">Selecione o produto</label>
                <select
                  value={selectedProductId || ''}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-[#22201E] border border-[#2D2B28] text-xs text-[#F9F8F6] focus:outline-none focus:border-[#C84E1F]"
                >
                  <option value="">Escolha um prato ou bebida...</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} — R$ {Number(prod.price).toFixed(2).replace('.', ',')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <div className="w-1/3">
                  <label className="text-xs text-[#A19A91] block mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    value={addItemQuantity}
                    onChange={(e) => setAddItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2.5 rounded-xl bg-[#22201E] border border-[#2D2B28] text-xs text-[#F9F8F6] focus:outline-none focus:border-[#C84E1F]"
                  />
                </div>
                <div className="w-2/3">
                  <label className="text-xs text-[#A19A91] block mb-1">Observações (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: ao ponto, sem gelo..."
                    value={addItemNotes}
                    onChange={(e) => setAddItemNotes(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#22201E] border border-[#2D2B28] text-xs text-[#F9F8F6] focus:outline-none focus:border-[#C84E1F]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#2D2B28] flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-[#22201E] hover:bg-[#2D2B28] text-xs text-[#A19A91] font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddItemToComanda}
                disabled={!selectedProductId || isAddingItem}
                className="px-4 py-2 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
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
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1A1918] border border-[#2D2B28] rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.isDestructive
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-[#C84E1F]/15 text-[#C84E1F]'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#F9F8F6]">{confirmModal.title}</h3>
                <p className="text-xs text-[#A19A91] mt-0.5 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#2D2B28] flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-[#22201E] hover:bg-[#2D2B28] text-xs text-[#A19A91] font-medium transition-colors cursor-pointer"
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
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer ${
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
    </div>
  );
}
