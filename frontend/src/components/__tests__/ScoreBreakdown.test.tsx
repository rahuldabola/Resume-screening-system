import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeResult } from '../../test/utils';
import { ScoreBreakdown } from '../ScoreBreakdown';

/**
 * The argument of the whole project is that a ranking nobody can interrogate
 * is not usable for hiring. These tests hold that line: the two signals, their
 * weights, and any penalty all have to be legible on screen.
 */
describe('ScoreBreakdown', () => {
  it('shows both signals with the weight each carries', () => {
    render(<ScoreBreakdown result={makeResult({ skill_overlap_score: 88, tfidf_similarity: 71 })} />);

    expect(screen.getByText('Skill overlap')).toBeInTheDocument();
    expect(screen.getByText('· 65% of score')).toBeInTheDocument();
    expect(screen.getByText('Text similarity')).toBeInTheDocument();
    expect(screen.getByText('· 35% of score')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('71%')).toBeInTheDocument();
  });

  /** The two weights are the score's whole formula; they have to total it. */
  it('quotes weights that add up to the whole score', () => {
    render(<ScoreBreakdown result={makeResult()} />);

    const weights = screen
      .getAllByText(/% of score$/)
      .map((node) => Number(node.textContent!.match(/(\d+)%/)![1]));

    expect(weights.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('counts matched skills against the total the job asked for', () => {
    render(
      <ScoreBreakdown
        result={makeResult({
          matched_skills: JSON.stringify(['python', 'fastapi']),
          missing_skills: JSON.stringify(['kubernetes', 'terraform']),
        })}
      />
    );

    expect(screen.getByText(/2 of 4 skills this job asks for/)).toBeInTheDocument();
    expect(screen.getByText('Matched skills · 2')).toBeInTheDocument();
    expect(screen.getByText('Missing skills · 2')).toBeInTheDocument();
  });

  it('names the matched and missing skills rather than only counting them', () => {
    render(
      <ScoreBreakdown
        result={makeResult({
          matched_skills: JSON.stringify(['python']),
          missing_skills: JSON.stringify(['kubernetes']),
        })}
      />
    );

    expect(screen.getByText('python')).toBeInTheDocument();
    expect(screen.getByText('kubernetes')).toBeInTheDocument();
  });

  it('stays silent about stuffing when the score was never damped', () => {
    render(<ScoreBreakdown result={makeResult({ stuffing_factor: 1 })} />);
    expect(screen.queryByText(/Keyword-stuffing penalty/)).not.toBeInTheDocument();
  });

  /**
   * A keyword-perfect candidate sitting low in the list is the single most
   * confusing thing this UI can show, so the penalty explains itself in
   * numbers the recruiter can check against the resume.
   */
  it('explains the penalty in numbers when the score was damped', () => {
    render(
      <ScoreBreakdown
        result={makeResult({ stuffing_factor: 0.62, keyword_coverage: 0.48 })}
      />
    );

    expect(screen.getByText('Keyword-stuffing penalty applied')).toBeInTheDocument();
    expect(screen.getByText(/48% of this resume is bare skill keywords/)).toBeInTheDocument();
    expect(screen.getByText(/damped to 62% of its raw value/)).toBeInTheDocument();
  });

  it('clamps a bar that would otherwise overflow its track', () => {
    const { container } = render(
      <ScoreBreakdown result={makeResult({ skill_overlap_score: 140, tfidf_similarity: -20 })} />
    );

    const widths = Array.from(container.querySelectorAll<HTMLElement>('[style*="width"]')).map(
      (bar) => bar.style.width
    );

    expect(widths).toContain('100%');
    expect(widths).toContain('0%');
  });

  it('renders "none" rather than an empty area when nothing matched', () => {
    render(
      <ScoreBreakdown
        result={makeResult({ matched_skills: '[]', missing_skills: JSON.stringify(['python']) })}
      />
    );

    expect(screen.getByText('Matched skills · 0')).toBeInTheDocument();
    expect(screen.getByText('none')).toBeInTheDocument();
  });

  it('survives skill JSON it cannot parse', () => {
    render(<ScoreBreakdown result={makeResult({ matched_skills: '{broken', missing_skills: '' })} />);

    expect(screen.getByText('Matched skills · 0')).toBeInTheDocument();
    expect(screen.getByText(/0 of 0 skills this job asks for/)).toBeInTheDocument();
  });
});
