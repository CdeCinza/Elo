'use client';

import React from 'react';
import { Plus, Clock, Star } from 'lucide-react';
import Link from 'next/link';

interface ProductItem {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  timeEstimate: string;
  image: string;
}

const POPULAR_ITEMS: ProductItem[] = [
  {
    id: 1,
    name: 'Smash Elo Bacon Duplo',
    category: 'Burgers',
    description: 'Dois burgers de 90g, muito cheddar derretido e tiras crocantes de bacon artesanal.',
    price: 36.9,
    timeEstimate: '15-20 min',
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 2,
    name: 'Batata Rústica com Alecrim',
    category: 'Entradas',
    description: 'Batatas crocantes temperadas com flor de sal, páprica defumada e alecrim fresco.',
    price: 24.5,
    timeEstimate: '10-15 min',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 3,
    name: 'Soda Italiana de Maracujá',
    category: 'Bebidas',
    description: 'Xarope artesanal de maracujá, água com gás e folhas de hortelã fresca.',
    price: 16.0,
    timeEstimate: '5 min',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 4,
    name: 'Pudim de Leite na Lata',
    category: 'Sobremesas',
    description: 'Receita tradicional cremosa sem furinhos com calda de caramelo brilhante.',
    price: 18.0,
    timeEstimate: '5 min',
    image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=400&q=80',
  },
];

interface QuickFeedProps {
  tableId: string | number;
  onSelectProduct?: (product: ProductItem) => void;
}

export const QuickFeed: React.FC<QuickFeedProps> = ({
  tableId,
  onSelectProduct,
}) => {
  return (
    <section className="mt-6 mb-8">
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h3 className="text-base font-bold text-[#F5F5F3] flex items-center gap-1.5">
            <Star className="w-4 h-4 text-[#FF6B2D] fill-[#FF6B2D]" />
            Mais Pedidos da Casa
          </h3>
          <p className="text-xs text-[#9CA3AF]">Sugestões favoritas dos clientes</p>
        </div>
        <Link
          href={`/table/${tableId}/menu`}
          className="text-xs font-semibold text-[#FF6B2D] hover:text-[#E0551B] transition-colors"
        >
          Ver cardápio completo →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {POPULAR_ITEMS.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectProduct?.(item)}
            className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer group"
          >
            <div className="flex-1 pr-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FF6B2D]">
                {item.category}
              </span>
              <h4 className="text-sm font-bold text-[#F5F5F3] group-hover:text-[#FF6B2D] transition-colors">
                {item.name}
              </h4>
              <p className="text-xs text-[#9CA3AF] line-clamp-1 mt-0.5 mb-2">
                {item.description}
              </p>

              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold text-[#F5F5F3]">
                  R$ {item.price.toFixed(2).replace('.', ',')}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                  <Clock className="w-3 h-3 text-[#9CA3AF]" />
                  {item.timeEstimate}
                </span>
              </div>
            </div>

            <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-zinc-800">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <button
                type="button"
                className="absolute bottom-1 right-1 w-7 h-7 rounded-md bg-[#FF6B2D] hover:bg-[#E0551B] text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
                title="Adicionar item"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
