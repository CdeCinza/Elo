'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
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

  // Modal para lançar prato na comanda
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [addItemQuantity, setAddItemQuantity] = useState(1);
  const [addItemNotes, setAddItemNotes] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

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
      fetchTables(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao abrir mesa.');
    }
  };

  // Fechamento e baixa no caixa
  const handleCloseTable = async (tableNumber: string) => {
    setIsClosing(true);
    try {
      await api.post(`/pos/tables/${tableNumber}/close`, {
        payment_method: paymentMethod,
      });
      alert(`✓ Mesa ${tableNumber} finalizada com sucesso! Baixa realizada.`);
      setSelectedTable(null);
      fetchTables(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao fechar mesa.');
    } finally {
      setIsClosing(false);
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
      setShowAddModal(false);
      setSelectedProductId(null);
      setAddItemQuantity(1);
      setAddItemNotes('');
      fetchTables(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao adicionar item.');
    } finally {
      setIsAddingItem(false);
    }
  };

  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const billCount = tables.filter((t) => t.status === 'bill_requested').length;
  const freeCount = tables.filter((t) => t.status === 'free').length;
  const totalOpenRevenue = tables.reduce((acc, t) => acc + (t.total || 0), 0);

  const filteredTables = tables.filter((t) => {
    if (filter === 'occupied') return t.status === 'occupied';
    if (filter === 'bill_requested') return t.status === 'bill_requested';
    if (filter === 'free') return t.status === 'free';
    if (searchQuery.trim()) {
      return (
        t.number.includes(searchQuery) ||
        (t.waiter && t.waiter.toLowerCase().includes(searchQuery.toLowerCase()))
      );
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
        </div>

        {/* Métricas Resumidas no Topo */}
        <div className="hidden lg:flex items-center gap-6 text-xs text-[#A19A91]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
            <span>Salão: <strong className="text-[#F9F8F6]">{occupiedCount + billCount}/{tables.length} ocupadas</strong></span>
          </div>
          <div className="h-3 w-[1px] bg-[#3D3A36]" />
          <div>
            <span>Total aberto: <strong className="text-[#C84E1F]">R$ {totalOpenRevenue.toFixed(2).replace('.', ',')}</strong></span>
          </div>
          <div className="h-3 w-[1px] bg-[#3D3A36]" />
          <div>
            <span>Turno: <strong className="text-[#F9F8F6]">Jantar (18h - 23h)</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#22201E] border border-[#2D2B28] text-xs">
            <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
            <span className="text-[#A19A91]">Operador:</span>
            <span className="font-medium text-[#F9F8F6]">Matheus</span>
          </div>
        </div>
      </header>

      {/* 2. Barra de Métricas em Cards + Filtros e Ações */}
      <div className="px-6 py-4 bg-[#171615] border-b border-[#2D2B28] shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-[#1E1D1B] border border-[#2D2B28]">
            <span className="text-[11px] text-[#A19A91]">Mesas ocupadas</span>
            <p className="text-xl font-bold text-[#F9F8F6] mt-0.5">{occupiedCount} <span className="text-xs text-[#A19A91] font-normal">mesas</span></p>
          </div>
          <div className="p-3 rounded-xl bg-[#1E1D1B] border border-[#2D2B28]">
            <span className="text-[11px] text-[#A19A91]">Pedindo conta</span>
            <p className="text-xl font-bold text-amber-400 mt-0.5">{billCount} <span className="text-xs text-amber-400/80 font-normal">urgente</span></p>
          </div>
          <div className="p-3 rounded-xl bg-[#1E1D1B] border border-[#2D2B28]">
            <span className="text-[11px] text-[#A19A91]">Mesas livres</span>
            <p className="text-xl font-bold text-[#2D6A4F] mt-0.5">{freeCount} <span className="text-xs text-[#A19A91] font-normal">disponíveis</span></p>
          </div>
          <div className="p-3 rounded-xl bg-[#1E1D1B] border border-[#2D2B28]">
            <span className="text-[11px] text-[#A19A91]">Total em aberto no salão</span>
            <p className="text-xl font-bold text-[#C84E1F] mt-0.5">R$ {totalOpenRevenue.toFixed(2).replace('.', ',')}</p>
          </div>
        </div>

        {/* Filtros de Mesa e Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === 'all'
                  ? 'bg-[#F9F8F6] text-[#141312]'
                  : 'bg-[#1E1D1B] border border-[#2D2B28] text-[#A19A91] hover:border-[#4A4742]'
              }`}
            >
              Todas ({tables.length})
            </button>
            <button
              onClick={() => setFilter('occupied')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === 'occupied'
                  ? 'bg-[#C84E1F] text-white'
                  : 'bg-[#1E1D1B] border border-[#2D2B28] text-[#A19A91] hover:border-[#4A4742]'
              }`}
            >
              Ocupadas ({occupiedCount})
            </button>
            <button
              onClick={() => setFilter('bill_requested')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === 'bill_requested'
                  ? 'bg-amber-500 text-stone-950 font-semibold'
                  : 'bg-[#1E1D1B] border border-[#2D2B28] text-amber-400 hover:border-amber-500/40'
              }`}
            >
              Pedindo conta ({billCount})
            </button>
            <button
              onClick={() => setFilter('free')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
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

            <button
              onClick={() => alert('Abrir nova mesa: selecione uma mesa livre no mapa.')}
              className="px-3 py-1.5 rounded-lg bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova mesa</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Grid Principal: Salão à Esquerda + Comanda Detalhada à Direita */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Lado Esquerdo: Grid Rico de Mesas */}
        <section className="flex-1 p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-[#2D2B28]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTables.map((table) => {
              const isSelected = selectedTable?.id === table.id;
              const isFree = table.status === 'free';
              const isBill = table.status === 'bill_requested';

              return (
                <div
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[160px] ${
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
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-[#F9F8F6]">Mesa {table.number}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {table.waiter_called && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 animate-pulse">
                            <Bell className="w-3 h-3 text-rose-400" />
                            Garçom!
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                            isBill
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
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
                      <div className="space-y-1.5 text-xs">
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
                          <span className="text-[#F9F8F6] font-medium">{table.items_count || 0} itens</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-[#6E6760] text-xs">
                        Mesa livre • Aguardando cliente
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenTable(table.number);
                      }}
                      className="w-full py-1.5 rounded bg-[#22201E] border border-[#2D2B28] hover:bg-[#2D2B28] text-xs text-[#F9F8F6] transition-colors cursor-pointer"
                    >
                      + Abrir mesa
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Lado Direito: Comanda Digital Completa & Fechamento */}
        <aside className="w-full lg:w-[420px] bg-[#181716] p-6 flex flex-col justify-between shrink-0 overflow-y-auto">
          {selectedTable && selectedTable.status !== 'free' ? (
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
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          selectedTable.status === 'bill_requested'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-[#C84E1F]/15 text-[#C84E1F]'
                        }`}>
                          {selectedTable.status === 'bill_requested' ? 'Pede conta' : 'Comanda ativa'}
                        </span>
                      </div>
                      <p className="text-xs text-[#A19A91] mt-1">
                        Atendente: <strong className="text-[#F9F8F6]">{selectedTable.waiter}</strong> • Aberta às {selectedTable.opened_at || 'Agora'}
                      </p>
                    </div>

                    <Link
                      href={`/table/${selectedTable.number}`}
                      target="_blank"
                      className="p-2 rounded-lg bg-[#22201E] border border-[#2D2B28] hover:border-[#4A4742] text-[#A19A91] hover:text-[#F9F8F6] transition-colors"
                      title="Abrir visão do cliente em nova aba"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>
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

                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
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
                    <span className="text-[#C84E1F]">R$ {grandTotal.toFixed(2).replace('.', ',')}</span>
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
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-[#A19A91] p-6">
              <div className="w-12 h-12 rounded-xl bg-[#22201E] border border-[#2D2B28] flex items-center justify-center text-[#A19A91] mb-3">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[#F9F8F6] mb-1">Nenhuma mesa ativa selecionada</h3>
              <p className="text-xs text-[#A19A91] max-w-xs mb-4">
                Selecione uma mesa ocupada no mapa para visualizar os itens consumidos, conferir a comanda ou registrar o pagamento.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Modal para Lançar Item na Comanda */}
      {showAddModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#1A1918] border border-[#2D2B28] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2D2B28]">
              <h3 className="text-base font-bold text-[#F9F8F6]">
                Lançar item na Mesa {selectedTable.number}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-[#A19A91] hover:text-[#F9F8F6]"
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
    </div>
  );
}
