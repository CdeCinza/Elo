'use client';

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface EditorialHeroProps {
  tableId: string | number;
}

export const EditorialHero: React.FC<EditorialHeroProps> = ({ tableId }) => {
  return (
    <section className="relative w-full rounded-2xl overflow-hidden bg-[#191817] border border-[#2D2A26]">
      <div className="relative min-h-[320px] sm:min-h-[380px] flex items-center">
        {/* Fotografia Gastronômica */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1600&q=85')`,
          }}
        />

        {/* Overlay balanceado para contraste legível */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#191817]/95 via-[#191817]/70 to-[#191817]/20" />

        {/* Conteúdo Editorial */}
        <div className="relative z-10 max-w-lg p-7 sm:p-12">
          <p className="text-sm text-[#EAE6E1]/70 mb-2">
            Cardápio da casa
          </p>

          <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-normal text-[#F9F8F6] leading-[1.12] mb-4">
            O melhor da nossa cozinha, na sua mesa.
          </h1>

          <p className="text-sm sm:text-sm text-[#EAE6E1]/80 leading-relaxed mb-6 max-w-md">
            Ingredientes frescos grelhados na brasa, entradas artesanais e bebidas pensadas para o seu momento.
          </p>

          <Link
            href={`/table/${tableId}/menu`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-sm sm:text-sm font-semibold transition-colors"
          >
            <span>Ver cardápio completo</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};
