import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setTheme, useIsDark } from '../theme';

function Probe() {
  return <span data-testid="theme">{useIsDark() ? 'dark' : 'light'}</span>;
}

const shown = () => screen.getByTestId('theme').textContent;

describe('theme', () => {
  it('reports light when the document carries no dark class', () => {
    render(<Probe />);
    expect(shown()).toBe('light');
  });

  it('reports dark when the document already carries the class', () => {
    document.documentElement.classList.add('dark');
    render(<Probe />);
    expect(shown()).toBe('dark');
  });

  it('switches the document class', () => {
    render(<Probe />);

    act(() => setTheme('dark'));
    expect(document.documentElement).toHaveClass('dark');

    act(() => setTheme('light'));
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('remembers the choice across visits', () => {
    render(<Probe />);

    act(() => setTheme('dark'));

    expect(localStorage.getItem('screensmart-theme')).toBe('dark');
  });

  /**
   * The class on <html> is the single source of truth, not a copy held in
   * React state. A toggle, the score rings and anything else reading the theme
   * therefore cannot disagree about it -- including when it is changed by the
   * blocking script in index.html that runs before React exists.
   */
  it('follows the class when something outside React changes it', async () => {
    render(<Probe />);
    expect(shown()).toBe('light');

    // MutationObserver delivers on a microtask, so the awaited act is what
    // lets the subscription run before the assertion.
    await act(async () => {
      document.documentElement.classList.add('dark');
    });

    expect(shown()).toBe('dark');
  });

  /**
   * Private mode, or storage disabled by policy. The theme should still apply
   * for this visit; it just will not be remembered.
   */
  it('still applies the theme when storage refuses to record it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    render(<Probe />);

    expect(() => act(() => setTheme('dark'))).not.toThrow();
    expect(document.documentElement).toHaveClass('dark');
  });
});
