import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * jsdom ships no `matchMedia`, and every animation in this app asks it whether
 * motion is allowed before doing anything. Answering "reduce" by default means
 * tests assert on finished state -- a count-up shows its target, a bar sits at
 * its final width -- rather than racing an rAF loop to a value. Tests that care
 * about the animated path opt back in with `setPrefersReducedMotion(false)`.
 */
let prefersReducedMotion = true;

export function setPrefersReducedMotion(reduced: boolean) {
  prefersReducedMotion = reduced;
}

function matches(query: string) {
  if (query.includes('prefers-reduced-motion')) return prefersReducedMotion;
  return false;
}

beforeEach(() => {
  prefersReducedMotion = true;

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      media: query,
      matches: matches(query),
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );

  // Reveal-on-scroll wraps most list rows. Without a real observer jsdom would
  // leave them hidden forever, so this one reports everything as visible the
  // moment it is observed and the rows are simply there to assert on.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        this.callback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        );
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    }
  );

  document.documentElement.className = '';
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // Unconditionally, because a test that fails while fake timers are installed
  // never reaches its own cleanup -- and every later test that waits on a real
  // timer then hangs, burying the one real failure under a run of timeouts.
  vi.useRealTimers();
});
