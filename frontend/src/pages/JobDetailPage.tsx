import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { getJob, getResults, rankCandidates } from '../api/jobs';
import type { AssessmentResult, Job } from '../api/types';
import { ScoreBadge } from '../components/ScoreBadge';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { ScoreRing } from '../components/ScoreRing';
import { StuffingWarning } from '../components/StuffingWarning';
import { EmptyState, ErrorNote, SkeletonList, Spinner, StatTile } from '../components/Ui';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const jobId = Number(id);

  const [job, setJob] = useState<Job | null>(null);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  async function handleRank() {
    setRanking(true);
    setError(null);
    try {
      setResults(await rankCandidates(jobId));
      // The old expansion points at a result row that no longer exists: ranking
      // writes fresh rows, so the ids change even for the same candidates.
      setExpandedId(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRanking(false);
    }
  }

  const summary = useMemo(() => {
    if (results.length === 0) return null;
    const scores = results.map((r) => r.match_score);
    return {
      pool: results.length,
      strong: scores.filter((s) => s >= 70).length,
      average: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      top: results[0],
    };
  }, [results]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <div className="card mb-6 h-32 animate-pulse" />
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
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M10.3 2.3a.7.7 0 0 1 0 1L5.6 8l4.7 4.7a.7.7 0 1 1-1 1l-5.2-5.2a.7.7 0 0 1 0-1l5.2-5.2a.7.7 0 0 1 1 0Z" />
        </svg>
        All job postings
      </Link>

      <div className="card mt-4 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-brand-500 via-purple-500 to-brand-400" />
        <div className="p-5 sm:p-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{job.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-500">{job.description}</p>
        </div>
      </div>

      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Candidates" value={String(summary.pool)} />
          <StatTile
            label="Strong matches"
            value={String(summary.strong)}
            tone={summary.strong > 0 ? 'good' : 'default'}
          />
          <StatTile label="Average score" value={`${summary.average}%`} />
          <StatTile label="Top score" value={`${summary.top.match_score}%`} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Ranked candidates</h2>
          <p className="mt-0.5 text-sm text-ink-500">Best match first. Open a row to see why.</p>
        </div>
        <button onClick={handleRank} disabled={ranking} className="btn-primary">
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
                <li
                  key={result.id}
                  className={`card overflow-hidden transition-shadow ${isExpanded ? 'shadow-lift' : 'hover:shadow-lift'}`}
                >
                  <button
                    className="flex w-full items-center gap-4 p-4 text-left sm:p-5"
                    onClick={() => setExpandedId(isExpanded ? null : result.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className="tnum w-5 shrink-0 text-sm font-bold text-ink-300">{index + 1}</span>
                    <ScoreRing score={result.match_score} />
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
                    <svg
                      viewBox="0 0 16 16"
                      className={`h-4 w-4 shrink-0 text-ink-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M3.3 5.3a.7.7 0 0 1 1 0L8 9l3.7-3.7a.7.7 0 1 1 1 1l-4.2 4.2a.7.7 0 0 1-1 0L3.3 6.3a.7.7 0 0 1 0-1Z" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="animate-fade-up border-t border-ink-900/[0.07] bg-ink-900/[0.015] p-5 sm:p-6">
                      <ScoreBreakdown result={result} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
