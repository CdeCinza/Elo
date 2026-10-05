'use client';

import React from 'react';
import { Bell, Receipt, Wifi, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/components/ui/ToastProvider';

interface QuickActionsBarProps {
  tableId: string | number;
  onCallWaiter?: () => void;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  tableId,
  onCallWaiter,
}) => {
  const wifiName = process.env.NEXT_PUBLIC_WIFI_NAME;
  const wifiPassword = process.env.NEXT_PUBLIC_WIFI_PASSWORD;

  return (
    <div className="w-full bg-white rounded-2xl border border-[#EAE6E1] my-6 p-2 sm:p-3">
      <div className={`grid grid-cols-2 ${wifiName ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} divide-y sm:divide-y-0 sm:divide-x divide-[#F2EFEA]`}>
        {/* Item 1: Chamar Garçom */}
        <button
          onClick={onCallWaiter}
          className="flex items-center gap-3 p-3 hover:bg-[#F9F8F6] rounded-xl transition-colors text-left group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg bg-[#F9F8F6] border border-[#EAE6E1] flex items-center justify-center text-[#C84E1F] shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm sm:text-sm font-semibold text-[#191817]">
              Chamar garçom
            </h4>
            <p className="text-sm text-[#6E6760]">Solicitar na mesa</p>
          </div>
        </button>

        {/* Item 2: Ver Comanda */}
        <Link
          href={`/table/${tableId}/order`}
          className="flex items-center gap-3 p-3 hover:bg-[#F9F8F6] rounded-xl transition-colors text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-[#F9F8F6] border border-[#EAE6E1] flex items-center justify-center text-[#191817] shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm sm:text-sm font-semibold text-[#191817]">
              Ver comanda
            </h4>
            <p className="text-sm text-[#6E6760]">Consumo e divisão</p>
          </div>
        </Link>

        {/* Item 3: Wi-Fi da Casa (configurado por NEXT_PUBLIC_WIFI_NAME / NEXT_PUBLIC_WIFI_PASSWORD) */}
        {wifiName && (
          <button
            onClick={() => {
              if (wifiPassword) {
                void navigator.clipboard?.writeText(wifiPassword).catch(() => undefined);
              }
              toast.info(
                `Wi-Fi: ${wifiName}`,
                wifiPassword ? `Senha: ${wifiPassword} (copiada para a área de transferência)` : 'Rede aberta, sem senha.'
              );
            }}
            className="flex items-center gap-3 p-3 hover:bg-[#F9F8F6] rounded-xl transition-colors text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-[#F9F8F6] border border-[#EAE6E1] flex items-center justify-center text-[#191817] shrink-0">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm sm:text-sm font-semibold text-[#191817]">
                Wi-Fi da casa
              </h4>
              <p className="text-sm text-[#6E6760]">Ver senha</p>
            </div>
          </button>
        )}

        {/* Item 4: Dúvidas */}
        <button
          onClick={() => toast.info('Ajuda do Salão', 'Peça pelo cardápio, acompanhe o preparo em "Ver comanda" e chame o garçom quando quiser.')}
          className="flex items-center gap-3 p-3 hover:bg-[#F9F8F6] rounded-xl transition-colors text-left group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg bg-[#F9F8F6] border border-[#EAE6E1] flex items-center justify-center text-[#191817] shrink-0">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm sm:text-sm font-semibold text-[#191817]">
              Ajuda
            </h4>
            <p className="text-sm text-[#6E6760]">Como funciona</p>
          </div>
        </button>
      </div>
    </div>
  );
};
