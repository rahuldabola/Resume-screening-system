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
      className="tone-warning inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5 15 14H1L8 1.5Zm0 4.25a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5.75Zm0 6.75a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z" />
      </svg>
      Keyword-stuffed
    </span>
  );
}
