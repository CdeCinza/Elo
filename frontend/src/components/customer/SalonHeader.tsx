'use client';

import React, { useState, useRef } from 'react';
import { Receipt, Settings, ShieldAlert, X, Check, RefreshCw, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/ToastProvider';

interface SalonHeaderProps {
  tableNumber: string | number;
  tableStatus?: string;
}

export const SalonHeader: React.FC<SalonHeaderProps> = ({
  tableNumber,
  tableStatus = 'Mesa aberta',
}) => {
  const router = useRouter();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pin, setPin] = useState('');
  const [newTableNumber, setNewTableNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Gesto Oculto de Acesso Administrativo: 3 toques rápidos no logotipo ELO
  const handleLogoClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      setPin('');
      setNewTableNumber(String(tableNumber));
      setErrorMsg('');
      setShowConfigModal(true);
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 800);
    }
  };

  const handleUpdateTableConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const validPins = ['1234', '0000', 'admin', '8888'];
    if (!validPins.includes(pin.trim())) {
      setErrorMsg('PIN incorreto. Acesso restrito à gerência.');
      return;
    }

    if (!newTableNumber.trim()) {
      setErrorMsg('Informe a nova numeração da mesa.');
      return;
    }

    const cleanNumber = newTableNumber.replace(/[^0-9]/g, '');
    const finalNumber = cleanNumber !== '' ? String(parseInt(cleanNumber, 10)).padStart(2, '0') : newTableNumber.trim();

    localStorage.setItem('elo_tablet_table', finalNumber);
    localStorage.setItem('elo_tablet_configured_at', new Date().toISOString());

    toast.success(`Tablet reconfigurado para a Mesa ${finalNumber}`, 'Mesa Atualizada');
    setShowConfigModal(false);
    router.replace(`/table/${finalNumber}`);
  };

  const handleUnlinkTablet = () => {
    const validPins = ['1234', '0000', 'admin', '8888'];
    if (!validPins.includes(pin.trim())) {
      setErrorMsg('Digite o PIN do gerente para desvincular o dispositivo.');
      return;
    }

    localStorage.removeItem('elo_tablet_table');
    localStorage.removeItem('elo_tablet_configured_at');
    toast.info('Tablet desvinculado. Redirecionando para setup inicial.', 'Dispositivo Liberado');
    setShowConfigModal(false);
    router.replace('/table');
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#F9F8F6]/95 backdrop-blur-md border-b border-[#EAE6E1] px-5 sm:px-8 py-3.5 select-none">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Lado Esquerdo: Marca ELO + Identificador da Mesa */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={handleLogoClick}
              title="Toque 3 vezes para gerenciar o dispositivo"
              className="flex items-center gap-2 group cursor-pointer focus:outline-none"
            >
              <span className="text-xl font-bold tracking-tight text-[#191817] group-active:scale-95 transition-transform">
                ELO
              </span>
            </button>

            <div className="h-4 w-[1px] bg-[#D8D2C9]" />

            {/* Contexto da Mesa */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#191817]">Mesa {tableNumber}</span>
              <span
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  tableStatus.includes('Conta') || tableStatus.includes('solicitada')
                    ? 'text-amber-900 bg-amber-100 border border-amber-200'
                    : tableStatus.includes('ocupada')
                    ? 'text-[#9E3712] bg-[#C84E1F]/15 border border-[#C84E1F]/20'
                    : 'text-[#2D6A4F] bg-[#2D6A4F]/10 border border-[#2D6A4F]/20'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    tableStatus.includes('Conta') || tableStatus.includes('solicitada')
                      ? 'bg-amber-600'
                      : tableStatus.includes('ocupada')
                      ? 'bg-[#C84E1F]'
                      : 'bg-[#2D6A4F]'
                  }`}
                />
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

      {/* Modal Administrativo Protegido por PIN */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#F9F8F6] rounded-3xl border border-[#EAE6E1] p-6 sm:p-7 shadow-2xl text-left space-y-5">
            <div className="flex items-center justify-between border-b border-[#EAE6E1] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#C84E1F]/10 flex items-center justify-center text-[#C84E1F]">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#191817]">Gerenciar Este Tablet</h3>
                  <p className="text-[11px] text-[#6E6760]">Mesa atual vinculada: {tableNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="w-8 h-8 rounded-full border border-[#EAE6E1] flex items-center justify-center text-[#6E6760] hover:bg-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTableConfig} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#191817]">
                  Nova Numeração da Mesa
                </label>
                <input
                  type="text"
                  placeholder="Ex: 01, 02, 10..."
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] bg-white text-sm text-[#191817] focus:outline-none focus:border-[#C84E1F]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#191817] flex items-center justify-between">
                  <span>PIN do Gerente</span>
                  <span className="text-[10px] font-normal text-[#6E6760]">(padrão: 1234)</span>
                </label>
                <input
                  type="password"
                  maxLength={8}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] bg-white text-center text-lg tracking-[0.3em] font-mono text-[#191817] focus:outline-none focus:border-[#C84E1F]"
                  required
                />
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#C84E1F]/15"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar e Trocar Mesa</span>
                </button>

                <button
                  type="button"
                  onClick={handleUnlinkTablet}
                  className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-medium text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Desvincular Dispositivo (Voltar ao Setup)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
