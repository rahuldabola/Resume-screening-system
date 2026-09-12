import { NavLink } from 'react-router-dom';
import { setTheme, useIsDark } from '../lib/theme';

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-ink-900 text-canvas' : 'text-ink-500 hover:bg-ink-900/[0.05] hover:text-ink-900'
  }`;

/**
 * Sun and moon on one axis: the icons slide and rotate past each other rather
 * than swapping. The one on screen is the theme you would switch *to*, which
 * is what the label says too — a control that showed the current state would
 * need a different label to stay honest.
 */
function ThemeToggle() {
  const isDark = useIsDark();

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className="relative h-9 w-9 overflow-hidden rounded-lg border border-ink-900/10 bg-surface/60 text-ink-700 transition-colors hover:bg-ink-900/[0.05]"
    >
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-500"
        style={{
          opacity: isDark ? 1 : 0,
          transform: isDark ? 'none' : 'translateY(-130%) rotate(-90deg)',
        }}
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-500"
        style={{
          opacity: isDark ? 0 : 1,
          transform: isDark ? 'translateY(130%) rotate(90deg)' : 'none',
        }}
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      </span>
    </button>
  );
}

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-900/[0.07] bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 shadow-card">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8 12.5 2.8 2.8L16 9.5" />
            </svg>
          </span>
          <span className="text-[15px] font-bold tracking-tight text-ink-900">ScreenSmart</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClasses}>
            Jobs
          </NavLink>
          <NavLink to="/candidates" className={linkClasses}>
            Candidates
          </NavLink>
          <span className="ml-1">
            <ThemeToggle />
          </span>
        </nav>
      </div>
    </header>
  );
}
