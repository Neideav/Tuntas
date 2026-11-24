'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { SPRING_TRANSITIONS } from '@/lib/animations';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function showToast(message: string, type: ToastType = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tuntas:toast', { detail: { message, type } }));
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handleGlobalToast = (e: any) => {
      if (e.detail?.message) {
        addToast(e.detail.message, e.detail.type || 'info');
      }
    };
    window.addEventListener('tuntas:toast', handleGlobalToast);
    return () => window.removeEventListener('tuntas:toast', handleGlobalToast);
  }, [addToast]);

  const toast = {
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    info: (msg: string) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast viewport container */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={SPRING_TRANSITIONS.tight}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl shadow-lg border text-xs font-semibold select-none backdrop-blur-md ${
                t.type === 'success'
                  ? 'bg-slate-900/95 text-white border-slate-800'
                  : t.type === 'error'
                  ? 'bg-rose-900/95 text-white border-rose-800'
                  : 'bg-white/95 text-slate-900 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                {t.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                {t.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />}
                {t.type === 'info' && <Info className="h-4 w-4 text-sky-500 shrink-0" />}
                <span className="truncate">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-md text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                aria-label="Tutup notifikasi"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}
