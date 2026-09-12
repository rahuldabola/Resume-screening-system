import { NavLink } from 'react-router-dom';

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-900/[0.05] hover:text-ink-900'
  }`;

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
        <nav className="flex gap-1">
          <NavLink to="/" end className={linkClasses}>
            Jobs
          </NavLink>
          <NavLink to="/candidates" className={linkClasses}>
            Candidates
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
