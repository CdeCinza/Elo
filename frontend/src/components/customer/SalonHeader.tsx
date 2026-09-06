'use client';

import React from 'react';
import { Receipt, Globe } from 'lucide-react';
import Link from 'next/link';

interface SalonHeaderProps {
  tableNumber: string | number;
  tableStatus?: string;
}

export const SalonHeader: React.FC<SalonHeaderProps> = ({
  tableNumber,
  tableStatus = 'Mesa aberta',
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#F9F8F6]/95 backdrop-blur-md border-b border-[#EAE6E1] px-5 sm:px-8 py-3.5">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Lado Esquerdo: Marca ELO + Identificador da Mesa */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href={`/table/${tableNumber}`} className="flex items-center gap-2 group">
            <span className="text-xl font-bold tracking-tight text-[#191817]">ELO</span>
          </Link>

          <div className="h-4 w-[1px] bg-[#D8D2C9]" />

          {/* Contexto da Mesa */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#191817]">Mesa {tableNumber}</span>
            <span className="flex items-center gap-1.5 text-xs text-[#2D6A4F] font-medium bg-[#2D6A4F]/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]" />
              {tableStatus}
            </span>
          </div>
        </div>

        {/* Lado Direito: Acesso à Comanda */}
        <div className="flex items-center gap-4 text-xs font-medium text-[#6E6760]">
          <Link
            href={`/table/${tableNumber}/order`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAE6E1] bg-white hover:border-[#191817]/40 text-[#191817] transition-colors"
          >
            <Receipt className="w-3.5 h-3.5 text-[#C84E1F]" />
            <span>Ver comanda</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
