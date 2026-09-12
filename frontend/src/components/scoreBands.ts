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
  /** Stroke colour for the SVG ring, per theme. The light-theme green and
   *  red are picked for contrast against white and go muddy on a dark
   *  surface, so dark gets the lighter 400 weight of the same hue. */
  stroke: string;
  strokeDark: string;
}

export function bandFor(score: number): ScoreBand {
  if (score >= 70) {
    return {
      label: 'Strong match',
      text: 'text-emerald-600 dark:text-emerald-400',
      pill: 'tone-positive ring-1 ring-inset',
      stroke: '#059669',
      strokeDark: '#34d399',
    };
  }
  if (score >= 40) {
    return {
      label: 'Moderate match',
      text: 'text-amber-600 dark:text-amber-400',
      pill: 'tone-warning ring-1 ring-inset',
      stroke: '#d97706',
      strokeDark: '#fbbf24',
    };
  }
  return {
    label: 'Weak match',
    text: 'text-rose-600 dark:text-rose-400',
    pill: 'tone-negative ring-1 ring-inset',
    stroke: '#e11d48',
    strokeDark: '#fb7185',
  };
}
