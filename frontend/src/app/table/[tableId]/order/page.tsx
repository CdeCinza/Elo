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
  QrCode,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/components/ui/ToastProvider';

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered';
  notes?: string;
}

const INITIAL_ITEMS: OrderItem[] = [
  {
    id: 1,
    name: 'Smash ELO Bacon Duplo',
    quantity: 2,
    price: 36.9,
    status: 'preparing',
    notes: 'Ponto: Ao ponto • Sem cebola',
  },
  {
    id: 2,
    name: 'Batata Rústica com Alecrim',
    quantity: 1,
    price: 24.5,
    status: 'ready',
  },
  {
    id: 3,
    name: 'Soda Italiana de Maracujá',
    quantity: 2,
    price: 16.0,
    status: 'delivered',
  },
];

import { useCustomerSession } from '@/hooks/useCustomerSession';

export default function OrderTrackingPage() {
  const params = useParams();
  const tableId = (params?.tableId as string) || '01';
  const { table, loading, refresh, requestBill } = useCustomerSession(tableId);

  const [splitCount, setSplitCount] = useState(2);
  const [includeService, setIncludeService] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);

  const handleOpenBillModal = async () => {
    setRequestingBill(true);
    await requestBill();
    setRequestingBill(false);
    setShowPaymentModal(true);
  };

  // Itens reais da comanda ativa no banco
  const activeOrder = table?.active_order;
  const items = activeOrder?.items || [];

  // Cálculos financeiros reais da comanda
  const subtotal = Number(activeOrder?.subtotal || items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0));
  const serviceFee = includeService ? subtotal * 0.1 : 0;
  const total = subtotal + serviceFee;
  const totalPerPerson = splitCount > 0 ? total / splitCount : total;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {status === 'confirmed' ? 'Confirmado na cozinha' : 'Na fila de pedidos'}
          </span>
        );
      case 'preparing':
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#C84E1F]/10 text-[#C84E1F] flex items-center gap-1.5 w-fit">
            <ChefHat className="w-3.5 h-3.5" />
            Em preparo
          </span>
        );
      case 'ready':
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#2D6A4F]/10 text-[#2D6A4F] flex items-center gap-1.5 w-fit">
            <Flame className="w-3.5 h-3.5" />
            Pronto para servir
          </span>
        );
      case 'delivered':
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#2D6A4F]/10 text-[#2D6A4F] flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Entregue na mesa
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#F2EFEA] text-[#6E6760] w-fit">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col justify-between selection:bg-[#C84E1F]/15">
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
              <p className="text-[11px] text-[#6E6760]">Consumo ativo da Mesa {tableId}</p>
            </div>
            <Link
              href={`/table/${tableId}/menu`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#EAE6E1] text-xs font-semibold text-[#191817] hover:border-[#191817]/40 transition-colors"
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
                <h3 className="text-xs font-bold text-[#191817]">Cozinha em preparo</h3>
                <p className="text-[11px] text-[#6E6760]">Seus pedidos estão sendo preparados pela equipe</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#6E6760]">Tempo estimado</span>
              <p className="text-xs font-semibold text-[#191817] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#C84E1F]" />
                ~ 12-15 min
              </p>
            </div>
          </div>

          {/* Lista de Itens da Comanda */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold text-[#191817]">
                Itens na comanda
              </h3>
              <span className="text-xs text-[#6E6760]">
                {items.length} {items.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            {items.length === 0 && (
              <div className="p-8 rounded-2xl bg-white border border-[#EAE6E1] text-center text-xs text-[#6E6760]">
                Nenhum item pedido ainda nesta comanda.
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-white border border-[#EAE6E1] flex items-start justify-between"
              >
                <div className="flex-1 pr-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-md bg-[#F9F8F6] border border-[#EAE6E1] text-[#191817] text-xs font-bold flex items-center justify-center">
                      {item.quantity}x
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-[#191817]">{item.product_name}</h4>
                  </div>
                  {item.notes && (
                    <p className="text-[11px] text-[#6E6760] mb-2 pl-7">{item.notes}</p>
                  )}
                  <div className="pl-7">{getStatusBadge(activeOrder?.status || 'pending')}</div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-[#191817]">
                    R$ {Number(item.subtotal || item.unit_price * item.quantity).toFixed(2).replace('.', ',')}
                  </span>
                  <p className="text-[10px] text-[#6E6760]">
                    R$ {Number(item.unit_price).toFixed(2).replace('.', ',')} un
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
                <span className="text-xs font-bold text-[#191817]">Dividir a conta</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSplitCount((prev) => Math.max(1, prev - 1))}
                  className="w-7 h-7 rounded-lg bg-[#F9F8F6] border border-[#EAE6E1] hover:bg-[#F2EFEA] text-[#191817] font-bold text-sm flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <span className="text-xs font-semibold px-2">{splitCount} pessoas</span>
                <button
                  onClick={() => setSplitCount((prev) => prev + 1)}
                  className="w-7 h-7 rounded-lg bg-[#F9F8F6] border border-[#EAE6E1] hover:bg-[#F2EFEA] text-[#191817] font-bold text-sm flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F2EFEA] space-y-1.5 text-xs">
              <div className="flex justify-between text-[#6E6760]">
                <span>Subtotal dos itens</span>
                <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
              </div>

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
                <span>R$ {serviceFee.toFixed(2).replace('.', ',')}</span>
              </div>

              <div className="flex justify-between text-sm font-bold text-[#191817] pt-2 border-t border-[#F2EFEA]">
                <span>Total da mesa</span>
                <span>R$ {total.toFixed(2).replace('.', ',')}</span>
              </div>

              {splitCount > 1 && (
                <div className="flex justify-between text-xs font-bold text-[#C84E1F] pt-1">
                  <span>Por pessoa ({splitCount}x)</span>
                  <span>R$ {totalPerPerson.toFixed(2).replace('.', ',')}</span>
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
            className="flex-1 py-3 px-3 rounded-xl bg-white border border-[#EAE6E1] hover:border-[#191817]/40 text-[#191817] font-semibold text-xs text-center flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#C84E1F]" />
            <span>Adicionar pratos</span>
          </Link>

          <button
            onClick={handleOpenBillModal}
            disabled={requestingBill}
            className="flex-[2] py-3 px-4 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4" />
            <span>{requestingBill ? 'Solicitando conta...' : `Pedir conta (R$ ${total.toFixed(2).replace('.', ',')})`}</span>
          </button>
        </div>
      </footer>

      {/* Modal de Pagamento / QR Code Pix */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#EAE6E1] p-6 shadow-xl text-center">
            <h3 className="text-base font-bold text-[#191817] mb-1">Pagamento da Mesa {tableId}</h3>
            <p className="text-xs text-[#6E6760] mb-4">
              Escaneie o código PIX para efetuar o pagamento direto ou chame o garçom para a máquina de cartão.
            </p>

            {/* QR Code */}
            <div className="w-44 h-44 mx-auto rounded-xl bg-[#F9F8F6] border border-[#EAE6E1] p-3 flex items-center justify-center mb-4">
              <QrCode className="w-full h-full text-[#191817]" />
            </div>

            <div className="text-xs text-[#6E6760] mb-5">
              <p className="font-bold text-[#191817] text-xl mb-1">
                R$ {total.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-[11px] text-[#6E6760]">Chave Copia e Cola disponível</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  toast.success('Chave PIX copiada para a área de transferência!', 'Código PIX');
                  setShowPaymentModal(false);
                }}
                className="w-full py-3 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Copiar código PIX
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#F9F8F6] border border-[#EAE6E1] hover:bg-[#F2EFEA] text-[#191817] text-xs font-medium transition-colors"
              >
                Fechar / Pagar na máquina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
