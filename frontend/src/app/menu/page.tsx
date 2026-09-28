'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChefHat,
  Eye,
  EyeOff,
  ImageOff,
  LayoutGrid,
  LogOut,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Store,
  Tags,
  Trash2,
} from 'lucide-react';
import { api, getApiErrorMessage, signOut } from '@/lib/api';
import { getActiveRestaurant, getAuthUser, Restaurant, User } from '@/lib/auth';
import { CatalogCategory, CatalogIngredient, CatalogProduct, fetchCatalog, formatDecimalInput } from '@/lib/catalog';
import { formatBRL } from '@/lib/format';
import { toast } from '@/components/ui/ToastProvider';
import { CatalogModal, primaryButtonClass, secondaryButtonClass } from '@/components/catalog/CatalogModal';
import { ProductFormModal } from '@/components/catalog/ProductFormModal';
import { CategoryFormModal } from '@/components/catalog/CategoryFormModal';
import { IngredientFormModal } from '@/components/catalog/IngredientFormModal';

type CatalogTab = 'products' | 'categories' | 'ingredients';

type PendingDeletion =
  | { kind: 'product'; item: CatalogProduct }
  | { kind: 'category'; item: CatalogCategory }
  | { kind: 'ingredient'; item: CatalogIngredient };

const MANAGER_ROLES = ['owner', 'restaurant_admin', 'manager', 'super_admin'];

// Produtos com troca de disponibilidade em andamento (bloqueia toques repetidos antes do re-render)
const togglesInFlight = new Set<number>();
const deletionInFlight = { active: false };

