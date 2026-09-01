import { NavLink } from 'react-router-dom';

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

export function Navbar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <span className="text-lg font-bold text-slate-900">🎯 ScreenSmart</span>
        <nav className="flex gap-2">
          <NavLink to="/" end className={linkClasses}>
            Job Postings
          </NavLink>
          <NavLink to="/candidates" className={linkClasses}>
            Candidates
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
