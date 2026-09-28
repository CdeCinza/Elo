'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SalonHeader } from '@/components/customer/SalonHeader';
import { EditorialHero } from '@/components/customer/EditorialHero';
import { QuickActionsBar } from '@/components/customer/QuickActionsBar';
import { StartHereSection } from '@/components/customer/StartHereSection';
import { HouseFavoritesSection } from '@/components/customer/HouseFavoritesSection';
import { ClosingExperienceBanner } from '@/components/customer/ClosingExperienceBanner';
import { CheckCircle2, User, Smartphone, Sparkles } from 'lucide-react';
import { useCustomerSession, Product } from '@/hooks/useCustomerSession';
import { toast } from '@/components/ui/ToastProvider';
import { useEscapeKey } from '@/hooks/useEscapeKey';

export default function TableHomePage() {
  const params = useParams();
  const router = useRouter();
  const tableId = (params?.tableId as string) || '01';
  const { table, categories, products, loading, error, refresh, checkIn, callWaiter } = useCustomerSession(tableId);

  const [waiterCalled, setWaiterCalled] = useState(false);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
useEscapeKey(showPreferenceModal, () => setShowPreferenceModal(false));
  const [startingSession, setStartingSession] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const previousStatusRef = useRef<string | undefined>(undefined);

  // Quando o caixa libera a mesa, o tablet volta à tela de boas-vindas para os próximos clientes
  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = table?.status;
    if (previousStatus && previousStatus !== 'free' && table?.status === 'free') {
      const resetTimer = setTimeout(() => {
        setSessionStarted(false);
        setShowPreferenceModal(false);
        setWaiterCalled(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }
  }, [table?.status]);

  // Mesa é considerada livre se status for 'free' e não houver itens pedidos e a sessão local ainda não foi iniciada
  const isTableFree = !sessionStarted && table?.status === 'free' && (!table.active_order || table.active_order.items.length === 0);

  const handleStartAttendance = async () => {
    setStartingSession(true);
    const result = await checkIn();
    setStartingSession(false);
    if (result.duplicate) return;
    if (!result.success) {
      toast.warning('Atenção', result.message || 'Não foi possível iniciar o atendimento.');
      return;
    }
    setSessionStarted(true);
    setShowPreferenceModal(true);
  };

  const handleChooseWaiter = async () => {
    if (callingWaiter) return;
    setCallingWaiter(true);
    const result = await callWaiter();
    setCallingWaiter(false);
    if (result.duplicate) return;
    if (!result.success) {
      toast.warning('Atenção', result.message || 'Não foi possível chamar o garçom.');
      return;
    }
    setWaiterCalled(true);
    setShowPreferenceModal(false);
    setSessionStarted(true);
    setTimeout(() => {
      setWaiterCalled(false);
    }, 6000);
  };

  const handleChooseTablet = () => {
    setShowPreferenceModal(false);
    setSessionStarted(true);
    router.push(`/table/${tableId}/menu`);
  };

  const dynamicFavorites = products.filter((product) => product.available).slice(0, 4).map((p: Product) => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    price: p.price,
    image: p.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
  }));

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col justify-between selection:bg-[#C84E1F]/15 font-sans">
      <div>
        {/* Header Fixo com Status Real da Mesa */}
        <SalonHeader
          tableNumber={tableId}
          tableStatus={
            error
              ? 'Indisponível'
              : loading
              ? 'Carregando'
              : table?.status === 'occupied'
              ? 'Mesa ocupada'
              : table?.status === 'bill_requested'
              ? 'Conta solicitada'
              : table?.status === 'free' ? 'Mesa livre' : 'Indisponível'
          }
        />

        {/* Alerta de Garçom Chamado */}
        {waiterCalled && (
          <div className="max-w-4xl mx-auto px-5 sm:px-8 mt-4">
            <div className="p-4 rounded-2xl bg-white border border-[#2D6A4F]/30 text-[#191817] flex items-center gap-3 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-[#2D6A4F] shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-[#191817]">Garçom chamado com sucesso</p>
                <p className="text-[#6E6760]">
                  Um integrante da nossa equipe está a caminho da Mesa {tableId}. Sinta-se à vontade para navegar no cardápio enquanto isso.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 1. TELA DE CHEGADA: Se a mesa estiver livre e o cliente acabou de sentar */}
        {!table ? (
          <main className="max-w-2xl mx-auto px-6 py-16 text-center flex flex-col items-center justify-center min-h-[70vh]">
            <h1 className="text-3xl font-serif font-bold text-[#191817] mb-3">
              {loading ? 'Carregando mesa...' : 'Mesa indisponível'}
            </h1>
            {!loading && (
              <>
                <p className="text-sm text-[#6E6760] max-w-md mb-6">
                  {error || 'Não foi possível encontrar esta mesa. Peça ajuda à equipe.'}
                </p>
                <button
                  onClick={() => void refresh()}
                  className="px-6 py-3 rounded-xl bg-[#C84E1F] text-white font-semibold text-sm cursor-pointer"
                >
                  Tentar novamente
                </button>
              </>
            )}
          </main>
        ) : isTableFree && !showPreferenceModal ? (
          <main className="max-w-2xl mx-auto px-6 py-16 text-center flex flex-col items-center justify-center min-h-[70vh]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9E3712] bg-[#C84E1F]/10 px-3 py-1 rounded-full mb-4">
              Atendimento Digital • ELO
            </span>

            <h1 className="text-4xl sm:text-5xl font-serif font-bold text-[#191817] tracking-tight mb-3">
              Bem-vindo à Mesa {tableId}
            </h1>

            <p className="text-sm sm:text-base text-[#6E6760] max-w-md leading-relaxed mb-8">
              Acomode-se e toque no botão abaixo para iniciar seu atendimento. Você poderá escolher entre ser atendido por um garçom ou pedir diretamente pelo tablet.
            </p>

            <button
              onClick={handleStartAttendance}
              disabled={startingSession}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-base shadow-lg shadow-[#C84E1F]/20 hover:shadow-none transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              <span>{startingSession ? 'Iniciando atendimento...' : 'Iniciar atendimento • Estou na mesa'}</span>
            </button>

            <p className="text-xs text-[#57534E] mt-6">
              Ao tocar, nossa equipe no salão saberá que você chegou à mesa.
            </p>
          </main>
        ) : (
          /* 2. CARDÁPIO E EXPERIÊNCIA ATIVA DA MESA */
          <main className="max-w-4xl mx-auto px-5 sm:px-8 pt-6 pb-16">
            {/* Hero Editorial */}
            <EditorialHero tableId={tableId} />

            {/* Barra de Ações Rápidas */}
            <QuickActionsBar
              tableId={tableId}
              onCallWaiter={handleChooseWaiter}
            />

            {/* Categorias */}
            <StartHereSection tableId={tableId} categories={categories} />

            {/* Mais Pedidos */}
            <HouseFavoritesSection
              tableId={tableId}
              products={dynamicFavorites}
            />

            {/* Banner de Fechamento */}
            <ClosingExperienceBanner />
          </main>
        )}
      </div>

      {/* MODAL: Preferência de Atendimento (Garçom vs Tablet) */}
      {showPreferenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#F9F8F6] rounded-3xl border border-[#EAE6E1] p-6 sm:p-8 shadow-2xl text-left space-y-6">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9E3712] bg-[#C84E1F]/15 px-2.5 py-0.5 rounded-md">
                Mesa {tableId} • Check-in realizado
              </span>
              <h2 className="text-2xl font-serif font-bold text-[#191817] mt-2">
                Como prefere ser atendido hoje?
              </h2>
              <p className="text-xs text-[#6E6760] mt-1">
                Escolha o modo mais confortável para você e seus acompanhantes:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Opção 1: Chamar Garçom */}
              <button
                onClick={handleChooseWaiter}
                className="p-5 rounded-2xl bg-white border border-[#EAE6E1] hover:border-[#C84E1F] text-left transition-all group flex flex-col justify-between hover:shadow-md cursor-pointer"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-[#F9F8F6] border border-[#EAE6E1] group-hover:border-[#C84E1F] group-hover:bg-[#C84E1F]/10 flex items-center justify-center text-[#C84E1F] mb-3 transition-colors">
                    <User className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-[#191817] group-hover:text-[#C84E1F] transition-colors">
                    Chamar um garçom
                  </h3>
                  <p className="text-xs text-[#6E6760] mt-1 leading-relaxed">
                    Um integrante da nossa equipe virá até a mesa para apresentar os destaques e anotar o pedido.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-[#9E3712] mt-4 block">
                  Solicitar equipe →
                </span>
              </button>

              {/* Opção 2: Fazer Pedido pelo Tablet */}
              <button
                onClick={handleChooseTablet}
                className="p-5 rounded-2xl bg-white border-2 border-[#C84E1F] text-left transition-all hover:shadow-md cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-[#C84E1F]/15 flex items-center justify-center text-[#C84E1F] mb-3">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-[#191817]">
                    Pedir pelo tablet
                  </h3>
                  <p className="text-xs text-[#6E6760] mt-1 leading-relaxed">
                    Navegue pelo cardápio completo, veja fotos e envie os pedidos diretamente para a cozinha com rapidez.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-[#9E3712] mt-4 block">
                  Abrir cardápio digital →
                </span>
              </button>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowPreferenceModal(false)}
                className="text-xs text-[#57534E] hover:text-[#191817] transition-colors underline cursor-pointer"
              >
                Explorar o cardápio sem definir preferência agora
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-[#EAE6E1] py-6 px-6 text-center text-xs text-[#6E6760]">
        ELO Gastronomia • Cardápio Digital na Mesa
      </footer>
    </div>
  );
}
