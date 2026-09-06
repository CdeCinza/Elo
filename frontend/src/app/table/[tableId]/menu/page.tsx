'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { SalonHeader } from '@/components/customer/SalonHeader';
import { Search, Plus, Clock, ArrowLeft, Check, Flame, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/components/ui/ToastProvider';

interface Product {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  timeEstimate: string;
  image: string;
  badge?: string;
  customizations?: {
    meats?: string[];
    extras?: { name: string; price: number }[];
  };
}

const CATEGORIES = ['Todos', 'Burgers', 'Entradas', 'Bebidas', 'Sobremesas'];

const MENU_PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Smash ELO Bacon Duplo',
    category: 'Burgers',
    description: 'Dois burgers de 90g com queijo cheddar inglês derretido, tiras de bacon crocante e maionese defumada.',
    price: 36.9,
    timeEstimate: '15-20 min',
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
    badge: 'Mais Pedido',
    customizations: {
      meats: ['Ao Ponto', 'Ao Ponto para Bem', 'Bem Passado'],
      extras: [
        { name: 'Bacon Extra (+4 fatias)', price: 6.0 },
        { name: 'Cheddar Inglês Extra', price: 5.0 },
        { name: 'Cebola Caramelizada', price: 4.5 },
      ],
    },
  },
  {
    id: 2,
    name: 'Burger Gorgonzola & Mel',
    category: 'Burgers',
    description: 'Blend bovino 180g grelhado na brasa, creme de gorgonzola dolce, fios de mel silvestre e rúcula fresca no brioche.',
    price: 42.0,
    timeEstimate: '15-20 min',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
    customizations: {
      meats: ['Ao Ponto para Menos', 'Ao Ponto', 'Bem Passado'],
      extras: [
        { name: 'Burger Extra 180g', price: 14.0 },
        { name: 'Molho Extra Gorgonzola', price: 6.0 },
      ],
    },
  },
  {
    id: 3,
    name: 'Batata Rústica com Alecrim',
    category: 'Entradas',
    description: 'Batatas rústicas com casca temperadas com flor de sal, páprica picante e alecrim fresco. Acompanha maionese da casa.',
    price: 24.5,
    timeEstimate: '10-15 min',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
    badge: 'Ideal p/ Dividir',
    customizations: {
      extras: [
        { name: 'Cheddar Cremoso por cima', price: 7.0 },
        { name: 'Farofa de Bacon', price: 5.0 },
      ],
    },
  },
  {
    id: 4,
    name: 'Croquetes de Costela Defumada',
    category: 'Entradas',
    description: '6 unidades crocantes por fora e cremosas por dentro, recheadas com costela desfiada cozida lentamente por 12 horas.',
    price: 29.9,
    timeEstimate: '10-12 min',
    image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 5,
    name: 'Soda Italiana de Maracujá',
    category: 'Bebidas',
    description: 'Refrescante soda autoral com redução pura de maracujá, água gaseificada gelada e hortelã fresca.',
    price: 16.0,
    timeEstimate: '5 min',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 6,
    name: 'Pudim de Leite na Lata',
    category: 'Sobremesas',
    description: 'Receita tradicional e aveludada sem furinhos, servida com bastante calda artesanal de caramelo brilhante.',
    price: 18.0,
    timeEstimate: '5 min',
    image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=600&q=80',
  },
];

import { useCustomerSession } from '@/hooks/useCustomerSession';

