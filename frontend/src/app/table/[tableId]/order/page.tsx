'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { SalonHeader } from '@/components/customer/SalonHeader';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  ChefHat,
  Flame,
  Plus,
  Users,
  CreditCard,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/components/ui/ToastProvider';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Modal } from '@/components/ui/Modal';
import { formatBRL } from '@/lib/format';
import { StripePaymentModal, isStripeConfigured } from '@/components/payment/StripePaymentModal';
import { useCustomerSession } from '@/hooks/useCustomerSession';

export default function OrderTrackingPage() {
  const params = useParams();
  const tableId = (params?.tableId as string) || '01';
  const { table, loading, refresh, requestBill } = useCustomerSession(tableId);

  const [splitCount, setSplitCount] = useState(2);
  const [includeService, setIncludeService] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
useEscapeKey(showPaymentModal, () => setShowPaymentModal(false));
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);

  const handleOpenBillModal = async () => {
    setRequestingBill(true);
    const result = await requestBill();
    setRequestingBill(false);
    if (result.duplicate) return;
    if (!result.success) {
      toast.warning('Atenção', result.message || 'Não foi possível pedir a conta.');
      return;
    }
    toast.success('Conta solicitada', 'O caixa já foi avisado e a equipe está a caminho.');
    setShowPaymentModal(true);
  };

  // Itens reais da comanda ativa no banco
  const activeOrder = table?.active_order;
  const items = activeOrder?.items || [];
  const orderStatus = activeOrder?.status ?? 'pending';

  // Cálculos financeiros em centavos, com a mesma regra de arredondamento do backend
  const subtotalCents = Math.round(Number(activeOrder?.subtotal || items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0)) * 100);
  const serviceFeeCents = includeService ? Math.round(subtotalCents * 0.1) : 0;
  const orderTotalCents = Math.round(Number(activeOrder?.total ?? subtotalCents / 100) * 100);
  const adjustment = (orderTotalCents - subtotalCents) / 100;
  const subtotal = subtotalCents / 100;
  const serviceFee = serviceFeeCents / 100;
  const totalCents = Math.max(orderTotalCents + serviceFeeCents, 0);
  const total = totalCents / 100;
  // Arredonda para cima: a soma das partes nunca fica abaixo do total
  const totalPerPerson = Math.ceil(totalCents / splitCount) / 100;

  const kitchenSummary =
    items.length === 0
      ? { title: 'Comanda aberta', description: 'Escolha seus pratos no cardápio para começar.' }
      : orderStatus === 'ready'
      ? { title: 'Pedido pronto', description: 'Seus pratos já estão saindo da cozinha.' }
      : orderStatus === 'delivered'
      ? { title: 'Pedido servido', description: 'Bom apetite! Peça mais quando quiser.' }
      : orderStatus === 'preparing'
      ? { title: 'Cozinha em preparo', description: 'Seus pedidos estão sendo preparados pela equipe.' }
      : { title: 'Pedido recebido', description: 'A cozinha já recebeu seu pedido e vai começar em instantes.' };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return (
          <span className="text-sm font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {status === 'confirmed' ? 'Confirmado na cozinha' : 'Na fila de pedidos'}
          </span>
        );
      case 'preparing':
        return (
          <span className="text-sm font-medium px-2 py-0.5 rounded-md bg-[#C84E1F]/10 text-[#C84E1F] flex items-center gap-1.5 w-fit">
            <ChefHat className="w-3.5 h-3.5" />
            Em preparo
          </span>
        );
      case 'ready':
        return (
          <span className="text-sm font-medium px-2 py-0.5 rounded-md bg-[#2D6A4F]/10 text-[#2D6A4F] flex items-center gap-1.5 w-fit">
            <Flame className="w-3.5 h-3.5" />
            Pronto para servir
          </span>
        );
      case 'delivered':
        return (
          <span className="text-sm font-medium px-2 py-0.5 rounded-md bg-[#2D6A4F]/10 text-[#2D6A4F] flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Entregue na mesa
          </span>
        );
      default:
        return (
          <span className="text-sm font-medium px-2 py-0.5 rounded-md bg-[#F2EFEA] text-[#6E6760] w-fit">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="elo-interface min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col justify-between selection:bg-[#C84E1F]/15">
      <div>
        <SalonHeader tableNumber={tableId} />

        {/* Top bar de navegação */}
        <div className="bg-[#F9F8F6]/95 border-b border-[#EAE6E1] px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Link
              href={`/table/${tableId}`}
              className="p-2.5 rounded-xl bg-white border border-[#EAE6E1] hover:border-[#191817]/40 text-[#191817] transition-colors"
              title="Voltar ao início"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="text-center">
              <h2 className="text-sm font-bold text-[#191817]">Comanda digital</h2>
              <p className="text-sm text-[#6E6760]">Consumo ativo da Mesa {tableId}</p>
            </div>
            <Link
              href={`/table/${tableId}/menu`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#EAE6E1] text-sm font-semibold text-[#191817] hover:border-[#191817]/40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#C84E1F]" />
              <span>Pedir mais</span>
            </Link>
          </div>
        </div>

        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-28">
          {/* Status Geral de Preparo */}
          <div className="p-4 rounded-2xl bg-white border border-[#EAE6E1] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F9F8F6] border border-[#EAE6E1] flex items-center justify-center text-[#C84E1F]">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#191817]">{kitchenSummary.title}</h3>
                <p className="text-sm text-[#6E6760]">{kitchenSummary.description}</p>
              </div>
            </div>
            {items.length > 0 && (orderStatus === 'pending' || orderStatus === 'confirmed' || orderStatus === 'preparing') && (
              <div className="text-right">
                <span className="text-sm text-[#6E6760]">Tempo estimado</span>
                <p className="text-sm font-semibold text-[#191817] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#C84E1F]" />
                  ~ 12-15 min
                </p>
              </div>
            )}
          </div>

          {/* Lista de Itens da Comanda */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-[#191817]">
                Itens na comanda
              </h3>
              <span className="text-sm text-[#6E6760]">
                {items.length} {items.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            {items.length === 0 && (
              <div className="p-8 rounded-2xl bg-white border border-[#EAE6E1] text-center text-sm text-[#6E6760]">
                {loading ? 'Carregando comanda...' : 'Nenhum item pedido ainda nesta comanda.'}
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-white border border-[#EAE6E1] flex items-start justify-between"
              >
                <div className="flex-1 pr-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-md bg-[#F9F8F6] border border-[#EAE6E1] text-[#191817] text-sm font-bold flex items-center justify-center">
                      {item.quantity}x
                    </span>
                    <h4 className="text-sm sm:text-sm font-bold text-[#191817]">{item.product_name}</h4>
                  </div>
                  {item.notes && (
                    <p className="text-sm text-[#6E6760] mb-2 pl-7">{item.notes}</p>
                  )}
                  <div className="pl-7">{getStatusBadge(item.status ?? activeOrder?.status ?? 'pending')}</div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-[#191817]">
                    {formatBRL(Number(item.subtotal || item.unit_price * item.quantity))}
                  </span>
                  <p className="text-sm text-[#6E6760]">
                    {formatBRL(Number(item.unit_price))} un
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Calculadora de Divisão & Fechamento */}
          <div className="p-4 rounded-2xl bg-white border border-[#EAE6E1] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#191817]" />
                <span className="text-sm font-bold text-[#191817]">Dividir a conta</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSplitCount((prev) => Math.max(1, prev - 1))}
                  disabled={splitCount <= 1}
                  aria-label="Diminuir número de pessoas"
                  className="w-7 h-7 rounded-lg bg-[#F9F8F6] border border-[#EAE6E1] hover:bg-[#F2EFEA] text-[#191817] font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-40"
                >
                  -
                </button>
                <span className="text-sm font-semibold px-2" aria-live="polite">
                  {splitCount} {splitCount === 1 ? 'pessoa' : 'pessoas'}
                </span>
                <button
                  onClick={() => setSplitCount((prev) => Math.min(20, prev + 1))}
                  disabled={splitCount >= 20}
                  aria-label="Aumentar número de pessoas"
                  className="w-7 h-7 rounded-lg bg-[#F9F8F6] border border-[#EAE6E1] hover:bg-[#F2EFEA] text-[#191817] font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F2EFEA] space-y-1.5 text-sm">
              <div className="flex justify-between text-[#6E6760]">
                <span>Subtotal dos itens</span>
                <span>{formatBRL(subtotal)}</span>
              </div>

              {adjustment !== 0 && (
                <div className="flex justify-between text-[#6E6760]">
                  <span>Taxas e descontos da comanda</span>
                  <span>{formatBRL(adjustment)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-[#6E6760]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeService}
                    onChange={(e) => setIncludeService(e.target.checked)}
                    className="rounded border-[#D8D2C9] text-[#C84E1F] focus:ring-0"
                  />
                  <span>Taxa de serviço da equipe (10%)</span>
                </label>
                <span>{formatBRL(serviceFee)}</span>
              </div>

              <div className="flex justify-between text-sm font-bold text-[#191817] pt-2 border-t border-[#F2EFEA]">
                <span>Total da mesa</span>
                <span>{formatBRL(total)}</span>
              </div>

              {splitCount > 1 && (
                <div className="flex justify-between text-sm font-bold text-[#C84E1F] pt-1">
                  <span>Por pessoa ({splitCount}x)</span>
                  <span>{formatBRL(totalPerPerson)}</span>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Botão de Fechar Conta / Pagar */}
      <footer className="sticky bottom-0 z-30 p-4 bg-[#F9F8F6]/95 backdrop-blur-md border-t border-[#EAE6E1]">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Link
            href={`/table/${tableId}/menu`}
            className="flex-1 py-3 px-3 rounded-xl bg-white border border-[#EAE6E1] hover:border-[#191817]/40 text-[#191817] font-semibold text-sm text-center flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#C84E1F]" />
            <span>Adicionar pratos</span>
          </Link>

          <button
            onClick={handleOpenBillModal}
            disabled={requestingBill || items.length === 0}
            className="flex-[2] py-3 px-4 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-sm sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4" />
            <span>{requestingBill ? 'Solicitando conta...' : `Pedir conta (${formatBRL(total)})`}</span>
          </button>
        </div>
      </footer>

      {/* Modal de Pagamento / QR Code Pix */}
      {showPaymentModal && (
        <Modal isOpen={showPaymentModal} title={`Pagamento da Mesa ${tableId}`} onClose={() => setShowPaymentModal(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#EAE6E1] p-6 shadow-xl text-center">
            <h3 className="text-base font-bold text-[#191817] mb-1">Pagamento da Mesa {tableId}</h3>
            <p className="text-sm text-[#6E6760] mb-4">
              {isStripeConfigured ? 'Pague agora com cartão pelo tablet ou aguarde a equipe para PIX, maquininha ou dinheiro.' : 'A equipe já foi avisada e vem até a mesa para receber via PIX, maquininha ou dinheiro.'}
            </p>

            <div className="text-sm text-[#6E6760] mb-5 p-4 rounded-xl bg-[#F9F8F6] border border-[#EAE6E1]">
              <p className="font-bold text-[#191817] text-2xl mb-1">
                {formatBRL(total)}
              </p>
              {splitCount > 1 && (
                <p className="text-sm text-[#6E6760]">
                  {splitCount} pessoas • {formatBRL(totalPerPerson)} cada
                </p>
              )}
            </div>

            <div className="space-y-2">
              {isStripeConfigured && (
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setShowStripeModal(true);
                }}
                className="w-full py-3 rounded-xl bg-[#191817] hover:bg-[#2C2A29] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <CreditCard className="w-4 h-4 text-[#C84E1F]" />
                Pagar com Cartão (Stripe Online)
              </button>
              )}
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-full py-3 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Pagar com a equipe (PIX, maquininha ou dinheiro)
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Pagamento Seguro Stripe */}
      <StripePaymentModal
        isOpen={showStripeModal}
        onClose={() => setShowStripeModal(false)}
        tableNumber={tableId}
        amount={total}
        includeService={includeService}
        onSuccess={() => {
          toast.success('Conta Liquidada', 'Pagamento efetuado com sucesso via cartão!');
          setShowStripeModal(false);
          refresh();
        }}
      />
    </div>
  );
}
