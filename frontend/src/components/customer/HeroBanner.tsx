'use client';

import React, { useState, useEffect } from 'react';
import { Flame, Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface BannerSlide {
  id: number;
  title: string;
  subtitle: string;
  tag: string;
  priceTag?: string;
  image: string;
}

const SLIDES: BannerSlide[] = [
  {
    id: 1,
    title: 'Experiência Gastronômica ELO',
    subtitle: 'Conexão direta do seu pedido à nossa cozinha com pratos autorais.',
    tag: 'Destaque da Casa',
    image: '/brand/13_banner_promocional.png',
  },
  {
    id: 2,
    title: 'Burger Artesanal Defumado',
    subtitle: 'Blend 180g com queijo brie maçaricado e cebola caramelizada.',
    tag: 'Destaque do Chef',
    priceTag: 'R$ 44,90',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 3,
    title: 'Combo Experiência Elo',
    subtitle: 'Burger Especial + Fritas Rústicas Temperadas + Drink Autoral.',
    tag: 'Promoção do Dia',
    priceTag: 'R$ 62,00',
    image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80',
  },
];

interface HeroBannerProps {
  tableId: string | number;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ tableId }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[current];

  return (
    <section className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 shadow-lg">
      <div className="relative h-52 sm:h-64 w-full overflow-hidden">
        {/* Imagem de Fundo com Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700 transform scale-105"
          style={{ backgroundImage: `url(${slide.image})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

        {/* Conteúdo do Slide */}
        <div className="absolute inset-0 p-5 flex flex-col justify-end">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FF6B2D] text-[#F5F5F3] shadow-sm">
              <Flame className="w-3 h-3" />
              {slide.tag}
            </span>
            {slide.priceTag && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-zinc-900/90 text-[#F5F5F3] border border-zinc-700">
                {slide.priceTag}
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-[#F5F5F3] leading-tight mb-1">
            {slide.title}
          </h2>
          <p className="text-xs sm:text-sm text-[#9CA3AF] line-clamp-2 mb-3 max-w-md">
            {slide.subtitle}
          </p>

          <Link
            href={`/table/${tableId}/menu`}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#FF6B2D] hover:text-[#E0551B] transition-colors"
          >
            <span>Ver opções no cardápio</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Indicadores de Slide */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-1.5 rounded-full transition-all ${
              idx === current ? 'w-4 bg-[#FF6B2D]' : 'w-1.5 bg-zinc-500/60'
            }`}
          />
        ))}
      </div>
    </section>
  );
};