export default function MenuPage() {
  const params = useParams();
  const tableId = (params?.tableId as string) || '01';
  const { categories, products, loading, error, sendOrder, table } = useCustomerSession(tableId);

  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProduct, setActiveProduct] = useState<any | null>(null);

  // Estados do Modal de Customização
  const [selectedMeat, setSelectedMeat] = useState<string>('Ao Ponto');
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [observations, setObservations] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleOpenCustomizer = (product: any) => {
    setActiveProduct(product);
    setSelectedMeat('Ao Ponto');
    setSelectedExtras([]);
    setObservations('');
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
        quantity: 1,
        notes: notes || undefined,
      },
    ]);

    setSubmitting(false);
    if (res.success) {
      toast.success(`${activeProduct.name} enviado para a cozinha!`, 'Pedido Realizado');
      setActiveProduct(null);
    } else {
      toast.warning(res.message || 'Não foi possível enviar o item.', 'Atenção');
    }
  };

  const categoryNames = ['Todos', ...categories.map((c) => c.name)];

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === 'Todos' || product.category_name === selectedCategory;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const activeItemsCount = table?.active_order?.items?.length || 0;

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col justify-between selection:bg-[#C84E1F]/15">
      <div>
        <SalonHeader tableNumber={tableId} />

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
                placeholder="Buscar por nome ou ingrediente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#EAE6E1] rounded-xl pl-10 pr-4 py-2 text-xs text-[#191817] placeholder-[#6E6760] focus:outline-none focus:border-[#191817] transition-colors"
              />
            </div>
          </div>

          {/* Sub-nav de Categorias */}
          <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto pt-3 pb-1 no-scrollbar">
            {categoryNames.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#191817] text-white'
                    : 'bg-white text-[#6E6760] border border-[#EAE6E1] hover:border-[#191817]/30'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Itens do Cardápio */}
        <main className="max-w-3xl mx-auto px-4 py-5 space-y-3 pb-24">
          {loading && (
            <div className="text-center py-12 text-[#6E6760] text-xs">
              Carregando cardápio...
            </div>
          )}

          {!loading && filteredProducts.length === 0 && (
            <div className="text-center py-12 text-[#6E6760] text-xs">
              Nenhum prato encontrado com esses termos.
            </div>
          )}

          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => handleOpenCustomizer(product)}
              className="flex items-center justify-between p-4 rounded-2xl bg-white border border-[#EAE6E1] hover:border-[#191817]/30 transition-colors cursor-pointer group"
            >
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-normal text-[#6E6760]">
                    {product.category_name || 'Especial'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-[#191817]">
                  {product.name}
                </h3>
                <p className="text-xs text-[#6E6760] line-clamp-2 mt-0.5 mb-2.5 leading-relaxed">
                  {product.description}
                </p>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#191817]">
                    R$ {Number(product.price).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-[#6E6760]">
                    <Clock className="w-3 h-3" />
                    ~ 15 min
                  </span>
                </div>
              </div>

              <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-[#EAE6E1]">
                <img
                  src={product.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-lg bg-[#C84E1F] hover:bg-[#B34217] text-white flex items-center justify-center transition-colors"
                  title="Personalizar e adicionar"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </main>
      </div>

      {/* Barra Inferior de Comanda */}
      <footer className="sticky bottom-0 z-30 p-4 bg-[#F9F8F6]/95 backdrop-blur-md border-t border-[#EAE6E1]">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link
            href={`/table/${tableId}/order`}
            className="flex-1 flex items-center justify-between py-3 px-5 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-xs sm:text-sm transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>Ver comanda da mesa</span>
            </div>
            {activeItemsCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-black/20 text-xs font-bold">
                {activeItemsCount} {activeItemsCount === 1 ? 'item ativo' : 'itens ativos'}
              </span>
            )}
          </Link>
        </div>
      </footer>

      {/* Modal Deslizante de Personalização */}
      {activeProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl border border-[#EAE6E1] p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-xs text-[#6E6760]">
                    {activeProduct.category_name || 'Cardápio'}
                  </span>
                  <h2 className="text-lg font-bold text-[#191817]">{activeProduct.name}</h2>
                </div>
                <button
                  onClick={() => setActiveProduct(null)}
                  className="w-8 h-8 rounded-lg bg-[#F9F8F6] border border-[#EAE6E1] hover:bg-[#F2EFEA] text-[#191817] flex items-center justify-center text-sm font-semibold transition-colors"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-[#6E6760] mb-5 leading-relaxed">{activeProduct.description}</p>

              {/* Ponto da Carne */}
              {activeProduct.customizations?.meats && (
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-[#191817] mb-2">
                    Ponto da carne
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {activeProduct.customizations.meats.map((meat: string) => (
                      <button
                        key={meat}
                        onClick={() => setSelectedMeat(meat)}
                        className={`p-2.5 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition-colors ${
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
                  <h4 className="text-xs font-semibold text-[#191817] mb-2">
                    Acompanhamentos opcionais
                  </h4>
                  <div className="space-y-2">
                    {activeProduct.customizations.extras.map((extra: { name: string; price: number }) => {
                      const isChecked = selectedExtras.includes(extra.name);
                      return (
                        <div
                          key={extra.name}
                          onClick={() => handleToggleExtra(extra.name)}
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
                            <span className="text-xs text-[#191817]">{extra.name}</span>
                          </div>
                          <span className="text-xs font-medium text-[#C84E1F]">
                            + R$ {extra.price.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observações */}
              <div className="mb-5">
                <h4 className="text-xs font-semibold text-[#191817] mb-2">
                  Observações para a cozinha
                </h4>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ex: sem cebola, molho à parte..."
                  rows={2}
                  className="w-full bg-white border border-[#EAE6E1] rounded-xl p-3 text-xs text-[#191817] placeholder-[#6E6760] focus:outline-none focus:border-[#191817] transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{submitting ? 'Enviando à cozinha...' : 'Enviar à cozinha'}</span>
              <span>•</span>
              <span>R$ {Number(activeProduct.price).toFixed(2).replace('.', ',')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