export default function MenuManagementPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [ingredients, setIngredients] = useState<CatalogIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'forbidden' | 'network' | null>(null);

  const [activeTab, setActiveTab] = useState<CatalogTab>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');

  const [productForm, setProductForm] = useState<{ product: CatalogProduct | null } | null>(null);
  const [categoryForm, setCategoryForm] = useState<{ category: CatalogCategory | null } | null>(null);
  const [ingredientForm, setIngredientForm] = useState<{ ingredient: CatalogIngredient | null } | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const roleName = authUser?.is_super_admin ? 'super_admin' : authUser?.role?.name ?? '';
  const canManage = MANAGER_ROLES.includes(roleName);
  const needsRestaurantSelection = !!authUser?.is_super_admin && !restaurant;

  const loadCatalog = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const catalog = await fetchCatalog();
      setCategories(catalog.categories);
      setProducts(catalog.products);
      setIngredients(catalog.ingredients);
      setLoadError(null);
    } catch (error) {
      setLoadError(isAxiosError(error) && error.response?.status === 403 ? 'forbidden' : 'network');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      const user = getAuthUser();
      if (!user) {
        router.replace('/login?redirect=%2Fmenu');
        return;
      }
      const activeRestaurant = getActiveRestaurant() ?? user.restaurant;
      setAuthUser(user);
      setRestaurant(activeRestaurant);
      setSessionChecked(true);

      const role = user.is_super_admin ? 'super_admin' : user.role?.name ?? '';
      if (MANAGER_ROLES.includes(role) && activeRestaurant) {
        void loadCatalog();
      } else {
        setLoading(false);
      }
    }, 0);

    return () => clearTimeout(initialLoad);
  }, [router, loadCatalog]);

  const handleSaved = (message: string) => {
    setProductForm(null);
    setCategoryForm(null);
    setIngredientForm(null);
    toast.success('Cardápio atualizado', message);
    void loadCatalog(true);
  };

  const handleToggleAvailability = async (product: CatalogProduct) => {
    if (togglesInFlight.has(product.id)) return;
    togglesInFlight.add(product.id);
    const nextAvailable = !product.available;
    setProducts((current) => current.map((p) => (p.id === product.id ? { ...p, available: nextAvailable } : p)));
    try {
      await api.put(`/products/${product.id}`, { available: nextAvailable });
      toast.info(nextAvailable ? 'Prato disponível' : 'Prato pausado', `${product.name} ${nextAvailable ? 'voltou ao' : 'saiu do'} tablet.`);
    } catch (error) {
      setProducts((current) => current.map((p) => (p.id === product.id ? { ...p, available: product.available } : p)));
      toast.error('Não foi possível alterar', getApiErrorMessage(error, 'Tente novamente.'));
    } finally {
      togglesInFlight.delete(product.id);
    }
  };

  const handleToggleCategoryVisibility = async (category: CatalogCategory) => {
    try {
      await api.put(`/categories/${category.id}`, { is_active: !category.is_active });
      toast.info(
        category.is_active ? 'Categoria oculta' : 'Categoria visível',
        category.is_active ? `${category.name} não aparece mais no tablet.` : `${category.name} voltou ao tablet.`
      );
      void loadCatalog(true);
    } catch (error) {
      toast.error('Não foi possível alterar', getApiErrorMessage(error, 'Tente novamente.'));
    }
  };

  const handleConfirmDeletion = async () => {
    if (!pendingDeletion || deletionInFlight.active) return;
    deletionInFlight.active = true;
    const endpoint = { product: 'products', category: 'categories', ingredient: 'ingredients' }[pendingDeletion.kind];
    setDeleting(true);
    try {
      await api.delete(`/${endpoint}/${pendingDeletion.item.id}`);
      toast.success('Removido', `${pendingDeletion.item.name} foi excluído.`);
      setPendingDeletion(null);
      void loadCatalog(true);
    } catch (error) {
      toast.error('Não foi possível excluir', getApiErrorMessage(error, 'Tente novamente.'));
    } finally {
      deletionInFlight.active = false;
      setDeleting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
      const matchesSearch =
        query === '' ||
        product.name.toLowerCase().includes(query) ||
        (product.description ?? '').toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [products, searchQuery, categoryFilter]);

  const lowStockCount = ingredients.filter((ingredient) => ingredient.is_low_stock).length;
  const availableCount = products.filter((product) => product.available).length;
  const isEmptyMenu = !loading && !loadError && products.length === 0;

  const openNewProduct = () => {
    if (categories.length === 0) {
      toast.warning('Crie uma categoria primeiro', 'Todo prato precisa de uma categoria, como “Entradas” ou “Bebidas”.');
      setActiveTab('categories');
      setCategoryForm({ category: null });
      return;
    }
    setProductForm({ product: null });
  };

  const renderBlockingState = () => {
    if (!sessionChecked) return null;

    if (!canManage) {
      return (
        <BlockingMessage
          title="Seu perfil não edita o cardápio"
          description="O cardápio e o estoque são gerenciados pelo dono ou pela gerência do restaurante."
          action={<Link href="/counter" className={primaryButtonClass}>Voltar ao caixa</Link>}
        />
      );
    }

    if (needsRestaurantSelection) {
      return (
        <BlockingMessage
          title="Escolha um restaurante"
          description="Como administrador da plataforma, acesse um restaurante pelo painel para editar o cardápio dele."
          action={<Link href="/superadmin" className={primaryButtonClass}>Abrir painel de restaurantes</Link>}
        />
      );
    }

    if (loadError) {
      return (
        <BlockingMessage
          title={loadError === 'forbidden' ? 'Acesso negado ao cardápio' : 'Não foi possível carregar o cardápio'}
          description={loadError === 'forbidden' ? 'Entre com uma conta da gerência.' : 'Verifique a conexão com o servidor e tente novamente.'}
          action={
            <button type="button" onClick={() => void loadCatalog()} className={primaryButtonClass}>
              Tentar novamente
            </button>
          }
        />
      );
    }

    return null;
  };

  const blockingState = renderBlockingState();

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col font-sans antialiased selection:bg-[#C84E1F] selection:text-white">
      {/* Cabeçalho */}
      <header className="h-16 px-4 sm:px-6 gap-2 bg-white border-b border-[#EAE6E1] flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-[#191817]">ELO</span>
            <span className="hidden sm:inline text-xs text-[#78716A] border-l border-[#E0DBD3] pl-3">Cardápio & Estoque</span>
          </Link>
          {restaurant && (
            <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
              <Store className="w-3.5 h-3.5 text-amber-700" />
              {restaurant.name}
            </span>
          )}
        </div>

        <nav className="flex items-center gap-2" aria-label="Áreas do sistema">
          <Link
            href="/counter"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#57534E] hover:text-[#191817] hover:border-[#C84E1F] transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#C84E1F]" />
            <span className="hidden sm:inline">Caixa</span>
          </Link>
          <Link
            href="/kitchen"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#E0DBD3] text-xs text-[#57534E] hover:text-[#191817] hover:border-[#C84E1F] transition-colors"
          >
            <ChefHat className="w-3.5 h-3.5 text-[#C84E1F]" />
            <span className="hidden sm:inline">Cozinha</span>
          </Link>
          <button
            type="button"
            onClick={() => void signOut().then(() => router.push('/login'))}
            title="Sair do sistema"
            aria-label="Sair do sistema"
            className="p-1.5 rounded-lg bg-white border border-[#E0DBD3] hover:text-rose-600 text-[#78716A] transition-colors shadow-2xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </nav>
      </header>

      {blockingState ?? (
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Título e métricas */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-serif font-bold tracking-tight">Cardápio do restaurante</h1>
              <p className="text-xs text-[#78716A] mt-1">
                Tudo o que você salvar aqui aparece na hora no tablet das mesas e no caixa.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:w-auto">
              <Metric label="Pratos à venda" value={`${availableCount}/${products.length}`} />
              <Metric label="Categorias" value={String(categories.length)} />
              <Metric label="Estoque baixo" value={String(lowStockCount)} tone={lowStockCount > 0 ? 'warning' : 'neutral'} />
            </div>
          </div>

          {/* Primeiros passos para restaurante novo */}
          {isEmptyMenu && (
            <section aria-label="Primeiros passos" className="p-5 rounded-2xl bg-white border border-[#EAE6E1] shadow-xs">
              <h2 className="text-sm font-bold text-[#191817]">Monte seu cardápio em 3 passos</h2>
              <p className="text-xs text-[#78716A] mt-0.5 mb-4">Enquanto não houver pratos, o tablet das mesas fica vazio.</p>
              <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <OnboardingStep
                  index={1}
                  done={categories.length > 0}
                  title="Crie as categorias"
                  description="Ex.: Entradas, Pratos, Bebidas, Sobremesas."
                  actionLabel="Nova categoria"
                  onAction={() => {
                    setActiveTab('categories');
                    setCategoryForm({ category: null });
                  }}
                />
                <OnboardingStep
                  index={2}
                  done={ingredients.length > 0}
                  optional
                  title="Cadastre o estoque"
                  description="Ingredientes com quantidade para baixa automática."
                  actionLabel="Novo ingrediente"
                  onAction={() => {
                    setActiveTab('ingredients');
                    setIngredientForm({ ingredient: null });
                  }}
                />
                <OnboardingStep
                  index={3}
                  done={false}
                  title="Adicione os pratos"
                  description="Nome, preço, foto e ficha técnica."
                  actionLabel="Novo prato"
                  onAction={openNewProduct}
                />
              </ol>
            </section>
          )}

          {/* Abas */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div role="tablist" aria-label="Seções do cardápio" className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#EAE6E1] w-full sm:w-auto overflow-x-auto no-scrollbar">
              <TabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')} icon={<BookOpen className="w-3.5 h-3.5" />} label={`Pratos (${products.length})`} />
              <TabButton active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} icon={<Tags className="w-3.5 h-3.5" />} label={`Categorias (${categories.length})`} />
              <TabButton
                active={activeTab === 'ingredients'}
                onClick={() => setActiveTab('ingredients')}
                icon={<Package className="w-3.5 h-3.5" />}
                label={`Estoque (${ingredients.length})`}
                badge={lowStockCount > 0 ? lowStockCount : undefined}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadCatalog()}
                aria-label="Atualizar cardápio"
                title="Atualizar"
                className="p-2.5 rounded-xl bg-white border border-[#E0DBD3] text-[#78716A] hover:text-[#191817] cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C84E1F]' : ''}`} />
              </button>
              {activeTab === 'products' && (
                <button type="button" onClick={openNewProduct} className={`${primaryButtonClass} flex items-center gap-1.5`}>
                  <Plus className="w-3.5 h-3.5" /> Novo prato
                </button>
              )}
              {activeTab === 'categories' && (
                <button type="button" onClick={() => setCategoryForm({ category: null })} className={`${primaryButtonClass} flex items-center gap-1.5`}>
                  <Plus className="w-3.5 h-3.5" /> Nova categoria
                </button>
              )}
              {activeTab === 'ingredients' && (
                <button type="button" onClick={() => setIngredientForm({ ingredient: null })} className={`${primaryButtonClass} flex items-center gap-1.5`}>
                  <Plus className="w-3.5 h-3.5" /> Novo ingrediente
                </button>
              )}
            </div>
          </div>

          {loading && products.length === 0 && categories.length === 0 ? (
            <div className="py-20 text-center text-xs text-[#78716A]">Carregando cardápio...</div>
          ) : (
            <>
              {/* Pratos */}
              {activeTab === 'products' && (
                <section aria-label="Pratos" className="space-y-3">
                  {products.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A199]" />
                        <input
                          type="search"
                          aria-label="Buscar prato"
                          placeholder="Buscar prato pelo nome ou descrição..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-white border border-[#E0DBD3] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#191817] placeholder-[#A8A199] focus:outline-none focus:border-[#C84E1F]"
                        />
                      </div>
                      <select
                        aria-label="Filtrar por categoria"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="bg-white border border-[#E0DBD3] rounded-xl px-3 py-2.5 text-xs text-[#191817] focus:outline-none focus:border-[#C84E1F]"
                      >
                        <option value="all">Todas as categorias</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {products.length > 0 && filteredProducts.length === 0 && (
                    <p className="py-12 text-center text-xs text-[#78716A]">Nenhum prato encontrado com esse filtro.</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredProducts.map((product) => {
                      const category = categories.find((c) => c.id === product.category_id);
                      const hiddenByCategory = category ? !category.is_active : false;
                      return (
                        <article
                          key={product.id}
                          className={`p-3.5 rounded-2xl bg-white border flex gap-3 transition-colors ${
                            product.available ? 'border-[#EAE6E1]' : 'border-dashed border-[#D4CEC5] bg-[#FAF8F5]'
                          }`}
                        >
                          <div className="w-20 h-20 rounded-xl overflow-hidden border border-[#EAE6E1] bg-[#FAF8F5] shrink-0 flex items-center justify-center">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className={`w-full h-full object-cover ${product.available ? '' : 'grayscale opacity-60'}`} />
                            ) : (
                              <ImageOff className="w-5 h-5 text-[#A8A199]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm font-bold text-[#191817] truncate">{product.name}</h3>
                                <span className="text-sm font-bold text-[#191817] shrink-0">{formatBRL(product.price)}</span>
                              </div>
                              <p className="text-[11px] text-[#78716A] mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span>{product.category_name ?? category?.name ?? 'Sem categoria'}</span>
                                {hiddenByCategory && <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">categoria oculta</span>}
                                {(product.ingredients?.length ?? 0) > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">
                                    ficha técnica: {product.ingredients?.length} {product.ingredients?.length === 1 ? 'item' : 'itens'}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-2">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={product.available}
                                aria-label={`Disponível para pedidos: ${product.name}`}
                                onClick={() => void handleToggleAvailability(product)}
                                className="flex items-center gap-2 text-[11px] font-medium cursor-pointer"
                              >
                                <span className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${product.available ? 'bg-emerald-600' : 'bg-[#D4CEC5]'}`}>
                                  <span className={`block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${product.available ? 'translate-x-3.5' : ''}`} />
                                </span>
                                <span className={product.available ? 'text-emerald-800' : 'text-[#78716A]'}>
                                  {product.available ? 'À venda' : 'Pausado'}
                                </span>
                              </button>
                              <div className="flex items-center gap-1">
                                <IconButton label={`Editar ${product.name}`} onClick={() => setProductForm({ product })}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </IconButton>
                                <IconButton label={`Excluir ${product.name}`} tone="danger" onClick={() => setPendingDeletion({ kind: 'product', item: product })}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </IconButton>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Categorias */}
              {activeTab === 'categories' && (
                <section aria-label="Categorias" className="bg-white rounded-2xl border border-[#EAE6E1] divide-y divide-[#F2EFEA]">
                  {categories.length === 0 && (
                    <p className="py-12 text-center text-xs text-[#78716A]">Nenhuma categoria ainda. Crie a primeira para começar.</p>
                  )}
                  {categories.map((category) => (
                    <div key={category.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className={`text-sm font-semibold ${category.is_active ? 'text-[#191817]' : 'text-[#A8A199]'}`}>{category.name}</h3>
                        <p className="text-[11px] text-[#78716A] truncate">
                          {category.products_count ?? 0} {category.products_count === 1 ? 'prato' : 'pratos'}
                          {category.description ? ` • ${category.description}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleToggleCategoryVisibility(category)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer ${
                            category.is_active ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-stone-100 border-stone-200 text-stone-600'
                          }`}
                          aria-label={category.is_active ? `Ocultar ${category.name} do tablet` : `Mostrar ${category.name} no tablet`}
                        >
                          {category.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">{category.is_active ? 'Visível' : 'Oculta'}</span>
                        </button>
                        <IconButton label={`Editar ${category.name}`} onClick={() => setCategoryForm({ category })}>
                          <Pencil className="w-3.5 h-3.5" />
                        </IconButton>
                        <IconButton label={`Excluir ${category.name}`} tone="danger" onClick={() => setPendingDeletion({ kind: 'category', item: category })}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {/* Estoque */}
              {activeTab === 'ingredients' && (
                <section aria-label="Estoque" className="bg-white rounded-2xl border border-[#EAE6E1] divide-y divide-[#F2EFEA]">
                  {ingredients.length === 0 && (
                    <p className="py-12 text-center text-xs text-[#78716A]">
                      Nenhum ingrediente cadastrado. O estoque é opcional, mas permite a baixa automática pela ficha técnica.
                    </p>
                  )}
                  {ingredients.map((ingredient) => (
                    <div key={ingredient.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#191817] flex items-center gap-2">
                          <span className="truncate">{ingredient.name}</span>
                          {ingredient.is_low_stock && (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                              <AlertTriangle className="w-3 h-3" /> Estoque baixo
                            </span>
                          )}
                        </h3>
                        <p className="text-[11px] text-[#78716A]">
                          Alerta abaixo de {formatDecimalInput(ingredient.min_stock_alert, 3)} {ingredient.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-sm font-bold ${ingredient.is_low_stock ? 'text-amber-800' : 'text-[#191817]'}`}>
                          {formatDecimalInput(ingredient.stock_qty, 3)} <span className="text-xs font-normal text-[#78716A]">{ingredient.unit}</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <IconButton label={`Ajustar ${ingredient.name}`} onClick={() => setIngredientForm({ ingredient })}>
                            <Pencil className="w-3.5 h-3.5" />
                          </IconButton>
                          <IconButton label={`Excluir ${ingredient.name}`} tone="danger" onClick={() => setPendingDeletion({ kind: 'ingredient', item: ingredient })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </main>
      )}

      {productForm && (
        <ProductFormModal
          key={productForm.product?.id ?? 'new'}
          product={productForm.product}
          categories={categories}
          ingredients={ingredients}
          defaultCategoryId={categoryFilter === 'all' ? undefined : categoryFilter}
          onClose={() => setProductForm(null)}
          onSaved={handleSaved}
        />
      )}
      {categoryForm && (
        <CategoryFormModal key={categoryForm.category?.id ?? 'new'} category={categoryForm.category} onClose={() => setCategoryForm(null)} onSaved={handleSaved} />
      )}
      {ingredientForm && (
        <IngredientFormModal
          key={ingredientForm.ingredient?.id ?? 'new'}
          ingredient={ingredientForm.ingredient}
          onClose={() => setIngredientForm(null)}
          onSaved={handleSaved}
        />
      )}

      <CatalogModal
        isOpen={!!pendingDeletion}
        isBusy={deleting}
        onClose={() => setPendingDeletion(null)}
        title={`Excluir ${pendingDeletion?.item.name ?? ''}?`}
        subtitle={
          pendingDeletion?.kind === 'product'
            ? 'Se o prato já foi vendido, prefira pausá-lo: o histórico de pedidos é preservado.'
            : pendingDeletion?.kind === 'category'
            ? 'Os pratos desta categoria também deixam de existir. Para esconder temporariamente, oculte a categoria.'
            : 'O ingrediente sai das fichas técnicas que o utilizam.'
        }
      >
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setPendingDeletion(null)} disabled={deleting} className={secondaryButtonClass}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleConfirmDeletion()}
            disabled={deleting}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            {deleting ? 'Excluindo...' : 'Sim, excluir'}
          </button>
        </div>
      </CatalogModal>
    </div>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'warning' }) {
  return (
    <div className={`px-3 py-2 rounded-xl border ${tone === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#EAE6E1]'}`}>
      <p className={`text-[10px] font-medium ${tone === 'warning' ? 'text-amber-800' : 'text-[#78716A]'}`}>{label}</p>
      <p className={`text-base font-bold ${tone === 'warning' ? 'text-amber-900' : 'text-[#191817]'}`}>{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors cursor-pointer ${
        active ? 'bg-[#191817] text-white font-semibold' : 'text-[#78716A] hover:text-[#191817]'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="ml-0.5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold" aria-label={`${badge} com estoque baixo`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function IconButton({ label, onClick, tone = 'neutral', children }: { label: string; onClick: () => void; tone?: 'neutral' | 'danger'; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`p-2 rounded-lg border border-[#E0DBD3] bg-[#FAF8F5] text-[#78716A] transition-colors cursor-pointer ${
        tone === 'danger' ? 'hover:text-rose-600 hover:border-rose-300' : 'hover:text-[#191817] hover:border-[#191817]/40'
      }`}
    >
      {children}
    </button>
  );
}

function OnboardingStep({
  index,
  done,
  optional = false,
  title,
  description,
  actionLabel,
  onAction,
}: {
  index: number;
  done: boolean;
  optional?: boolean;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <li className={`p-4 rounded-xl border ${done ? 'bg-emerald-50/60 border-emerald-200' : 'bg-[#FAF8F5] border-[#E0DBD3]'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
            done ? 'bg-emerald-600 text-white' : 'bg-[#191817] text-white'
          }`}
        >
          {done ? <Check className="w-3 h-3" /> : index}
        </span>
        <h3 className="text-xs font-bold text-[#191817]">
          {title}
          {optional && <span className="font-normal text-[#78716A]"> (opcional)</span>}
        </h3>
      </div>
      <p className="text-[11px] text-[#78716A] mb-3">{description}</p>
      <button type="button" onClick={onAction} className="text-xs text-[#C84E1F] hover:underline font-semibold cursor-pointer">
        {actionLabel} →
      </button>
    </li>
  );
}

function BlockingMessage({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[#EAE6E1] flex items-center justify-center mb-4 shadow-xs">
        <AlertTriangle className="w-6 h-6 text-[#C84E1F]" />
      </div>
      <h1 className="text-base font-semibold text-[#191817] mb-1">{title}</h1>
      <p className="text-xs text-[#78716A] max-w-sm mb-6">{description}</p>
      {action}
    </main>
  );
}
