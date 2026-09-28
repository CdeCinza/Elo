'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  getAuthUser,
  clearAuthSession,
  setActiveRestaurant,
  Restaurant,
  User,
} from '@/lib/auth';
import { useToast } from '@/components/ui/ToastProvider';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { maskDocument, maskPhone } from '@/lib/masks';
import {
  Store,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  LogOut,
  ShieldCheck,
  ExternalLink,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Grid,
  Phone,
  UserCheck,
  X,
  Building2,
} from 'lucide-react';

interface MetricsData {
  total_restaurants: number;
  active_restaurants: number;
  total_orders: number;
  total_revenue: number;
  total_users: number;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all');

  // Modal State - Cadastrar Restaurante
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    document: '',
    phone: '',
    address: '',
    initial_tables: 10,
    owner_name: '',
    owner_email: '',
    owner_password: '',
  });

  // Modal State - Exclusão Customizada (Sem window.confirm)
  const [restaurantToDelete, setRestaurantToDelete] = useState<Restaurant | null>(null);
useEscapeKey(isCreateModalOpen || !!restaurantToDelete, () => {    if (restaurantToDelete) setRestaurantToDelete(null);    else setIsCreateModalOpen(false);  });
  const [deleting, setDeleting] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [restRes, metricsRes] = await Promise.all([
        api.get('/superadmin/restaurants'),
        api.get('/superadmin/metrics'),
      ]);

      setRestaurants(restRes.data.restaurants || []);
      setMetrics(metricsRes.data.metrics || null);
    } catch (err) {
      console.error('Erro ao carregar dados do Super Admin:', err);
      toast.error('Erro de Conexão', 'Não foi possível carregar os dados dos restaurantes.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      const user = getAuthUser();
      if (!user || !user.is_super_admin) {
        router.push('/login');
        return;
      }
      setCurrentUser(user);
      void fetchDashboardData();
    }, 0);

    return () => clearTimeout(initialLoad);
  }, [router, fetchDashboardData]);

  const handleLogout = () => {
    clearAuthSession();
    toast.info('Sessão encerrada', 'Você saiu do sistema com segurança.');
    router.push('/login');
  };

  const handleAccessRestaurant = (restaurant: Restaurant) => {
    setActiveRestaurant(restaurant);
    toast.success('Restaurante Ativo', `Acessando painel operacional de ${restaurant.name}.`);
    router.push('/counter');
  };

  const handleToggleStatus = async (restaurant: Restaurant) => {
    const nextStatus = restaurant.status === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/superadmin/restaurants/${restaurant.id}`, {
        status: nextStatus,
      });
      toast.success(
        'Status Atualizado',
        `Restaurante ${restaurant.name} agora está ${nextStatus === 'active' ? 'Ativo' : 'Suspenso'}.`
      );
      fetchDashboardData();
    } catch {
      toast.error('Erro ao atualizar status', 'Não foi possível alterar o status do restaurante.');
    }
  };

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.owner_name || !formData.owner_email || !formData.owner_password) {
      toast.warning('Campos Obrigatórios', 'Preencha o nome do restaurante, dados do dono e senha inicial.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/superadmin/restaurants', formData);
      toast.success(
        'Restaurante Criado!',
        response.data.message || `O restaurante ${formData.name} foi criado com sucesso.`
      );
      setIsCreateModalOpen(false);
      setFormData({
        name: '',
        slug: '',
        document: '',
        phone: '',
        address: '',
        initial_tables: 10,
        owner_name: '',
        owner_email: '',
        owner_password: '',
      });
      fetchDashboardData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg =
        errorObj.response?.data?.message ||
        errorObj.response?.data?.errors?.owner_email?.[0] ||
        'Não foi possível criar o restaurante.';
      toast.error('Erro no cadastro', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRestaurant = async () => {
    if (!restaurantToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/superadmin/restaurants/${restaurantToDelete.id}`);
      toast.success('Restaurante Removido', `O restaurante ${restaurantToDelete.name} foi excluído.`);
      setRestaurantToDelete(null);
      fetchDashboardData();
    } catch {
      toast.error('Erro na Exclusão', 'Não foi possível remover este restaurante.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredRestaurants = restaurants.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase()) ||
      (r.owner?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.owner?.email || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ? true : r.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col selection:bg-[#C84E1F] selection:text-white font-sans antialiased">
      {/* Top Header Navigation */}
      <header className="border-b border-[#EAE6E1] bg-[#FFFFFF]/90 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C84E1F] text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-editorial font-bold text-[#191817] text-lg tracking-tight">ELO Platform</span>
                <span className="text-[10px] uppercase font-bold tracking-[0.12em] px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] text-[#78716A]">Gestão Global de Restaurantes & Franquias</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-[#191817]">{currentUser?.name || 'Administrador Geral'}</span>
              <span className="text-[11px] text-[#78716A]">{currentUser?.email || 'admin@elo.com'}</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-50 text-[#57534E] hover:text-[#191817] text-xs font-medium border border-[#E0DBD3] transition-colors cursor-pointer shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* KPI Metrics Summary */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#EAE6E1] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#78716A] uppercase tracking-[0.12em] font-semibold">Total Restaurantes</span>
              <div className="p-2 rounded-xl bg-stone-100 text-stone-700 border border-stone-200">
                <Store className="w-4 h-4" />
              </div>
            </div>
            <p className="font-editorial text-3xl font-semibold text-[#191817] mt-3">
              {metrics?.total_restaurants ?? restaurants.length}
            </p>
            <p className="text-xs text-[#78716A] mt-1">Cadastrados no sistema</p>
          </div>

          <div className="bg-white border border-[#EAE6E1] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#78716A] uppercase tracking-[0.12em] font-semibold">Em Operação</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="font-editorial text-3xl font-semibold text-emerald-800 mt-3">
              {metrics?.active_restaurants ?? restaurants.filter((r) => r.status === 'active').length}
            </p>
            <p className="text-xs text-emerald-700 mt-1">Status Ativo</p>
          </div>

          <div className="bg-white border border-[#EAE6E1] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#78716A] uppercase tracking-[0.12em] font-semibold">Pedidos Globais</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="font-editorial text-3xl font-semibold text-[#191817] mt-3">
              {metrics?.total_orders ?? 0}
            </p>
            <p className="text-xs text-[#78716A] mt-1">Processados na plataforma</p>
          </div>

          <div className="bg-white border border-[#EAE6E1] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#78716A] uppercase tracking-[0.12em] font-semibold">Receita Consolidada</span>
              <div className="p-2 rounded-xl bg-[#C84E1F]/10 text-[#C84E1F] border border-[#C84E1F]/20">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="font-editorial text-3xl font-semibold text-[#C84E1F] mt-3">
              R$ {(metrics?.total_revenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-[#78716A] mt-1">Volume total transacionado</p>
          </div>
        </section>

        {/* Action Header & Search Filter */}
        <section className="bg-white border border-[#EAE6E1] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-editorial text-2xl font-semibold text-[#191817]">Restaurantes & Estabelecimentos</h2>
              <p className="text-[#78716A] text-xs mt-0.5">
                Gerencie inquilinos, donos de restaurante (sub-administradores) e salão operacional.
              </p>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Novo Restaurante</span>
            </button>
          </div>

          {/* Search Bar & Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#A8A199] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                maxLength={60}
                value={search}
                onChange={(e) => setSearch(e.target.value.slice(0, 60))}
                placeholder="Buscar por nome, slug ou dono..."
                className="w-full bg-[#FAF8F5] border border-[#E0DBD3] rounded-xl pl-9 pr-8 py-2 text-xs text-[#191817] placeholder-[#A8A199] focus:outline-none focus:border-[#C84E1F] focus:bg-white transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A8A199] hover:text-[#191817] p-0.5 cursor-pointer"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto bg-[#FAF8F5] p-1 rounded-xl border border-[#EAE6E1]">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  filterStatus === 'all'
                    ? 'bg-white text-[#191817] shadow-xs font-semibold'
                    : 'text-[#78716A] hover:text-[#191817]'
                }`}
              >
                Todos ({restaurants.length})
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  filterStatus === 'active'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                    : 'text-[#78716A] hover:text-[#191817]'
                }`}
              >
                Ativos ({restaurants.filter((r) => r.status === 'active').length})
              </button>
              <button
                onClick={() => setFilterStatus('suspended')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  filterStatus === 'suspended'
                    ? 'bg-rose-50 text-rose-800 border border-rose-200 font-semibold'
                    : 'text-[#78716A] hover:text-[#191817]'
                }`}
              >
                Suspensos ({restaurants.filter((r) => r.status === 'suspended').length})
              </button>
            </div>
          </div>
        </section>

        {/* Restaurants List Table */}
        <section className="bg-white border border-[#EAE6E1] rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 text-[#C84E1F] animate-spin" />
              <p className="text-xs text-[#78716A]">Carregando restaurantes e métricas...</p>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="py-16 text-center">
              <Store className="w-10 h-10 text-[#C4BDB5] mx-auto mb-3" />
              <p className="text-sm font-medium text-[#191817]">Nenhum restaurante encontrado</p>
              <p className="text-xs text-[#78716A] mt-1">
                {search ? 'Tente ajustar sua busca por texto.' : 'Clique em "Cadastrar Novo Restaurante" para começar.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#EAE6E1] bg-[#FAF8F5] text-[#78716A] uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-3.5 px-4 sm:px-6">Restaurante</th>
                    <th className="py-3.5 px-4">Sub-Admin (Dono)</th>
                    <th className="py-3.5 px-4 text-center">Mesas</th>
                    <th className="py-3.5 px-4 text-center">Pedidos</th>
                    <th className="py-3.5 px-4 text-right">Faturamento</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE6E1]">
                  {filteredRestaurants.map((restaurant) => (
                    <tr key={restaurant.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                      {/* Restaurant Info */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] flex items-center justify-center text-[#191817] font-editorial font-bold text-sm">
                            {restaurant.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-[#191817] text-sm">{restaurant.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[#78716A] font-mono text-[11px]">/{restaurant.slug}</span>
                              {restaurant.phone && (
                                <span className="text-[#78716A] text-[11px] flex items-center gap-1">
                                  • <Phone className="w-3 h-3" /> {restaurant.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Owner Sub-Admin */}
                      <td className="py-4 px-4">
                        {restaurant.owner ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                              <span className="font-medium text-[#191817]">{restaurant.owner.name}</span>
                            </div>
                            <span className="text-[#78716A] text-[11px] block mt-0.5">{restaurant.owner.email}</span>
                          </div>
                        ) : (
                          <span className="text-[#A8A199] italic">Sem dono vinculado</span>
                        )}
                      </td>

                      {/* Tables Count */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#E0DBD3] text-[#57534E] font-mono">
                          <Grid className="w-3 h-3 text-[#A8A199]" />
                          {restaurant.tables_count ?? 0}
                        </span>
                      </td>

                      {/* Orders Count */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-mono text-[#57534E]">
                          {restaurant.orders_count ?? 0}
                        </span>
                      </td>

                      {/* Revenue */}
                      <td className="py-4 px-4 text-right font-semibold text-[#191817] font-mono">
                        R$ {(restaurant.total_revenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(restaurant)}
                          title="Clique para alternar status"
                          className="cursor-pointer"
                        >
                          {restaurant.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium hover:bg-emerald-100 transition-colors">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-medium hover:bg-rose-100 transition-colors">
                              <XCircle className="w-3 h-3 text-rose-600" /> Suspenso
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAccessRestaurant(restaurant)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#C84E1F] text-[#191817] hover:text-white border border-[#E0DBD3] hover:border-[#C84E1F] text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                            title="Entrar na operação deste restaurante"
                          >
                            <span>Acessar Salão</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => setRestaurantToDelete(restaurant)}
                            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-[#A8A199] hover:text-rose-600 border border-[#E0DBD3] hover:border-rose-200 transition-colors cursor-pointer shadow-2xs"
                            title="Excluir Restaurante"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* MODAL: Cadastrar Novo Restaurante + Dono Sub-Admin */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#EAE6E1] rounded-2xl w-full max-w-xl shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#EAE6E1] flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#C84E1F]/10 text-[#C84E1F]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-editorial text-lg font-semibold text-[#191817]">Cadastrar Novo Restaurante</h3>
                  <p className="text-xs text-[#78716A]">Criar restaurante e credenciais do Sub-Administrador</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-[#78716A] hover:text-[#191817] hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateRestaurant} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Section 1: Dados do Restaurante */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C84E1F] mb-3 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#C84E1F]" /> Informações do Estabelecimento
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#44403C] mb-1">Nome do Restaurante *</label>
                    <input
                      type="text"
                      required
                      maxLength={70}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value.slice(0, 70) })}
                      placeholder="Ex: Cantina do Chef, ELO Jardins"
                      className="w-full bg-[#FAF8F5] border border-[#E0DBD3] rounded-xl px-3.5 py-2.5 text-xs text-[#191817] placeholder-[#A8A199] focus:outline-none focus:border-[#C84E1F] focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#44403C] mb-1">CNPJ / Documento</label>
                    <input
                      type="text"
                      maxLength={18}
                      value={formData.document}
                      onChange={(e) => setFormData({ ...formData, document: maskDocument(e.target.value) })}
                      placeholder="00.000.000/0001-00"
                      className="w-full bg-[#FAF8F5] border border-[#E0DBD3] rounded-xl px-3.5 py-2.5 text-xs text-[#191817] placeholder-[#A8A199] focus:outline-none focus:border-[#C84E1F] focus:bg-white transition-colors font-mono tracking-tight"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#44403C] mb-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                      placeholder="(11) 99999-8888"
                      className="w-full bg-[#FAF8F5] border border-[#E0DBD3] rounded-xl px-3.5 py-2.5 text-xs text-[#191817] placeholder-[#A8A199] focus:outline-none focus:border-[#C84E1F] focus:bg-white transition-colors font-mono tracking-tight"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#44403C] mb-1">Endereço Completo</label>
                    <input
                      type="text"
                      maxLength={120}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value.slice(0, 120) })}
                      placeholder="Rua Oscar Freire, 1200 - Jardins, SP"
                      className="w-full bg-[#FAF8F5] border border-[#E0DBD3] rounded-xl px-3.5 py-2.5 text-xs text-[#191817] placeholder-[#A8A199] focus:outline-none focus:border-[#C84E1F] focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#44403C] mb-1">Mesas Iniciais do Salão</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={formData.initial_tables || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setFormData({ ...formData, initial_tables: isNaN(val) ? 0 : Math.min(Math.max(val, 0), 100) });
                      }}
                      className="w-full bg-[#FAF8F5] border border-[#E0DBD3] rounded-xl px-3.5 py-2.5 text-xs text-[#191817] focus:outline-none focus:border-[#C84E1F] focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Administrador do Restaurante */}
              <div className="pt-4 border-t border-[#EAE6E1]">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 mb-3 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-amber-600" /> Administrador Responsável (Sub-Admin)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#44403C] mb-1">Nome do Dono / Gerente *</label>
                    <input
                      type="text"
                      required
                      maxLength={70}
                      value={formData.owner_name}
                      onChange={(e) => setFormData({ ...formData, owner_name: e.target.value.slice(0, 70) })}
                      placeholder="Ex: Matheus Oliveira"
                      className="w-full bg-[#FAF8F5] border border-[#E0DBD3] rounded-xl px-3.5 py-2.5 text-xs text-[#191817] placeholder-[#A8A199] focus:outline-none focus:border-[#C84E1F] focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#44403C] mb-1">E-mail de Acesso *</label>
                    <input
                      type="email"
                      required
                      maxLength={80}
                      value={formData.owner_email}
                      onChange={(e) => setFormData({ ...formData, owner_email: e.target.value.slice(0, 80) })}
                      placeholder="dono@restaurante.com"
                      className="w-full bg-[#FAF8F5] border border-[#E0DBD3] rounded-xl px-3.5 py-2.5 text-xs text-[#191817] placeholder-[#A8A199] focus:outline-none focus:border-[#C84E1F] focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#44403C] mb-1">Senha Inicial *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      maxLength={32}
                      value={formData.owner_password}
                      onChange={(e) => setFormData({ ...formData, owner_password: e.target.value.slice(0, 32) })}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-[#FAF8F5] border border-[#E0DBD3] rounded-xl px-3.5 py-2.5 text-xs text-[#191817] placeholder-[#A8A199] focus:outline-none focus:border-[#C84E1F] focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-[#EAE6E1] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-[#57534E] text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-60 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Cadastrando...' : 'Cadastrar Restaurante & Dono'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Exclusão Customizada */}
      {restaurantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#EAE6E1] rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-editorial text-lg font-semibold text-[#191817]">Excluir Restaurante</h3>
              <p className="text-xs text-[#78716A]">
                Tem certeza que deseja remover o restaurante{' '}
                <strong className="text-[#191817]">{restaurantToDelete.name}</strong>?
              </p>
              <p className="text-[11px] text-rose-600/90 pt-1">
                Esta ação removerá mesas, produtos, histórico e usuários vinculados a este restaurante.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRestaurantToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-[#57534E] text-xs font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteRestaurant}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleting ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
