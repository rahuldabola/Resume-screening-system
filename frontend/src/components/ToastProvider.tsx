import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastContext } from '../lib/toastContext';
import type { Toast, ToastTone } from '../lib/toastContext';

const TONE_STYLES: Record<ToastTone, { ring: string; icon: ReactNode }> = {
  success: {
    ring: 'ring-emerald-600/25',
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" aria-hidden="true">
        <path d="M10 0a10 10 0 1 0 0 20A10 10 0 0 0 10 0Zm4.7 7.7-5.4 5.4a1 1 0 0 1-1.4 0L5.3 10.5a1 1 0 1 1 1.4-1.4l1.9 1.9 4.7-4.7a1 1 0 1 1 1.4 1.4Z" />
      </svg>
    ),
  },
  error: {
    ring: 'ring-rose-600/25',
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5 text-rose-600 dark:text-rose-400" fill="currentColor" aria-hidden="true">
        <path d="M10 0a10 10 0 1 0 0 20A10 10 0 0 0 10 0Zm0 4a1.1 1.1 0 0 1 1.1 1.1v5.3a1.1 1.1 0 0 1-2.2 0V5.1A1.1 1.1 0 0 1 10 4Zm0 11.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" />
      </svg>
    ),
  },
  info: {
    ring: 'ring-brand-600/25',
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5 text-brand-600 dark:text-brand-400" fill="currentColor" aria-hidden="true">
        <path d="M10 0a10 10 0 1 0 0 20A10 10 0 0 0 10 0Zm0 4.3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM11.1 15a1.1 1.1 0 0 1-2.2 0V9.3a1.1 1.1 0 0 1 2.2 0V15Z" />
      </svg>
    ),
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* aria-live so the message reaches a screen reader too, not just the
          corner of the screen someone may not be looking at. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-surface/95 p-3.5 shadow-lift ring-1 backdrop-blur ${TONE_STYLES[toast.tone].ring}`}
          >
            <span className="mt-px shrink-0">{TONE_STYLES[toast.tone].icon}</span>
            <p className="flex-1 text-sm font-medium text-ink-900">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-lg p-1 text-ink-300 transition-colors hover:bg-ink-900/5 hover:text-ink-900"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M4.3 3.3a.7.7 0 0 0-1 1L7 8l-3.7 3.7a.7.7 0 1 0 1 1L8 9l3.7 3.7a.7.7 0 1 0 1-1L9 8l3.7-3.7a.7.7 0 1 0-1-1L8 7 4.3 3.3Z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
