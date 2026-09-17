import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreBadge } from '../ScoreBadge';
import { ScoreRing } from '../ScoreRing';
import { StuffingWarning } from '../StuffingWarning';
import { makeResult } from '../../test/utils';

describe('ScoreRing', () => {
  /**
   * The arc is `aria-hidden`, so this sentence is the entire score for anyone
   * using a screen reader. It carries both the number and what it means.
   */
  it('states the score and its band in text', () => {
    render(<ScoreRing score={82} />);
    expect(screen.getByText(/82% match — Strong match/)).toBeInTheDocument();
  });

  it('shows the finished number when motion is reduced', () => {
    render(<ScoreRing score={82} />);
    expect(screen.getByText('82')).toBeInTheDocument();
  });

  it('rounds the displayed number', () => {
    render(<ScoreRing score={82.6} />);
    expect(screen.getByText('83')).toBeInTheDocument();
  });

  it('colours the number by band', () => {
    const { rerender } = render(<ScoreRing score={82} />);
    expect(screen.getByText('82')).toHaveClass('text-emerald-600');

    rerender(<ScoreRing score={20} />);
    expect(screen.getByText('20')).toHaveClass('text-rose-600');
  });

  /**
   * The arc is drawn by offsetting a dash the length of the circumference, so
   * a score outside 0-100 would otherwise draw a ring that overshoots or runs
   * backwards.
   */
  it.each([
    [140, 0],
    [-20, 1],
  ])('clamps a score of %i when drawing the arc', (score, remainingFraction) => {
    const { container } = render(<ScoreRing score={score} />);

    const arc = container.querySelectorAll('circle')[1]!;
    const circumference = Number(arc.getAttribute('stroke-dasharray'));
    const offset = Number(arc.getAttribute('stroke-dashoffset'));

    expect(offset).toBeCloseTo(circumference * remainingFraction, 5);
  });

  it('draws the arc proportional to the score', () => {
    const { container } = render(<ScoreRing score={75} />);

    const arc = container.querySelectorAll('circle')[1]!;
    const circumference = Number(arc.getAttribute('stroke-dasharray'));
    const offset = Number(arc.getAttribute('stroke-dashoffset'));

    expect(offset / circumference).toBeCloseTo(0.25, 5);
  });

  /** A halo on every row would be decoration; on the top band it is a signal. */
  it('skips the halo under reduced motion even for a strong match', () => {
    const { container } = render(<ScoreRing score={95} />);
    expect(container.querySelector('.animate-pulse-ring')).toBeNull();
  });
});

describe('ScoreBadge', () => {
  it.each([
    [85, 'Strong match'],
    [55, 'Moderate match'],
    [20, 'Weak match'],
  ])('labels a score of %i as "%s"', (score, label) => {
    render(<ScoreBadge score={score} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('StuffingWarning', () => {
  it('flags the candidate and explains the penalty on hover', () => {
    render(<StuffingWarning result={makeResult({ keyword_coverage: 0.47, stuffing_factor: 0.6 })} />);

    const badge = screen.getByText('Keyword-stuffed');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('span')).toHaveAttribute(
      'title',
      expect.stringContaining('47% of this resume is bare skill keywords')
    );
  });

  it('quotes the damping factor as a percentage of the raw score', () => {
    render(<StuffingWarning result={makeResult({ keyword_coverage: 0.47, stuffing_factor: 0.6 })} />);

    expect(screen.getByText('Keyword-stuffed').closest('span')).toHaveAttribute(
      'title',
      expect.stringContaining('damped to 60% of its raw value')
    );
  });
});
