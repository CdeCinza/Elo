'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatBRL } from '@/lib/format';
import { CreditCard, CheckCircle2, AlertCircle, Loader2, X, ShieldCheck } from 'lucide-react';

interface StripeCardElement {
  mount(element: HTMLElement): void;
}

interface StripeInstance {
  elements(): {
    create(type: 'card', options: Record<string, unknown>): StripeCardElement;
  };
  confirmCardPayment(clientSecret: string, options: { payment_method: { card: StripeCardElement } }): Promise<{
    error?: { message?: string };
    paymentIntent?: { id: string; status: string };
  }>;
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeInstance;
  }
}

/** Pagamento com cartão só aparece quando a chave publicável do Stripe está configurada. */
export const isStripeConfigured = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

interface StripePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber?: string;
  orderId?: number;
  amount: number;
  includeService?: boolean;
  onSuccess: (data: unknown) => void;
}

export function StripePaymentModal({
  isOpen,
  onClose,
  tableNumber,
  orderId,
  amount,
  includeService = false,
  onSuccess,
}: StripePaymentModalProps) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [finalAmount, setFinalAmount] = useState<number>(amount);

  const [stripeInstance, setStripeInstance] = useState<StripeInstance | null>(null);
  const [cardElement, setCardElement] = useState<StripeCardElement | null>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const initStripe = async () => {
      try {
        if (!publishableKey) {
          throw new Error('Pagamento com cartão indisponível no momento. Use PIX ou dinheiro.');
        }

        if (!window.Stripe) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Não foi possível conectar ao Stripe. Verifique a internet e tente novamente.'));
            document.body.appendChild(script);
          });
        }

        const stripe = window.Stripe!(publishableKey);
        if (!isMounted) return;
        setStripeInstance(stripe);

        const intentRes = await api.post('/payments/stripe/create-intent', {
          table_number: tableNumber,
          order_id: orderId,
          include_service: includeService,
        });

        if (!isMounted) return;

        const secret = intentRes.data.client_secret;
        setClientSecret(secret);
        setFinalAmount(Number(intentRes.data.amount) || 0);

        const elements = stripe.elements();
        const card = elements.create('card', {
          style: {
            base: {
              fontSize: '15px',
              color: '#191817',
              fontFamily: 'Inter, system-ui, sans-serif',
              '::placeholder': {
                color: '#A8A199',
              },
            },
            invalid: {
              color: '#DC2626',
            },
          },
        });

        setCardElement(card);

        setTimeout(() => {
          if (cardContainerRef.current) {
            cardContainerRef.current.innerHTML = '';
            card.mount(cardContainerRef.current);
          }
        }, 100);

        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        console.error('Erro ao inicializar pagamento Stripe:', err);
        setErrorMessage(
          getApiErrorMessage(err, err instanceof Error ? err.message : 'Erro ao inicializar checkout seguro.')
        );
        setLoading(false);
      }
    };

    const startCheckout = setTimeout(() => {
      setLoading(true);
      setErrorMessage(null);
      setSuccess(false);
      setClientSecret(null);
      void initStripe();
    }, 0);

    return () => {
      clearTimeout(startCheckout);
      isMounted = false;
    };
  }, [isOpen, tableNumber, orderId, includeService, publishableKey]);

  useEffect(() => {
    if (!isOpen || processing) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, processing, onClose]);

  if (!isOpen) return null;

  // Enquanto o Stripe não devolve o valor oficial, exibe o total calculado pela tela que abriu o modal
  const displayedAmount = clientSecret ? finalAmount : amount;
  const isTestMode = publishableKey.startsWith('pk_test_');

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeInstance || !cardElement || !clientSecret) return;

    setProcessing(true);
    setErrorMessage(null);

    try {
      const result = await stripeInstance.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (result.error) {
        setErrorMessage(result.error.message || 'O pagamento não pôde ser processado.');
        setProcessing(false);
        return;
      }

      if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        const confirmRes = await api.post('/payments/stripe/confirm', {
          payment_intent_id: result.paymentIntent.id,
          table_number: tableNumber,
          order_id: orderId,
        });

        setSuccess(true);
        setProcessing(false);

        setTimeout(() => {
          onSuccess(confirmRes.data);
          onClose();
        }, 1500);
      } else {
        setErrorMessage('O banco ainda está processando este pagamento. Aguarde alguns instantes e confira a comanda antes de tentar novamente.');
        setProcessing(false);
      }
    } catch (err) {
      console.error('Erro na confirmação do pagamento:', err);
      setErrorMessage(
        getApiErrorMessage(err, err instanceof Error ? err.message : 'Falha ao confirmar recebimento no sistema.')
      );
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pagamento com cartão"
        className="w-full max-w-md bg-white rounded-3xl border border-[#EAE6E1] p-6 shadow-2xl relative text-[#191817]"
      >
        <button
          onClick={onClose}
          disabled={processing}
          aria-label="Fechar pagamento"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF8F5] border border-[#EAE6E1] flex items-center justify-center text-[#78716A] hover:text-[#191817] transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-[#C84E1F]/10 border border-[#C84E1F]/20 flex items-center justify-center text-[#C84E1F] shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#191817] tracking-tight">
              Pagamento com Cartão
            </h2>
            <p className="text-xs text-[#78716A]">
              Checkout seguro via Stripe • {tableNumber ? `Mesa ${tableNumber}` : `Pedido #${orderId}`}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6E1] mb-5 flex items-center justify-between">
          <span className="text-xs text-[#78716A] font-medium">Total a cobrar:</span>
          <span className="text-xl font-bold text-[#C84E1F]">
            {formatBRL(displayedAmount)}
          </span>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-emerald-800">
              Pagamento Aprovado!
            </h3>
            <p className="text-xs text-[#78716A]">
              O pagamento foi confirmado e a mesa foi liberada com sucesso.
            </p>
          </div>
        ) : (
          <form onSubmit={handlePay} className="space-y-4">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#191817] mb-2">
                Dados do Cartão (Crédito ou Débito)
              </label>

              {loading ? (
                <div className="h-12 rounded-xl bg-[#FAF8F5] border border-[#EAE6E1] flex items-center justify-center gap-2 text-xs text-[#78716A]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#C84E1F]" />
                  <span>Conectando com o Stripe seguro...</span>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] focus-within:border-[#C84E1F] focus-within:bg-white transition-colors">
                  <div ref={cardContainerRef} id="stripe-card-element" />
                </div>
              )}
            </div>

            {isTestMode && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/70 text-[11px] text-amber-900 flex items-center justify-between">
                <span>Cartão de teste Stripe:</span>
                <code className="bg-amber-100/70 px-2 py-0.5 rounded font-mono font-bold text-amber-950">
                  4242 4242 4242 4242
                </code>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || processing || !clientSecret}
              className="w-full py-3 px-4 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando com Stripe...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirmar Pagamento {formatBRL(displayedAmount)}</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <p className="text-[11px] text-[#A8A199] flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {isTestMode ? 'Ambiente de testes • ' : ''}Dados do cartão processados diretamente pelo Stripe
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
