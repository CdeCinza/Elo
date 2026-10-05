'use client';

import React from 'react';
import { Utensils } from 'lucide-react';

export const ClosingExperienceBanner: React.FC = () => {
  return (
    <section className="relative w-full rounded-2xl overflow-hidden bg-[#191817] border border-[#2D2A26] my-10">
      <div className="relative h-28 sm:h-32 flex items-center justify-between px-6 sm:px-10">
        {/* Imagem de Fundo com Mesa e Ambiente */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#191817] via-[#191817]/85 to-transparent" />

        {/* Lado Esquerdo: Ícone + Mensagem */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-[#C84E1F] shrink-0">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-editorial text-base sm:text-lg font-normal text-[#F9F8F6]">
              Atenção a cada detalhe do preparo.
            </h3>
            <p className="text-sm text-[#EAE6E1]/70">
              Caso deseje qualquer ajuste em seu pedido, solicite a nossa equipe pelo botão de garçom.
            </p>
          </div>
        </div>

        {/* Lado Direito */}
        <div className="relative z-10 hidden sm:block text-right">
          <span className="text-sm font-medium text-[#EAE6E1]/60">
            ELO Gastronomia
          </span>
        </div>
      </div>
    </section>
  );
};
