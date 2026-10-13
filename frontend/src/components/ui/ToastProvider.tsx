'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  count: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id' | 'count'>) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Standalone event target for dispatching toasts anywhere without needing React Context hooks
type ToastListener = (toast: Omit<ToastItem, 'id' | 'count'>) => void;
const listeners = new Set<ToastListener>();

export const toast = {
  show: (type: ToastType, message: string, title?: string, duration?: number) => {
    listeners.forEach((listener) => listener({ type, message, title, duration }));
  },
  success: (titleOrMessage: string, description?: string, duration = 3200) => {
    const title = description ? titleOrMessage : undefined;
    const message = description || titleOrMessage;
    listeners.forEach((listener) => listener({ type: 'success', message, title, duration }));
  },
  error: (titleOrMessage: string, description?: string, duration = 4500) => {
    const title = description ? titleOrMessage : undefined;
    const message = description || titleOrMessage;
    listeners.forEach((listener) => listener({ type: 'error', message, title, duration }));
  },
  warning: (titleOrMessage: string, description?: string, duration = 4000) => {
    const title = description ? titleOrMessage : undefined;
    const message = description || titleOrMessage;
    listeners.forEach((listener) => listener({ type: 'warning', message, title, duration }));
  },
  info: (titleOrMessage: string, description?: string, duration = 3200) => {
    const title = description ? titleOrMessage : undefined;
    const message = description || titleOrMessage;
    listeners.forEach((listener) => listener({ type: 'info', message, title, duration }));
  },
};

const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastsRef = useRef<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
    toastsRef.current = toastsRef.current.filter((item) => item.id !== id);
    setToasts(toastsRef.current);
  }, []);

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    toastsRef.current = [];
    setToasts([]);
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 3200 }: Omit<ToastItem, 'id' | 'count'>) => {
      const currentToasts = toastsRef.current;
      const existing = currentToasts.find(
        (item) => item.type === type && item.message === message && item.title === title
      );
      const id = existing?.id ?? `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const nextToast: ToastItem = { id, type, title, message, duration, count: (existing?.count ?? 0) + 1 };
      const nextToasts = existing
        ? currentToasts.map((item) => item.id === id ? nextToast : item)
        : [...currentToasts, nextToast];

      nextToasts.slice(0, Math.max(0, nextToasts.length - MAX_TOASTS)).forEach((item) => {
        clearTimeout(timersRef.current.get(item.id));
        timersRef.current.delete(item.id);
      });
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
      if (duration > 0) {
        timersRef.current.set(id, setTimeout(() => dismissToast(id), duration));
      }

      toastsRef.current = nextToasts.slice(-MAX_TOASTS);
      setToasts(toastsRef.current);
      return id;
    },
    [dismissToast]
  );

  useEffect(() => {
    const handler: ToastListener = (toastData) => {
      showToast(toastData);
    };
    listeners.add(handler);
    const timers = timersRef.current;
    return () => {
      listeners.delete(handler);
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [showToast]);

  const success = useCallback((msg: string, title?: string) => showToast({ type: 'success', message: msg, title }), [showToast]);
  const error = useCallback((msg: string, title?: string) => showToast({ type: 'error', message: msg, title, duration: 4500 }), [showToast]);
  const warning = useCallback((msg: string, title?: string) => showToast({ type: 'warning', message: msg, title }), [showToast]);
  const info = useCallback((msg: string, title?: string) => showToast({ type: 'info', message: msg, title }), [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, dismissAll, success, error, warning, info }}>
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
              badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
            },
            error: {
              icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
              border: 'border-rose-500/30',
              bg: 'bg-[#221818]',
              accent: 'bg-rose-500',
              titleColor: 'text-rose-300',
              badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
            },
            warning: {
              icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
              border: 'border-amber-500/30',
              bg: 'bg-[#241E15]',
              accent: 'bg-amber-500',
              titleColor: 'text-amber-300',
              badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
            },
            info: {
              icon: <Info className="w-5 h-5 text-[#C84E1F] shrink-0" />,
              border: 'border-[#C84E1F]/30',
              bg: 'bg-[#1C1816]',
              accent: 'bg-[#C84E1F]',
              titleColor: 'text-[#F9F8F6]',
              badgeBg: 'bg-[#C84E1F]/20 text-[#F9F8F6] border-[#C84E1F]/30',
            },
          }[item.type];

          return (
            <div
              key={item.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border ${typeConfig.border} ${typeConfig.bg} shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3`}
            >
              {typeConfig.icon}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center gap-2 mb-0.5">
                  {item.title && (
                    <h4 className={`text-xs font-bold ${typeConfig.titleColor} tracking-tight`}>
                      {item.title}
                    </h4>
                  )}
                  {item.count > 1 && (
                    <span
                      key={item.count}
                      className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold border ${typeConfig.badgeBg} animate-in zoom-in-90 duration-150`}
                      title={`${item.count} notificações idênticas`}
                    >
                      ×{item.count}
                    </span>
                  )}
                </div>
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
  return {
    ...(context || {}),
    toast,
    success: toast.success,
    error: toast.error,
    warning: toast.warning,
    info: toast.info,
  };
}
