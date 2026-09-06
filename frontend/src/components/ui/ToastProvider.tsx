'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Standalone event target for dispatching toasts anywhere without needing React Context hooks
type ToastListener = (toast: Omit<ToastItem, 'id'>) => void;
const listeners = new Set<ToastListener>();

export const toast = {
  show: (type: ToastType, message: string, title?: string, duration?: number) => {
    listeners.forEach((listener) => listener({ type, message, title, duration }));
  },
  success: (message: string, title?: string, duration = 4000) => {
    listeners.forEach((listener) => listener({ type: 'success', message, title, duration }));
  },
  error: (message: string, title?: string, duration = 5000) => {
    listeners.forEach((listener) => listener({ type: 'error', message, title, duration }));
  },
  warning: (message: string, title?: string, duration = 4500) => {
    listeners.forEach((listener) => listener({ type: 'warning', message, title, duration }));
  },
  info: (message: string, title?: string, duration = 4000) => {
    listeners.forEach((listener) => listener({ type: 'info', message, title, duration }));
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast]
  );

  useEffect(() => {
    const handler: ToastListener = (toastData) => {
      showToast(toastData);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [showToast]);

  const success = useCallback((msg: string, title?: string) => showToast({ type: 'success', message: msg, title }), [showToast]);
  const error = useCallback((msg: string, title?: string) => showToast({ type: 'error', message: msg, title, duration: 5000 }), [showToast]);
  const warning = useCallback((msg: string, title?: string) => showToast({ type: 'warning', message: msg, title }), [showToast]);
  const info = useCallback((msg: string, title?: string) => showToast({ type: 'info', message: msg, title }), [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, success, error, warning, info }}>
      {children}
      
      {/* Toast Container */}
      <aside 
        aria-label="Notificações do sistema"
        className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none"
      >
        {toasts.map((item) => {
          const typeConfig = {
            success: {
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
              border: 'border-emerald-500/30',
              bg: 'bg-[#181F1A]',
              accent: 'bg-emerald-500',
              titleColor: 'text-emerald-300',
            },
            error: {
              icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
              border: 'border-rose-500/30',
              bg: 'bg-[#221818]',
              accent: 'bg-rose-500',
              titleColor: 'text-rose-300',
            },
            warning: {
              icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
              border: 'border-amber-500/30',
              bg: 'bg-[#241E15]',
              accent: 'bg-amber-500',
              titleColor: 'text-amber-300',
            },
            info: {
              icon: <Info className="w-5 h-5 text-[#C84E1F] shrink-0" />,
              border: 'border-[#C84E1F]/30',
              bg: 'bg-[#1C1816]',
              accent: 'bg-[#C84E1F]',
              titleColor: 'text-[#F9F8F6]',
            },
          }[item.type];

          return (
            <div
              key={item.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border ${typeConfig.border} ${typeConfig.bg} shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4`}
            >
              {typeConfig.icon}
              <div className="flex-1 min-w-0 pr-1">
                {item.title && (
                  <h4 className={`text-xs font-bold ${typeConfig.titleColor} mb-0.5 tracking-tight`}>
                    {item.title}
                  </h4>
                )}
                <p className="text-xs text-[#E8E4DF] leading-relaxed break-words font-medium">
                  {item.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                className="p-1 rounded-lg text-[#A19A91] hover:text-[#F9F8F6] hover:bg-white/5 transition-colors cursor-pointer shrink-0 -mr-1 -mt-1"
                aria-label="Fechar notificação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return toast;
  }
  return context;
}
