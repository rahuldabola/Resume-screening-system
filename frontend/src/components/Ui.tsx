import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useCountUp, usePrefersReducedMotion } from '../lib/motion';

/** A dismissable error. Errors here are almost always actionable (bad file
 *  type, ML service down), so they say what happened rather than "error". */
export function ErrorNote({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      role="alert"
      className="tone-negative flex items-start gap-3 rounded-xl p-3.5 text-sm ring-1 ring-inset motion-safe:animate-fade-up"
    >
      <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm0 3.5a.9.9 0 0 1 .9.9v4.2a.9.9 0 0 1-1.8 0V4.4a.9.9 0 0 1 .9-.9Zm0 8.9a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
      </svg>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M4.3 3.3a.7.7 0 0 0-1 1L7 8l-3.7 3.7a.7.7 0 1 0 1 1L8 9l3.7 3.7a.7.7 0 1 0 1-1L9 8l3.7-3.7a.7.7 0 1 0-1-1L8 7 4.3 3.3Z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, icon }: { title: string; body: ReactNode; icon: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="tone-brand mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset">
        {icon}
      </div>
      <p className="text-base font-semibold text-ink-900">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">{body}</p>
    </div>
  );
}

/** Placeholder rows that match the shape of what is loading, so the page does
 *  not jump when the data lands. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="card relative overflow-hidden p-5">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 shrink-0 rounded-full bg-ink-900/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-40 rounded-full bg-ink-900/[0.06]" />
              <div className="h-3 w-64 max-w-full rounded-full bg-ink-900/[0.04]" />
            </div>
          </div>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent motion-safe:animate-shimmer dark:via-white/[0.07]" />
        </li>
      ))}
    </ul>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  suffix = '',
  decimals = 0,
  tone = 'default',
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  tone?: 'default' | 'good';
}) {
  const reduced = usePrefersReducedMotion();
  const shown = useCountUp(value, { duration: 850, decimals, enabled: !reduced });

  return (
    <div className="card px-4 py-3 transition-transform duration-200 hover:-translate-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-300">{label}</p>
      <p className={`tnum mt-1 text-2xl font-bold ${tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-900'}`}>
        {shown.toFixed(decimals)}
        {suffix}
      </p>
    </div>
  );
}

interface ConfirmButtonProps {
  onConfirm: () => void;
  label: string;
  children: ReactNode;
}

/**
 * Delete, but with a second beat.
 *
 * Deleting a job takes its whole ranking with it and nothing here is
 * recoverable, so a single mis-aimed click should not do it. Inline rather
 * than a `window.confirm` dialog: the browser dialog blocks the page, cannot
 * be styled, and reads as an error to most people.
 */
export function ConfirmButton({ onConfirm, label, children }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Disarms on its own, so a confirm left open does not sit there waiting to
  // catch a later click meant for something else.
  useEffect(() => {
    if (!armed) return;
    timer.current = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer.current);
  }, [armed]);

  if (armed) {
    return (
      <span className="flex shrink-0 items-center gap-1 motion-safe:animate-fade-up">
        <button
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
          className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
        >
          Delete
        </button>
        <button
          onClick={() => setArmed(false)}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-500 hover:bg-ink-900/5"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setArmed(true)}
      aria-label={label}
      className="shrink-0 rounded-lg p-2 text-ink-300 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
    >
      {children}
    </button>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M8 2h4a1 1 0 0 1 1 1v1h4v2H3V4h4V3a1 1 0 0 1 1-1Zm-3 6h10l-.8 9.1a1 1 0 0 1-1 .9H6.8a1 1 0 0 1-1-.9L5 8Z" />
    </svg>
  );
}

/** A determinate progress bar, used for resume upload. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="motion-safe:animate-fade-up">
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-500">
        <span>{label}</span>
        <span className="tnum">{Math.round(value)}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-ink-900/[0.07]"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-500"
          style={{ width: `${value}%`, transition: 'width 220ms ease-out' }}
        />
      </div>
    </div>
  );
}
