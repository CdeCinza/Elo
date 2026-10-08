'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface CatalogModalProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  isBusy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Janela padrão dos formulários do cardápio: fecha com Esc, clique fora ou no X (exceto enquanto salva).
 */
export function CatalogModal({ title, subtitle, isOpen, isBusy = false, onClose, children }: CatalogModalProps) {

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} title={title} isBusy={isBusy} onClose={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl border border-[#EAE6E1] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-[#191817]">{title}</h2>
            {subtitle && <p className="text-sm text-[#78716A] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Fechar"
            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#EAE6E1] hover:bg-[#F2EFEA] text-[#57534E] flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </Modal>
  );
}

export const fieldLabelClass = 'block text-sm font-semibold text-[#44403C] mb-1.5';
export const fieldInputClass =
  'w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[#E0DBD3] text-sm text-[#191817] placeholder-[#A8A199] focus:outline-none focus:border-[#C84E1F] focus:bg-white transition-colors';
export const primaryButtonClass =
  'px-4 py-2.5 rounded-xl bg-[#C84E1F] hover:bg-[#B34217] text-white text-sm font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-wait';
export const secondaryButtonClass =
  'px-4 py-2.5 rounded-xl bg-white border border-[#E0DBD3] hover:border-[#191817]/40 text-[#191817] text-sm font-medium transition-colors cursor-pointer';
