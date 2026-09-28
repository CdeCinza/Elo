'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tablet, ShieldCheck, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/ToastProvider';
import { getLinkedTable, linkTabletToTable, normalizeTableNumber, tableExists, verifyManagerCredentials } from '@/lib/tablet';

export default function TabletSetupPage() {
  const router = useRouter();
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [selectedTable, setSelectedTable] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableTables, setAvailableTables] = useState<Array<{ id: number; number: string; status: string }>>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [customTableNumber, setCustomTableNumber] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    const savedTable = getLinkedTable();
    if (savedTable) {
      router.replace(`/table/${savedTable}`);
      return;
    }

    let active = true;
    api.get('/customer/tables')
      .then((res) => {
        if (active && res.data?.tables) {
          setAvailableTables(res.data.tables);
          if (res.data.tables.length > 0) {
            setSelectedTable(res.data.tables[0].number);
          }
        }
      })
      .catch(() => {
        if (active) setErrorMsg('Não foi possível carregar as mesas. Tente novamente mais tarde.');
      })
      .finally(() => {
        if (active) {
          setLoadingTables(false);
          setCheckingStorage(false);
        }
      });

    return () => { active = false; };
  }, [router]);

  const handleSaveTabletConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const tableNumberToSave = isCustom ? customTableNumber.trim() : selectedTable;

    if (!tableNumberToSave) {
      setErrorMsg('Selecione ou digite um número de mesa válido.');
      return;
    }

    setSubmitting(true);
    try {
      const verification = await verifyManagerCredentials(managerEmail, managerPassword);
      if (!verification.success) {
        setErrorMsg(verification.message);
        return;
      }

      const finalNumber = normalizeTableNumber(tableNumberToSave);
      if (!(await tableExists(finalNumber))) {
        setErrorMsg('Esta mesa não existe no restaurante. Escolha uma mesa cadastrada.');
        return;
      }

      linkTabletToTable(finalNumber);
      toast.success('Dispositivo Configurado', `Tablet vinculado à Mesa ${finalNumber} com sucesso!`);
      router.replace(`/table/${finalNumber}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingStorage) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white border border-[#EAE6E1] flex items-center justify-center mb-4 shadow-sm animate-pulse">
          <Tablet className="w-6 h-6 text-[#C84E1F]" />
        </div>
        <p className="text-sm text-[#6E6760]">Identificando configuração deste dispositivo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col justify-between selection:bg-[#C84E1F]/15 font-sans">
      {/* Header Fixo */}
      <header className="border-b border-[#EAE6E1] bg-[#F9F8F6]/90 backdrop-blur-md px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-[#191817]">ELO</span>
            <span className="text-xs text-[#6E6760] font-normal border-l border-[#D8D2C9] pl-3">
              Configuração do Dispositivo
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#9E3712] font-semibold bg-[#C84E1F]/15 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Modo Kiosk / Setup</span>
          </div>
        </div>
      </header>

      {/* Área Central de Setup */}
      <main className="max-w-lg mx-auto w-full px-6 py-10 flex-1 flex flex-col justify-center">
        <div className="bg-white rounded-3xl border border-[#EAE6E1] p-7 sm:p-9 shadow-xl shadow-black/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#C84E1F]/10 flex items-center justify-center text-[#C84E1F]">
              <Tablet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#191817]">Vincular Tablet à Mesa</h1>
              <p className="text-xs text-[#6E6760]">
                Defina a qual mesa este tablet pertence no salão
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveTabletConfig} className="space-y-6">
            {/* Mensagem de Erro */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Seleção da Mesa */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#191817]">
                  Número da Mesa
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustom(!isCustom)}
                  className="text-xs text-[#C84E1F] hover:underline"
                >
                  {isCustom ? 'Escolher da lista' : 'Digitar número manual'}
                </button>
              </div>

              {!isCustom ? (
                <div>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 border border-[#EAE6E1] rounded-2xl bg-[#F9F8F6]">
                    {!loadingTables && availableTables.length === 0 && (
                      <p className="col-span-4 py-4 text-center text-xs text-[#6E6760]">
                        Nenhuma mesa disponível para seleção.
                      </p>
                    )}
                    {availableTables.map((t) => {
                      const isSelected = selectedTable === t.number;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTable(t.number)}
                          className={`py-3 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                            isSelected
                              ? 'bg-[#191817] text-white shadow-md'
                              : 'bg-white text-[#191817] hover:bg-[#EAE6E1]/50 border border-[#EAE6E1]'
                          }`}
                        >
                          <span>Mesa</span>
                          <span className="text-base">{t.number}</span>
                        </button>
                      );
                    })}
                  </div>
                  {loadingTables && (
                    <p className="text-[11px] text-[#6E6760] mt-1 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Carregando mesas do salão...
                    </p>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  aria-label="Número da mesa"
                  placeholder="Ex: 01, 15, Varanda 2..."
                  value={customTableNumber}
                  onChange={(e) => setCustomTableNumber(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#EAE6E1] bg-[#F9F8F6] text-sm text-[#191817] focus:outline-none focus:border-[#C84E1F]"
                  required
                />
              )}
            </div>

            {/* Autorização da Gerência */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wider text-[#191817] mb-2">
                Autorização da gerência
              </legend>
              <input
                type="email"
                autoComplete="off"
                aria-label="E-mail do gerente"
                placeholder="E-mail do gerente"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#EAE6E1] bg-[#F9F8F6] text-sm text-[#191817] focus:outline-none focus:border-[#C84E1F]"
                required
              />
              <input
                type="password"
                autoComplete="off"
                aria-label="Senha do gerente"
                placeholder="Senha"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#EAE6E1] bg-[#F9F8F6] text-sm text-[#191817] focus:outline-none focus:border-[#C84E1F]"
                required
              />
              <p className="text-[11px] text-[#6E6760]">
                Necessário para evitar que clientes alterem a numeração da mesa. A sessão não fica salva no tablet.
              </p>
            </fieldset>

            {/* Botão de Salvar e Iniciar Operação */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-sm shadow-lg shadow-[#C84E1F]/20 hover:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Validando...' : 'Fixar neste Tablet e Iniciar'}</span>
            </button>
          </form>
        </div>
      </main>

      {/* Rodapé Informativo */}
      <footer className="border-t border-[#EAE6E1] py-4 px-6 text-center text-xs text-[#6E6760]">
        ELO Gastronomia • Sistema de Autoatendimento & Totem
      </footer>
    </div>
  );
}
