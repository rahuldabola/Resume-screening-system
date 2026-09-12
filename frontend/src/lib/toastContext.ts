import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

export const ToastContext = createContext<((tone: ToastTone, message: string) => void) | null>(null);

/**
 * Feedback for things that happen away from where you are looking.
 *
 * A job deleted from the bottom of a list, or a ranking that finished after
 * you scrolled, otherwise leaves no trace that the action worked at all.
 */
export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast must be used inside <ToastProvider>');
  return push;
}
