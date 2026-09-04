import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { getJob, getResults, rankCandidates } from '../api/jobs';
import { parseSkills } from '../api/types';
import type { AssessmentResult, Job } from '../api/types';
import { ScoreBadge } from '../components/ScoreBadge';
import { SkillPills } from '../components/SkillPills';
import { StuffingWarning } from '../components/StuffingWarning';

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
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRanking(false);
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-500">Loading...</p>;
  }

  if (!job) {
    return <p className="mx-auto max-w-5xl px-4 py-8 text-sm text-rose-600">Job not found.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{job.description}</p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Ranked Candidates</h2>
        <button
          onClick={handleRank}
          disabled={ranking}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {ranking ? 'Scoring candidates...' : 'Rank All Candidates'}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {results.length === 0 ? (
        <p className="text-sm text-slate-500">
          No results yet. Upload candidates on the Candidates page, then click "Rank All Candidates".
        </p>
      ) : (
        <ul className="space-y-3">
          {results.map((result, index) => {
            const isExpanded = expandedId === result.id;
            return (
              <li key={result.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <button
                  className="flex w-full items-center justify-between gap-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : result.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{result.candidate_name}</p>
                      {result.candidate_email && <p className="text-xs text-slate-500">{result.candidate_email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {result.stuffing_factor < 1 && <StuffingWarning result={result} />}
                    <span className="text-lg font-bold text-slate-900">{result.match_score}%</span>
                    <ScoreBadge score={result.match_score} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Skill overlap ({result.skill_overlap_score}%)
                      </p>
                      <SkillPills skills={parseSkills(result.matched_skills)} tone="positive" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Missing skills
                      </p>
                      <SkillPills skills={parseSkills(result.missing_skills)} tone="negative" />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <p className="text-xs text-slate-400">
                        TF-IDF text similarity: {result.tfidf_similarity}% (fit across this job&rsquo;s
                        whole candidate pool, so it is comparable between candidates)
                      </p>
                      {result.stuffing_factor < 1 && (
                        <p className="text-xs text-amber-700">
                          Keyword density {Math.round(result.keyword_coverage * 100)}% &mdash; score
                          damped to {Math.round(result.stuffing_factor * 100)}% of its raw value.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
