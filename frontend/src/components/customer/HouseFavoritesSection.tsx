'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { formatBRL } from '@/lib/format';
import { ProductImage } from '@/components/ui/ProductImage';

interface FavoriteProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
}

interface HouseFavoritesProps {
  tableId: string | number;
  products: FavoriteProduct[];
}

/**
 * Vitrine de sugestões: "Pedir" abre o prato no cardápio para o cliente revisar e confirmar.
 */
export const HouseFavoritesSection: React.FC<HouseFavoritesProps> = ({ tableId, products }) => {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="my-10">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-editorial text-2xl font-normal text-[#191817]">
          Sugestões da casa
        </h2>
        <span className="text-xs text-[#6E6760]">
          Escolhidos pela nossa cozinha
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-[#EAE6E1] p-3.5 flex flex-col justify-between hover:border-[#191817]/30 transition-colors group"
          >
            <div className="flex gap-3 items-start">
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[#EAE6E1]">
                <ProductImage
                  src={item.image}
                  alt={item.name}
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-[#191817] line-clamp-1">
                  {item.name}
                </h3>
                <p className="text-[11px] text-[#6E6760] line-clamp-2 mt-1 leading-snug">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#F2EFEA]">
              <span className="text-xs sm:text-sm font-bold text-[#191817]">
                {formatBRL(item.price)}
              </span>

              <Link
                href={`/table/${tableId}/menu?product=${item.id}`}
                aria-label={`Pedir ${item.name}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pedir</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
