interface ScoreBadgeProps {
  score: number;
}

/**
 * These bands are a UI judgement about ranked candidates, and are deliberately
 * far stricter than the API's `clears_domain_floor` flag, which only says a
 * candidate is not from a completely unrelated field.
 */

function bandFor(score: number): { label: string; classes: string } {
  if (score >= 70) return { label: 'Strong Match', classes: 'bg-emerald-100 text-emerald-800' };
  if (score >= 40) return { label: 'Moderate Match', classes: 'bg-amber-100 text-amber-800' };
  return { label: 'Weak Match', classes: 'bg-rose-100 text-rose-800' };
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const band = bandFor(score);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${band.classes}`}>
      {band.label}
    </span>
  );
}
