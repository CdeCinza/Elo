'use client';

import React, { useState, useRef } from 'react';
import { Receipt, Settings, ShieldAlert, X, Check, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/ToastProvider';
import { Modal } from '@/components/ui/Modal';
import { linkTabletToTable, normalizeTableNumber, tableExists, unlinkTablet, verifyManagerCredentials } from '@/lib/tablet';

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
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUnavailable = tableStatus === 'Indisponível' || tableStatus === 'Carregando';
  const compactStatus = tableStatus.replace(/^Mesa /, '');

  // Gesto Oculto de Acesso Administrativo: 3 toques rápidos no logotipo ELO
  const handleLogoClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      setManagerEmail('');
      setManagerPassword('');
      setNewTableNumber(String(tableNumber));
      setErrorMsg('');
      setShowConfigModal(true);
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 800);
    }
  };

  const authorizeManager = async (): Promise<boolean> => {
    if (!managerEmail.trim() || !managerPassword) {
      setErrorMsg('Informe o e-mail e a senha do gerente.');
      return false;
    }

    const verification = await verifyManagerCredentials(managerEmail, managerPassword);
    if (!verification.success) {
      setErrorMsg(verification.message);
      return false;
    }

    return true;
  };

  const handleUpdateTableConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newTableNumber.trim()) {
      setErrorMsg('Informe a nova numeração da mesa.');
      return;
    }

    setSubmitting(true);
    try {
      if (!(await authorizeManager())) return;

      const finalNumber = normalizeTableNumber(newTableNumber);
      if (!(await tableExists(finalNumber))) {
        setErrorMsg('Esta mesa não existe no restaurante.');
        return;
      }

      linkTabletToTable(finalNumber);
      toast.success('Mesa Atualizada', `Tablet reconfigurado para a Mesa ${finalNumber}`);
      setShowConfigModal(false);
      router.replace(`/table/${finalNumber}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlinkTablet = async () => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      if (!(await authorizeManager())) return;

      unlinkTablet();
      toast.info('Dispositivo Liberado', 'Tablet desvinculado. Redirecionando para setup inicial.');
      setShowConfigModal(false);
      router.replace('/table');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#F9F8F6]/95 backdrop-blur-md border-b border-[#EAE6E1] px-3 sm:px-8 py-3.5 select-none">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Lado Esquerdo: Marca ELO + Identificador da Mesa */}
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <button
              onClick={handleLogoClick}
              title="Toque 3 vezes para gerenciar o dispositivo"
              className="flex items-center gap-2 group cursor-pointer focus:outline-none"
            >
              <span className="text-xl font-bold tracking-tight text-[#191817] group-active:scale-95 transition-transform">
                ELO
              </span>
            </button>

            <div className="hidden sm:block h-4 w-[1px] bg-[#D8D2C9]" />

            {/* Contexto da Mesa */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-sm sm:text-sm font-semibold text-[#191817] whitespace-nowrap">Mesa {tableNumber}</span>
              <span
                className={`flex items-center gap-1 text-sm sm:text-sm font-semibold px-2 sm:px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                  isUnavailable
                    ? 'text-[#57534E] bg-[#EAE6E1] border border-[#D8D2C9]'
                    : tableStatus.includes('Conta') || tableStatus.includes('solicitada')
                    ? 'text-amber-900 bg-amber-100 border border-amber-200'
                    : tableStatus.includes('ocupada')
                    ? 'text-[#9E3712] bg-[#C84E1F]/15 border border-[#C84E1F]/20'
                    : 'text-[#2D6A4F] bg-[#2D6A4F]/10 border border-[#2D6A4F]/20'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isUnavailable
                      ? 'bg-[#9C948A]'
                      : tableStatus.includes('Conta') || tableStatus.includes('solicitada')
                      ? 'bg-amber-600'
                      : tableStatus.includes('ocupada')
                      ? 'bg-[#C84E1F]'
                      : 'bg-[#2D6A4F]'
                  }`}
                />
                <span className="sm:hidden">{compactStatus}</span>
                <span className="hidden sm:inline">{tableStatus}</span>
              </span>
            </div>
          </div>

          {/* Lado Direito: Acesso à Comanda */}
          <div className="flex items-center text-sm font-medium text-[#6E6760] shrink-0">
            <Link
              href={`/table/${tableNumber}/order`}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border border-[#EAE6E1] bg-white hover:border-[#191817]/40 text-[#191817] transition-colors whitespace-nowrap"
            >
              <Receipt className="w-3.5 h-3.5 text-[#C84E1F]" />
              <span className="sm:hidden">Comanda</span>
              <span className="hidden sm:inline">Ver comanda</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Modal Administrativo Protegido por PIN */}
      {showConfigModal && (
        <Modal isOpen={true} title="Gerenciar Este Tablet" isBusy={submitting} onClose={() => setShowConfigModal(false)}>
          <div className="w-full max-w-md bg-[#F9F8F6] rounded-3xl border border-[#EAE6E1] p-6 sm:p-7 shadow-2xl text-left space-y-5">
            <div className="flex items-center justify-between border-b border-[#EAE6E1] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#C84E1F]/10 flex items-center justify-center text-[#C84E1F]">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#191817]">Gerenciar Este Tablet</h3>
                  <p className="text-sm text-[#6E6760]">Mesa atual vinculada: {tableNumber}</p>
                </div>
              </div>
              <button
                disabled={submitting}
                onClick={() => setShowConfigModal(false)}
                aria-label="Fechar gerenciamento do tablet"
                className="w-8 h-8 rounded-full border border-[#EAE6E1] flex items-center justify-center text-[#6E6760] hover:bg-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTableConfig} className="space-y-4">
              {errorMsg && (
                <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-bold uppercase tracking-wider text-[#191817]">
                  Nova Numeração da Mesa
                </label>
                <input
                  type="text"
                  aria-label="Nova numeração da mesa"
                  placeholder="Ex: 01, 02, 10..."
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] bg-white text-sm text-[#191817] focus:outline-none focus:border-[#C84E1F]"
                  required
                />
              </div>

              <fieldset className="space-y-1.5">
                <legend className="text-sm font-bold uppercase tracking-wider text-[#191817] mb-1.5">
                  Autorização da gerência
                </legend>
                <input
                  type="email"
                  autoComplete="off"
                  aria-label="E-mail do gerente"
                  placeholder="E-mail do gerente"
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] bg-white text-sm text-[#191817] focus:outline-none focus:border-[#C84E1F]"
                  required
                />
                <input
                  type="password"
                  autoComplete="off"
                  aria-label="Senha do gerente"
                  placeholder="Senha"
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E1] bg-white text-sm text-[#191817] focus:outline-none focus:border-[#C84E1F]"
                  required
                />
              </fieldset>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#C84E1F]/15 disabled:opacity-60 disabled:cursor-wait"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Validando...' : 'Salvar e Trocar Mesa'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleUnlinkTablet()}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Desvincular Dispositivo (Voltar ao Setup)</span>
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
};
