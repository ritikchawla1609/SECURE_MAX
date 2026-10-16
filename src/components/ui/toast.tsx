'use client';

import * as React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  toast: (options: { type?: ToastType; title: string; message?: string; duration?: number }) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    ({
      type = 'info',
      title,
      message,
      duration = 4000,
    }: {
      type?: ToastType;
      title: string;
      message?: string;
      duration?: number;
    }) => {
      const id = 'toast_' + Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const duration = item.duration || 4000;
  const [progress, setProgress] = React.useState(100);

  React.useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (elapsed >= duration) {
        clearInterval(interval);
        onDismiss();
      }
    }, 25);

    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  const config = {
    success: {
      border: 'border-emerald-500/40',
      bg: 'bg-[#0a141c]/95',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
      bar: 'bg-emerald-400',
      titleColor: 'text-emerald-300',
    },
    info: {
      border: 'border-blue-500/40',
      bg: 'bg-[#091224]/95',
      icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
      bar: 'bg-blue-400',
      titleColor: 'text-blue-300',
    },
    warning: {
      border: 'border-amber-500/40',
      bg: 'bg-[#18130a]/95',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
      bar: 'bg-amber-400',
      titleColor: 'text-amber-300',
    },
    error: {
      border: 'border-red-500/40',
      bg: 'bg-[#180a0e]/95',
      icon: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
      bar: 'bg-red-400',
      titleColor: 'text-red-300',
    },
  }[item.type];

  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto relative overflow-hidden rounded-xl border backdrop-blur-xl shadow-2xl p-4 transition-all duration-300 animate-in slide-in-from-right-8 fade-in',
        config.bg,
        config.border
      )}
    >
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1 min-w-0 pr-2">
          <h4 className={cn('text-xs font-bold font-sans tracking-wide', config.titleColor)}>
            {item.title}
          </h4>
          {item.message && (
            <p className="text-[11px] text-zinc-400 font-sans mt-0.5 leading-snug break-words">
              {item.message}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-zinc-500 hover:text-zinc-200 transition-colors p-0.5 rounded"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress countdown bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800">
        <div
          className={cn('h-full transition-all linear', config.bar)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
