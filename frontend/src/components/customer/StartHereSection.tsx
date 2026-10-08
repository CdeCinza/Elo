'use client';

import React from 'react';
import { ArrowUpRight, Leaf, UtensilsCrossed, Cake, Coffee } from 'lucide-react';
import Link from 'next/link';
import type { Category } from '@/hooks/useCustomerSession';

const categoryVisuals = [
  {
    matches: /entrada/i,
    image: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80',
    icon: Leaf,
  },
  {
    matches: /burger|prato|principal/i,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
    icon: UtensilsCrossed,
  },
  {
    matches: /bebida|drink/i,
    image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=80',
    icon: Coffee,
  },
  {
    matches: /sobremesa|doce/i,
    image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=600&q=80',
    icon: Cake,
  },
];

interface StartHereProps {
  tableId: string | number;
  categories: Category[];
}

export const StartHereSection: React.FC<StartHereProps> = ({ tableId, categories }) => {
  return (
    <section className="my-10">
      <div className="flex items-center justify-between mb-5 gap-4">
        <h2 className="font-editorial text-2xl font-normal text-[#191817]">
          Categorias do cardápio
        </h2>
        <Link
          href={`/table/${tableId}/menu`}
          className="text-sm font-semibold text-[#C84E1F] hover:text-[#B34217] flex items-center gap-1 transition-colors shrink-0"
        >
          <span>Ver cardápio completo</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((category) => {
          const visual = categoryVisuals.find((item) => item.matches.test(category.name));
          const Icon = visual?.icon ?? UtensilsCrossed;

          return (
            <Link
              key={category.id}
              href={`/table/${tableId}/menu?category=${category.id}`}
              className="group relative h-44 rounded-2xl overflow-hidden border border-[#EAE6E1] flex flex-col justify-end p-5"
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${visual?.image ?? categoryVisuals[1].image})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#191817]/95 via-[#191817]/60 to-[#191817]/20" />
              <div className="absolute top-4 left-4 w-8 h-8 rounded-lg bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="relative z-10 flex items-end justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-white mb-0.5">{category.name}</h3>
                  <p className="text-sm text-[#EAE6E1]/80 line-clamp-2">
                    {category.description || 'Explore os sabores desta categoria.'}
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-white/20 group-hover:bg-[#C84E1F] text-white backdrop-blur-md flex items-center justify-center transition-colors shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
