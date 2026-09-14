'use client';

import React from 'react';
import Link from 'next/link';
import { Smartphone, Store, ChefHat, ArrowUpRight } from 'lucide-react';

export default function RootHomePage() {
  return (
    <main className="min-h-screen bg-[#F9F8F6] text-[#191817] flex flex-col justify-between selection:bg-[#C84E1F]/15">
      {/* Top Header */}
      <header className="border-b border-[#EAE6E1] bg-[#F9F8F6]/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-[#191817]">ELO</span>
            <span className="text-xs text-[#6E6760] font-normal border-l border-[#D8D2C9] pl-3">
              Operação gastronômica
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-[#6E6760]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
              <span>Sistema conectado</span>
            </div>
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAE6E1] bg-white hover:border-[#191817]/40 text-[#191817] font-medium transition-colors shadow-2xs"
            >
              <span>Acesso da Equipe</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-6 py-12 sm:py-16 w-full flex-1 flex flex-col justify-center">
        {/* Editorial Title */}
        <div className="max-w-2xl mb-12">
          <h1 className="font-editorial text-4xl sm:text-5xl font-normal text-[#191817] leading-[1.12] mb-4">
            A experiência do salão, do caixa e da cozinha em harmonia.
          </h1>
          <p className="text-base text-[#6E6760] leading-relaxed max-w-xl">
            Selecione o ambiente operacional para iniciar o atendimento dos clientes ou gerenciar os pedidos em tempo real.
          </p>
        </div>

        {/* Operational Modules - Asymmetric, intentional layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Card Principal: Experiência do Cliente na Mesa (7 cols) */}
          <Link
            href="/table"
            className="lg:col-span-7 group bg-white rounded-2xl border border-[#EAE6E1] p-8 sm:p-10 flex flex-col justify-between hover:border-[#191817]/40 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 rounded-2xl bg-[#F9F8F6] border border-[#EAE6E1] flex items-center justify-center text-[#191817]">
                  <Smartphone className="w-5 h-5 text-[#C84E1F]" />
                </div>
                <span className="text-xs text-[#6E6760] px-3 py-1 rounded-full bg-[#F2EFEA]">
                  Dispositivo do cliente / Totem
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-normal font-editorial text-[#191817] mb-3">
                Cardápio digital na mesa
              </h2>
              <p className="text-sm text-[#6E6760] leading-relaxed mb-8 max-w-lg">
                Visão do tablet na mesa do salão ou QR Code. Permite fazer pedidos direto para a cozinha, chamar a equipe de atendimento, consultar o consumo em tempo real e solicitar a conta.
              </p>
            </div>

            <div className="pt-6 border-t border-[#F2EFEA] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#191817]">
                Abrir terminal do tablet / mesa
              </span>
              <div className="w-8 h-8 rounded-full border border-[#EAE6E1] group-hover:border-[#191817] group-hover:bg-[#191817] group-hover:text-white flex items-center justify-center transition-colors text-[#191817]">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          </Link>

          {/* Coluna Lateral: Balcão e Cozinha (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Card 2: Frente de Caixa */}
            <Link
              href="/counter"
              className="group bg-white rounded-2xl border border-[#EAE6E1] p-7 flex-1 flex flex-col justify-between hover:border-[#191817]/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#F9F8F6] border border-[#EAE6E1] flex items-center justify-center text-[#191817]">
                    <Store className="w-5 h-5 text-[#191817]" />
                  </div>
                  <span className="text-xs text-[#6E6760] px-2.5 py-0.5 rounded-full bg-[#F2EFEA]">
                    Frente de caixa
                  </span>
                </div>

                <h2 className="text-lg font-bold text-[#191817] mb-1.5">
                  Balcão e mesas ativas
                </h2>
                <p className="text-xs text-[#6E6760] leading-relaxed">
                  Visão geral do salão, fechamento de comandas, lançamentos manuais e recebimentos.
                </p>
              </div>

              <div className="pt-4 mt-6 border-t border-[#F2EFEA] flex items-center justify-between">
                <span className="text-xs font-medium text-[#191817]">Abrir painel do caixa</span>
                <ArrowUpRight className="w-4 h-4 text-[#6E6760] group-hover:text-[#191817] transition-colors" />
              </div>
            </Link>

            {/* Card 3: KDS Cozinha */}
            <Link
              href="/kitchen"
              className="group bg-white rounded-2xl border border-[#EAE6E1] p-7 flex-1 flex flex-col justify-between hover:border-[#191817]/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#F9F8F6] border border-[#EAE6E1] flex items-center justify-center text-[#191817]">
                    <ChefHat className="w-5 h-5 text-[#191817]" />
                  </div>
                  <span className="text-xs text-[#6E6760] px-2.5 py-0.5 rounded-full bg-[#F2EFEA]">
                    KDS operacional
                  </span>
                </div>

                <h2 className="text-lg font-bold text-[#191817] mb-1.5">
                  Produção da cozinha
                </h2>
                <p className="text-xs text-[#6E6760] leading-relaxed">
                  Fila de pedidos em tempo real, tempos de preparo, observações de montagem e baixa de pratos.
                </p>
              </div>

              <div className="pt-4 mt-6 border-t border-[#F2EFEA] flex items-center justify-between">
                <span className="text-xs font-medium text-[#191817]">Abrir tela de preparo</span>
                <ArrowUpRight className="w-4 h-4 text-[#6E6760] group-hover:text-[#191817] transition-colors" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer sóbrio */}
      <footer className="border-t border-[#EAE6E1] py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6E6760]">
          <span>ELO Gastronomia • Cardápio Digital & Operação Integrada</span>
          <span>Versão 1.0 • Laravel & Next.js</span>
        </div>
      </footer>
    </main>
  );
}
