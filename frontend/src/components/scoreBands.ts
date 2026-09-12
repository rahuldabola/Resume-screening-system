/**
 * One place to decide what a score *means* visually.
 *
 * These bands are a UI judgement about ranked candidates, and are deliberately
 * far stricter than the API's `clears_domain_floor` flag, which only says a
 * candidate is not from a completely unrelated field. Every component that
 * colours a score reads from here, so a badge, a ring and a bar can never
 * disagree about the same number.
 */
export interface ScoreBand {
  label: string;
  /** Tailwind text colour for the score itself. */
  text: string;
  /** Background + text for a pill. */
  pill: string;
  /** Stroke colour for the SVG ring. */
  stroke: string;
}

export function bandFor(score: number): ScoreBand {
  if (score >= 70) {
    return {
      label: 'Strong match',
      text: 'text-emerald-600',
      pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
      stroke: '#059669',
    };
  }
  if (score >= 40) {
    return {
      label: 'Moderate match',
      text: 'text-amber-600',
      pill: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
      stroke: '#d97706',
    };
  }
  return {
    label: 'Weak match',
    text: 'text-rose-600',
    pill: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
    stroke: '#e11d48',
  };
}
