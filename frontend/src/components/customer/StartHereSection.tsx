'use client';

import React from 'react';
import { ArrowUpRight, Leaf, UtensilsCrossed, Cake } from 'lucide-react';
import Link from 'next/link';

interface CategoryCard {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryCard[] = [
  {
    id: 'entradas',
    title: 'Entradas artesanais',
    subtitle: 'Para compartilhar e abrir o apetite à mesa.',
    image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80',
    icon: <Leaf className="w-4 h-4 text-white" />,
  },
  {
    id: 'pratos-principais',
    title: 'Pratos principais',
    subtitle: 'Burgers na brasa, cortes nobres e receitas autorais.',
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
    icon: <UtensilsCrossed className="w-4 h-4 text-white" />,
  },
  {
    id: 'sobremesas',
    title: 'Sobremesas',
    subtitle: 'Doces artesanais preparados na casa.',
    image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=600&q=80',
    icon: <Cake className="w-4 h-4 text-white" />,
  },
];

interface StartHereProps {
  tableId: string | number;
}

export const StartHereSection: React.FC<StartHereProps> = ({ tableId }) => {
  return (
    <section className="my-10">
      {/* Título Limpo sem traço decorativo artificial */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-editorial text-2xl font-normal text-[#191817]">
          Categorias do cardápio
        </h2>
        <Link
          href={`/table/${tableId}/menu`}
          className="text-xs font-semibold text-[#C84E1F] hover:text-[#B34217] flex items-center gap-1 transition-colors"
        >
          <span>Ver cardápio completo</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Grid de Cards de Categorias */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.id}
            href={`/table/${tableId}/menu?category=${cat.id}`}
            className="group relative h-44 rounded-2xl overflow-hidden border border-[#EAE6E1] flex flex-col justify-end p-5"
          >
            {/* Foto de Fundo */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${cat.image})` }}
            />
            {/* Overlay Gradiente */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#191817]/95 via-[#191817]/60 to-[#191817]/20" />

            {/* Ícone discreto */}
            <div className="absolute top-4 left-4 w-8 h-8 rounded-lg bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center">
              {cat.icon}
            </div>

            {/* Conteúdo */}
            <div className="relative z-10 flex items-end justify-between">
              <div>
                <h3 className="text-base font-semibold text-white mb-0.5">{cat.title}</h3>
                <p className="text-xs text-[#EAE6E1]/80 line-clamp-1">
                  {cat.subtitle}
                </p>
              </div>

              <div className="w-7 h-7 rounded-full bg-white/20 group-hover:bg-[#C84E1F] text-white backdrop-blur-md flex items-center justify-center transition-colors shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
