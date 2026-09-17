import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../ToastProvider';
import { useToast } from '../../lib/toastContext';
import type { ToastTone } from '../../lib/toastContext';

function Pusher({ tone = 'success' as ToastTone, message = 'Saved' }) {
  const toast = useToast();
  return (
    <button onClick={() => toast(tone, message)}>push</button>
  );
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('useToast', () => {
  /**
   * Failing loudly at the boundary beats a toast that silently goes nowhere:
   * the caller is telling the user something happened, and a no-op would mean
   * they never hear it.
   */
  it('refuses to work outside a provider', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Pusher />)).toThrow(/must be used inside <ToastProvider>/);

    quiet.mockRestore();
  });
});

describe('ToastProvider', () => {
  it('shows a pushed message', async () => {
    renderWithProvider(<Pusher message="3 candidates scored." />);

    await userEvent.click(screen.getByRole('button', { name: 'push' }));

    expect(screen.getByText('3 candidates scored.')).toBeInTheDocument();
  });

  /**
   * A job deleted from the bottom of a list, or a ranking that finished after
   * you scrolled, otherwise leaves no trace at all -- including for someone
   * who cannot see the corner of the screen it appears in.
   */
  it('puts toasts in a polite live region so they are announced', async () => {
    const { container } = renderWithProvider(<Pusher message="Saved" />);

    await userEvent.click(screen.getByRole('button', { name: 'push' }));

    const live = container.querySelector('[aria-live="polite"]')!;
    expect(live).toHaveTextContent('Saved');
  });

  it('stacks several toasts rather than replacing the last one', async () => {
    function Three() {
      const toast = useToast();
      return (
        <button
          onClick={() => {
            toast('success', 'first');
            toast('error', 'second');
            toast('info', 'third');
          }}
        >
          push
        </button>
      );
    }
    renderWithProvider(<Three />);

    await userEvent.click(screen.getByRole('button', { name: 'push' }));

    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
    expect(screen.getByText('third')).toBeInTheDocument();
  });

  it('dismisses a toast on demand', async () => {
    renderWithProvider(<Pusher message="Saved" />);

    await userEvent.click(screen.getByRole('button', { name: 'push' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  // fireEvent rather than userEvent: userEvent awaits real timers between
  // clicks, which deadlocks against the fake clock this test needs in order to
  // skip past the toast's lifetime.
  it('expires on its own after a few seconds', async () => {
    vi.useFakeTimers();

    renderWithProvider(<Pusher message="Saved" />);
    fireEvent.click(screen.getByRole('button', { name: 'push' }));
    expect(screen.getByText('Saved')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(4300);
    });

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  /**
   * Ids come from a ref rather than the array length: dismissing the first of
   * two toasts and pushing a third would otherwise reuse a live id, and React
   * would key the new toast onto the old one's DOM node.
   */
  it('never reuses an id after a dismissal', async () => {
    function Sequence() {
      const toast = useToast();
      return (
        <>
          <button onClick={() => toast('success', 'first')}>one</button>
          <button onClick={() => toast('error', 'second')}>two</button>
        </>
      );
    }
    renderWithProvider(<Sequence />);

    await userEvent.click(screen.getByRole('button', { name: 'one' }));
    await userEvent.click(screen.getByRole('button', { name: 'two' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'one' }));

    expect(screen.getByText('second')).toBeInTheDocument();
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(2);
  });
});
