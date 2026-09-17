import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { getJob, getResults, rankCandidates } from '../api/jobs';
import type { AssessmentResult, Job } from '../api/types';
import { Reveal, Spotlight } from '../components/Depth';
import { ScoreBadge } from '../components/ScoreBadge';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { ScoreRing } from '../components/ScoreRing';
import { StuffingWarning } from '../components/StuffingWarning';
import { EmptyState, ErrorNote, SkeletonList, Spinner, StatTile } from '../components/Ui';
import { useToast } from '../lib/toastContext';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const jobId = Number(id);

  const [job, setJob] = useState<Job | null>(null);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const toast = useToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [jobData, resultsData] = await Promise.all([getJob(jobId), getResults(jobId)]);
      setJob(jobData);
      setResults(resultsData);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Esc closes the open breakdown, which is what every other expandable thing
  // on the web does.
  useEffect(() => {
    if (expandedId === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedId]);

  async function handleRank() {
    setRanking(true);
    setError(null);
    try {
      const ranked = await rankCandidates(jobId);
      setResults(ranked);
      // The old expansion points at a result row that no longer exists: ranking
      // writes fresh rows, so the ids change even for the same candidates.
      setExpandedId(null);
      toast('success', `Scored ${ranked.length} candidate${ranked.length === 1 ? '' : 's'} against this job.`);
    } catch (err) {
      const message = apiErrorMessage(err);
      setError(message);
      toast('error', message);
    } finally {
      setRanking(false);
    }
  }

  const summary = useMemo(() => {
    // Reading the top result first is what proves the list is non-empty, so
    // the guard and the value it protects cannot drift apart.
    const top = results[0];
    if (!top) return null;
    const scores = results.map((r) => r.match_score);
    return {
      pool: results.length,
      strong: scores.filter((s) => s >= 70).length,
      average: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      top,
    };
  }, [results]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <div className="card mb-6 h-40 animate-pulse" />
        <SkeletonList rows={4} />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <ErrorNote message={error ?? 'Job not found.'} />
        <Link to="/" className="btn-ghost mt-4">
          Back to job postings
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <Link
        to="/"
        className="group inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M10.3 2.3a.7.7 0 0 1 0 1L5.6 8l4.7 4.7a.7.7 0 1 1-1 1l-5.2-5.2a.7.7 0 0 1 0-1l5.2-5.2a.7.7 0 0 1 1 0Z" />
        </svg>
        All job postings
      </Link>

      <Spotlight className="mt-4 rounded-3xl bg-night shadow-lift ring-1 ring-white/[0.06] dark:bg-[#131a2e]">
        <div className="absolute inset-0 bg-grid-light opacity-50" aria-hidden="true" />
        <div className="relative p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{job.title}</h1>
          <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-white/60">
            {job.description}
          </p>
        </div>
      </Spotlight>

      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Candidates" value={summary.pool} />
          <StatTile label="Strong matches" value={summary.strong} tone={summary.strong > 0 ? 'good' : 'default'} />
          <StatTile label="Average score" value={summary.average} suffix="%" decimals={1} />
          <StatTile label="Top score" value={summary.top.match_score} suffix="%" decimals={1} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Ranked candidates</h2>
          <p className="mt-0.5 text-sm text-ink-500">Best match first. Open a row to see why.</p>
        </div>
        <button onClick={handleRank} disabled={ranking} className="btn-accent">
          {ranking && <Spinner />}
          {ranking ? 'Scoring the pool…' : results.length > 0 ? 'Re-rank candidates' : 'Rank all candidates'}
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorNote message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="mt-4">
        {results.length === 0 ? (
          <EmptyState
            title="Nothing ranked yet"
            body={
              <>
                Upload resumes on the{' '}
                <Link to="/candidates" className="font-medium text-brand-600 hover:underline">
                  Candidates
                </Link>{' '}
                page, then rank them against this posting. The whole pool is scored in one pass, which is
                what makes the scores comparable with each other.
              </>
            }
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V10m6 9V5m6 14v-6" />
              </svg>
            }
          />
        ) : (
          <ul className="space-y-3">
            {results.map((result, index) => {
              const isExpanded = expandedId === result.id;
              return (
                <Reveal key={result.id} delay={index * 80}>
                  <li
                    className={`card overflow-hidden transition-all duration-300 ${
                      isExpanded ? 'shadow-lift ring-1 ring-brand-500/25' : 'hover:-translate-y-0.5 hover:shadow-lift'
                    }`}
                  >
                    <button
                      className="flex w-full items-center gap-4 p-4 text-left sm:p-5"
                      onClick={() => setExpandedId(isExpanded ? null : result.id)}
                      aria-expanded={isExpanded}
                    >
                      <span className="tnum w-5 shrink-0 text-sm font-bold text-ink-300">{index + 1}</span>
                      <ScoreRing score={result.match_score} delay={index * 80} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink-900">{result.candidate_name}</p>
                        {result.candidate_email && (
                          <p className="truncate text-sm text-ink-500">{result.candidate_email}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <ScoreBadge score={result.match_score} />
                          {result.stuffing_factor < 1 && <StuffingWarning result={result} />}
                        </div>
                      </div>
                      <span className="hidden shrink-0 text-xs font-medium text-ink-300 sm:block">
                        {isExpanded ? 'Hide' : 'Why?'}
                      </span>
                      <svg
                        viewBox="0 0 16 16"
                        className={`h-4 w-4 shrink-0 text-ink-300 transition-transform duration-300 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M3.3 5.3a.7.7 0 0 1 1 0L8 9l3.7-3.7a.7.7 0 1 1 1 1l-4.2 4.2a.7.7 0 0 1-1 0L3.3 6.3a.7.7 0 0 1 0-1Z" />
                      </svg>
                    </button>

                    <div className="expand-panel" data-open={isExpanded}>
                      <div>
                        <div className="border-t border-ink-900/[0.07] bg-ink-900/[0.015] p-5 sm:p-6">
                          {/* Keyed on open state: remounting replays the bar
                              fill and the skill stagger every time it opens. */}
                          <ScoreBreakdown key={isExpanded ? 'open' : 'closed'} result={result} />
                        </div>
                      </div>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
