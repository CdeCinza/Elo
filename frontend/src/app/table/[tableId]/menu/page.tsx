'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { SalonHeader } from '@/components/customer/SalonHeader';
import { Search, Plus, ArrowLeft, Check, ShoppingBag } from 'lucide-react';
import { formatBRL } from '@/lib/format';
import Link from 'next/link';
import { toast } from '@/components/ui/ToastProvider';
import { Modal } from '@/components/ui/Modal';
import { ProductImage } from '@/components/ui/ProductImage';

import { useCustomerSession, type Product as ApiProduct } from '@/hooks/useCustomerSession';

type MenuProduct = ApiProduct & {
  customizations?: {
    meats?: string[];
    extras?: { name: string; price: number }[];
  };
};

export default function MenuPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tableId = (params?.tableId as string) || '01';
  const { categories, products, loading, error, sendOrder, table, refresh } = useCustomerSession(tableId);

  const selectedCategoryId = searchParams.get('category');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProduct, setActiveProduct] = useState<MenuProduct | null>(null);

  // Estados do Modal de Customização
  const [selectedMeat, setSelectedMeat] = useState<string>('');
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [observations, setObservations] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Abre direto o prato escolhido nas sugestões da página inicial (?product=ID)
  const requestedProductId = searchParams.get('product');
  const openedRequestedProductRef = useRef(false);
  useEffect(() => {
    if (!requestedProductId || openedRequestedProductRef.current || products.length === 0) return;
    const requestedProduct = products.find((product) => String(product.id) === requestedProductId && product.available);
    if (!requestedProduct) return;
    const openTimer = setTimeout(() => {
      openedRequestedProductRef.current = true;
      setActiveProduct(requestedProduct);
      setSelectedMeat((requestedProduct as MenuProduct).customizations?.meats?.[0] ?? '');
      setSelectedExtras([]);
      setObservations('');
    }, 0);
    return () => clearTimeout(openTimer);
  }, [requestedProductId, products]);

  const handleOpenCustomizer = (product: MenuProduct) => {
    setActiveProduct(product);
    setSelectedMeat(product.customizations?.meats?.[0] ?? '');
    setSelectedExtras([]);
    setObservations('');
    setQuantity(1);
  };

  const handleToggleExtra = (extraName: string) => {
    setSelectedExtras((prev) =>
      prev.includes(extraName) ? prev.filter((e) => e !== extraName) : [...prev, extraName]
    );
  };

  const handleAddToCart = async () => {
    if (!activeProduct) return;
    setSubmitting(true);

    const notes = [
      selectedMeat ? `Ponto: ${selectedMeat}` : '',
      selectedExtras.length > 0 ? `Extras: ${selectedExtras.join(', ')}` : '',
      observations ? `Obs: ${observations}` : '',
    ]
      .filter(Boolean)
      .join(' • ');

    const res = await sendOrder([
      {
        product_id: activeProduct.id,
        quantity,
        notes: notes || undefined,
      },
    ]);

    if (res.duplicate) return;
    setSubmitting(false);
    if (res.success) {
      toast.success('Pedido Realizado', `${activeProduct.name} enviado para a cozinha!`);
      setActiveProduct(null);
    } else {
      toast.warning('Atenção', res.message || 'Não foi possível enviar o item.');
    }
  };

  const availableProducts: MenuProduct[] = products.filter((product) => product.available);
  const categoryOptions = [{ id: null, name: 'Todos' }, ...categories];

  const filteredProducts = availableProducts.filter((product) => {
    const matchesCategory =
      selectedCategoryId === null || String(product.category_id) === selectedCategoryId;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const extrasTotal = activeProduct?.customizations?.extras
    ? activeProduct.customizations.extras
        .filter((e: { name: string; price: number }) => selectedExtras.includes(e.name))
        .reduce((sum: number, e: { name: string; price: number }) => sum + e.price, 0)
    : 0;
  const currentModalTotal = ((Number(activeProduct?.price) || 0) + extrasTotal) * quantity;

  const activeItemsCount = table?.active_order?.items?.length || 0;

  return (
    <div className="elo-interface min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col justify-between selection:bg-[#C84E1F]/15">
      <div>
        <SalonHeader
          tableNumber={tableId}
          tableStatus={error ? 'Indisponível' : loading ? 'Carregando' : table?.status === 'bill_requested' ? 'Conta solicitada' : table?.status === 'occupied' ? 'Mesa ocupada' : 'Mesa livre'}
        />

        {/* Barra Superior de Retorno & Busca */}
        <div className="sticky top-[57px] z-20 bg-[#F9F8F6]/95 backdrop-blur-md border-b border-[#EAE6E1] px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Link
              href={`/table/${tableId}`}
              className="p-2.5 rounded-xl bg-white border border-[#EAE6E1] hover:border-[#191817]/40 text-[#191817] transition-colors"
              title="Voltar ao início"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6E6760]" />
              <input
                type="text"
                aria-label="Buscar no cardápio"
                placeholder="Buscar por nome ou ingrediente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#EAE6E1] rounded-xl pl-10 pr-4 py-2 text-sm text-[#191817] placeholder-[#6E6760] focus:outline-none focus:border-[#191817] transition-colors"
              />
            </div>
          </div>

          {/* Sub-nav de Categorias */}
          <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto pt-3 pb-1 no-scrollbar">
            {categoryOptions.map((category) => (
              <Link
                key={category.id ?? 'all'}
                href={`/table/${tableId}/menu${category.id === null ? '' : `?category=${category.id}`}`}
                aria-current={selectedCategoryId === (category.id === null ? null : String(category.id)) ? 'page' : undefined}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategoryId === (category.id === null ? null : String(category.id))
                    ? 'bg-[#191817] text-white'
                    : 'bg-white text-[#6E6760] border border-[#EAE6E1] hover:border-[#191817]/30'
                }`}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Lista de Itens do Cardápio */}
        <main className="max-w-3xl mx-auto px-4 py-5 space-y-3 pb-24">
          {loading && (
            <div className="text-center py-12 text-[#6E6760] text-sm">
              Carregando cardápio...
            </div>
          )}

          {!loading && filteredProducts.length === 0 && (
            <div className="text-center py-12 text-[#6E6760] text-sm">
              <p role={error ? 'alert' : undefined}>{error || (availableProducts.length === 0 ? 'O cardápio está sendo preparado. Chame o garçom para fazer seu pedido.' : 'Nenhum prato disponível com esses termos.')}</p>
              {error && <button type="button" onClick={() => void refresh()} className="mt-4 min-h-11 px-5 rounded-xl bg-[#C84E1F] text-white font-semibold">Tentar novamente</button>}
            </div>
          )}

          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleOpenCustomizer(product)}
              aria-label={`Personalizar e pedir ${product.name}`}
              className="flex w-full items-center justify-between p-4 rounded-2xl bg-white border border-[#EAE6E1] hover:border-[#191817]/30 transition-colors cursor-pointer group text-left"
            >
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-normal text-[#6E6760]">
                    {product.category_name || 'Especial'}
                  </span>
                </div>

                <span className="block text-sm font-bold text-[#191817]">
                  {product.name}
                </span>
                <p className="text-sm text-[#6E6760] line-clamp-2 mt-0.5 mb-2.5 leading-relaxed">
                  {product.description}
                </p>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#191817]">
                    {formatBRL(product.price)}
                  </span>
                </div>
              </div>

              <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-[#EAE6E1]">
                <ProductImage
                  src={product.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80'}
                  alt={product.name}
                />
                <span
                  className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-lg bg-[#C84E1F] hover:bg-[#B34217] text-white flex items-center justify-center transition-colors shadow-sm"
                  aria-hidden="true"
                >
                  <Plus className="w-4 h-4" />
                </span>
              </div>
            </button>
          ))}
        </main>
      </div>

      {/* Barra Inferior de Comanda */}
      <footer className="sticky bottom-0 z-30 p-4 bg-[#F9F8F6]/95 backdrop-blur-md border-t border-[#EAE6E1]">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link
            href={`/table/${tableId}/order`}
            className="flex-1 flex items-center justify-between py-3 px-5 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-sm sm:text-sm transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>Ver comanda da mesa</span>
            </div>
            {activeItemsCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-black/20 text-sm font-bold">
                {activeItemsCount} {activeItemsCount === 1 ? 'item ativo' : 'itens ativos'}
              </span>
            )}
          </Link>
        </div>
      </footer>

      {/* Modal Deslizante de Personalização */}
      {activeProduct && (
        <Modal isOpen={!!activeProduct} title={`Personalizar ${activeProduct.name}`} isBusy={submitting} onClose={() => setActiveProduct(null)}>
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl border border-[#EAE6E1] p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-sm text-[#6E6760]">
                    {activeProduct.category_name || 'Cardápio'}
                  </span>
                  <h2 className="text-lg font-bold text-[#191817]">{activeProduct.name}</h2>
                </div>
                <button
                  disabled={submitting}
                  onClick={() => setActiveProduct(null)}
                  aria-label="Fechar modal de personalização"
                  className="w-8 h-8 rounded-lg bg-[#F9F8F6] border border-[#EAE6E1] hover:bg-[#F2EFEA] text-[#191817] flex items-center justify-center text-sm font-semibold transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-[#6E6760] mb-5 leading-relaxed">{activeProduct.description}</p>

              {/* Ponto da Carne */}
              {activeProduct.customizations?.meats && (
                <div className="mb-5">
                  <h4 className="text-sm font-semibold text-[#191817] mb-2">
                    Ponto da carne
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {activeProduct.customizations.meats.map((meat: string) => (
                      <button
                        key={meat}
                        onClick={() => setSelectedMeat(meat)}
                        className={`p-2.5 rounded-xl text-sm font-medium border text-left flex items-center justify-between transition-colors cursor-pointer ${
                          selectedMeat === meat
                            ? 'bg-[#C84E1F]/10 border-[#C84E1F] text-[#191817]'
                            : 'bg-white border-[#EAE6E1] text-[#6E6760] hover:border-[#191817]/30'
                        }`}
                      >
                        <span>{meat}</span>
                        {selectedMeat === meat && <Check className="w-3.5 h-3.5 text-[#C84E1F]" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Adicionais Extras */}
              {activeProduct.customizations?.extras && (
                <div className="mb-5">
                  <h4 className="text-sm font-semibold text-[#191817] mb-2">
                    Acompanhamentos opcionais
                  </h4>
                  <div className="space-y-2">
                    {activeProduct.customizations.extras.map((extra: { name: string; price: number }) => {
                      const isChecked = selectedExtras.includes(extra.name);
                      return (
                        <div
                          key={extra.name}
                          onClick={() => handleToggleExtra(extra.name)}
                          role="checkbox"
                          aria-checked={isChecked}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              handleToggleExtra(extra.name);
                            }
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-[#C84E1F]/10 border-[#C84E1F]'
                              : 'bg-white border-[#EAE6E1] hover:border-[#191817]/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                isChecked
                                  ? 'bg-[#C84E1F] border-[#C84E1F] text-white'
                                  : 'border-[#D8D2C9] bg-white'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3" />}
                            </div>
                            <span className="text-sm text-[#191817]">{extra.name}</span>
                          </div>
                          <span className="text-sm font-medium text-[#C84E1F]">
                            + {formatBRL(extra.price)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <label htmlFor="product-quantity" className="block font-semibold mb-2">Quantidade</label>
                <input id="product-quantity" type="number" min="1" max="99" value={quantity}
                  onChange={(event) => setQuantity(Math.min(99, Math.max(1, Number(event.target.value) || 1)))}
                  className="min-h-12 w-24 rounded-xl border border-[#E0DBD3] px-3 text-base" />
              </div>
              {/* Observações */}
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-[#191817] mb-2">
                  Observações para a cozinha
                </h4>
                <textarea
                  aria-label="Observações para a cozinha"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ex: sem cebola, molho à parte..."
                  rows={2}
                  className="w-full bg-white border border-[#EAE6E1] rounded-xl p-3 text-sm text-[#191817] placeholder-[#6E6760] focus:outline-none focus:border-[#191817] transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-sm sm:text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-[#C84E1F]/20"
            >
              <span>{submitting ? 'Enviando à cozinha...' : 'Enviar à cozinha'}</span>
              <span>•</span>
              <span>{formatBRL(currentModalTotal)}</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
