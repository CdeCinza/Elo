'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';

interface FavoriteProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
}

const FAVORITES: FavoriteProduct[] = [
  {
    id: 1,
    name: 'Smash ELO Bacon Duplo',
    description: 'Dois burgers de 90g com cheddar inglês derretido, bacon crocante e maionese defumada.',
    price: 36.9,
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 2,
    name: 'Batata Rústica com Alecrim',
    description: 'Batatas rústicas com casca temperadas com flor de sal, páprica picante e alecrim.',
    price: 24.5,
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 3,
    name: 'Soda Italiana de Maracujá',
    description: 'Redução pura de maracujá, água gaseificada gelada e folhas de hortelã.',
    price: 16.0,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 4,
    name: 'Pudim de Leite na Lata',
    description: 'Receita tradicional aveludada sem furinhos, servida com calda artesanal de caramelo.',
    price: 18.0,
    image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=400&q=80',
  },
];

interface HouseFavoritesProps {
  tableId: string | number;
  products?: FavoriteProduct[];
  onAddToCart?: (product: FavoriteProduct) => void;
}

export const HouseFavoritesSection: React.FC<HouseFavoritesProps> = ({
  tableId,
  products,
  onAddToCart,
}) => {
  const displayItems = products && products.length > 0 ? products : FAVORITES;

  return (
    <section className="my-10">
      {/* Título Limpo */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-editorial text-2xl font-normal text-[#191817]">
          Mais pedidos da casa
        </h2>
        <span className="text-xs text-[#6E6760]">
          Receitas mais pedidas do salão
        </span>
      </div>

      {/* Grid de 4 Cards Horizontais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-[#EAE6E1] p-3.5 flex flex-col justify-between hover:border-[#191817]/30 transition-colors group"
          >
            <div className="flex gap-3 items-start">
              {/* Foto Quadrada */}
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[#EAE6E1]">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Informações */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-[#191817] line-clamp-1">
                  {item.name}
                </h3>
                <p className="text-[11px] text-[#6E6760] line-clamp-2 mt-1 leading-snug">
                  {item.description}
                </p>
              </div>
            </div>

            {/* Preço + Botão Adicionar */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#F2EFEA]">
              <span className="text-xs sm:text-sm font-bold text-[#191817]">
                R$ {item.price.toFixed(2).replace('.', ',')}
              </span>

              <button
                onClick={() => onAddToCart?.(item)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-medium transition-colors"
                title="Adicionar ao pedido"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pedir</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
