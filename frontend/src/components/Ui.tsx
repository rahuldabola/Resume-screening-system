import type { ReactNode } from 'react';

/** A dismissable error. Errors here are almost always actionable (bad file
 *  type, ML service down), so they say what happened rather than "error". */
export function ErrorNote({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      role="alert"
      className="animate-fade-up flex items-start gap-3 rounded-xl bg-rose-50 p-3.5 text-sm text-rose-800 ring-1 ring-inset ring-rose-600/20"
    >
      <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm0 3.5a.9.9 0 0 1 .9.9v4.2a.9.9 0 0 1-1.8 0V4.4a.9.9 0 0 1 .9-.9Zm0 8.9a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
      </svg>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 rounded-md p-0.5 text-rose-600 hover:bg-rose-100" aria-label="Dismiss">
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
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
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
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
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

export function StatTile({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-300">{label}</p>
      <p className={`tnum mt-1 text-2xl font-bold ${tone === 'good' ? 'text-emerald-600' : 'text-ink-900'}`}>{value}</p>
    </div>
  );
}
