import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'screensmart-theme';

/**
 * The `dark` class on <html> is the single source of truth.
 *
 * It is set by a blocking script in index.html before first paint, so the page
 * never flashes white on the way to dark. Reading it back here rather than
 * keeping a parallel copy in React state means the toggle, the score rings and
 * anything else that needs the theme can never disagree about it.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // Someone who never chose a theme follows the OS, including when it flips at
  // sunset while the tab is open.
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (!localStorage.getItem(STORAGE_KEY)) applyTheme(query.matches ? 'dark' : 'light');
  };
  query.addEventListener('change', onSystemChange);

  return () => {
    observer.disconnect();
    query.removeEventListener('change', onSystemChange);
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode, or storage disabled. The theme still applies for this
    // visit; it just will not be remembered.
  }
  applyTheme(theme);
}

export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains('dark'),
    () => false
  );
}
