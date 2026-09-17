import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmButton, ErrorNote, ProgressBar, SkeletonList, StatTile } from '../Ui';

describe('ErrorNote', () => {
  /** `role="alert"` is what makes the message reach a screen reader at all. */
  it('announces itself as an alert', () => {
    render(<ErrorNote message="The ML service is unavailable." />);

    expect(screen.getByRole('alert')).toHaveTextContent('The ML service is unavailable.');
  });

  it('offers no dismiss control when there is nothing to dismiss to', () => {
    render(<ErrorNote message="Boom" />);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('calls back when dismissed', async () => {
    const onDismiss = vi.fn();
    render(<ErrorNote message="Boom" onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmButton', () => {
  /**
   * Deleting a job takes its whole ranking with it and nothing here is
   * recoverable, so one click must never be enough.
   */
  it('does not delete on the first click', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton onConfirm={onConfirm} label="Delete Priya Sharma">x</ConfirmButton>);

    await userEvent.click(screen.getByRole('button', { name: 'Delete Priya Sharma' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('deletes on the second, confirming click', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton onConfirm={onConfirm} label="Delete Priya Sharma">x</ConfirmButton>);

    await userEvent.click(screen.getByRole('button', { name: 'Delete Priya Sharma' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('abandons the delete on Cancel', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton onConfirm={onConfirm} label="Delete Priya Sharma">x</ConfirmButton>);

    await userEvent.click(screen.getByRole('button', { name: 'Delete Priya Sharma' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete Priya Sharma' })).toBeInTheDocument();
  });

  /**
   * A confirm left open would otherwise sit there indefinitely, ready to catch
   * a later click that was meant for something else entirely.
   */
  // fireEvent rather than userEvent: userEvent awaits real timers between
  // keystrokes and clicks, which deadlocks against the fake clock this test
  // needs in order to skip forward four seconds.
  it('disarms itself after a few seconds', async () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();

    render(<ConfirmButton onConfirm={onConfirm} label="Delete Priya Sharma">x</ConfirmButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Priya Sharma' }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(4100);
    });

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('ProgressBar', () => {
  it('exposes progress to assistive technology, not just to the eye', () => {
    render(<ProgressBar value={42.6} label="Uploading resume" />);

    const bar = screen.getByRole('progressbar', { name: 'Uploading resume' });
    expect(bar).toHaveAttribute('aria-valuenow', '43');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('shows a whole-number percentage', () => {
    render(<ProgressBar value={42.6} label="Uploading resume" />);
    expect(screen.getByText('43%')).toBeInTheDocument();
  });
});

describe('StatTile', () => {
  /**
   * Under reduced motion the count-up is skipped entirely, so the tile must
   * render its final value rather than a zero it never animates away from.
   */
  it('shows the finished value when motion is reduced', () => {
    render(<StatTile label="Average score" value={71.6} suffix="%" decimals={1} />);
    expect(screen.getByText('71.6%')).toBeInTheDocument();
  });

  it('keeps the decimal width fixed so the number does not jitter', () => {
    render(<StatTile label="Top score" value={80} suffix="%" decimals={1} />);
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });

  it('renders a whole number when no decimals are asked for', () => {
    render(<StatTile label="Candidates" value={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

describe('SkeletonList', () => {
  /**
   * Placeholder rows carry no information, so a screen reader announcing them
   * would just be noise between "loading" and the real content.
   */
  it('hides its placeholder rows from assistive technology', () => {
    const { container } = render(<SkeletonList rows={4} />);

    const list = container.querySelector('ul')!;
    expect(list).toHaveAttribute('aria-hidden', 'true');
    expect(list.querySelectorAll('li')).toHaveLength(4);
  });
});
