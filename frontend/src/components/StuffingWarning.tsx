import type { AssessmentResult } from '../api/types';

interface StuffingWarningProps {
  result: AssessmentResult;
}

/**
 * Shown when the scorer damped a candidate for keyword stuffing.
 *
 * A resume that lists every skill in the taxonomy and demonstrates none of
 * them would otherwise score a perfect skill overlap. The score already
 * accounts for it; this tells the recruiter *why* a keyword-perfect candidate
 * is sitting further down the list than they expect.
 */
export function StuffingWarning({ result }: StuffingWarningProps) {
  const density = Math.round(result.keyword_coverage * 100);

  return (
    <span
      title={`${density}% of this resume is bare skill keywords, so its score was damped to ${Math.round(
        result.stuffing_factor * 100
      )}% of its raw value.`}
      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800"
    >
      Keyword-stuffed
    </span>
  );
}
