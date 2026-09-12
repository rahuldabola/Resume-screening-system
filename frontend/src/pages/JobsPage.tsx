import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { listCandidates } from '../api/candidates';
import { createJob, deleteJob, listJobs } from '../api/jobs';
import type { Job } from '../api/types';
import { Reveal, Spotlight, Tilt } from '../components/Depth';
import { ConfirmButton, EmptyState, ErrorNote, SkeletonList, Spinner, TrashIcon } from '../components/Ui';
import { useToast } from '../lib/toastContext';
import { useCountUp, usePrefersReducedMotion } from '../lib/motion';

function formatDate(iso: string) {
  const date = new Date(iso.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function HeroStat({ value, label }: { value: number; label: string }) {
  const reduced = usePrefersReducedMotion();
  const shown = useCountUp(value, { duration: 1100, enabled: !reduced });

  return (
    <div>
      <p className="tnum text-2xl font-bold text-white sm:text-3xl">{shown}</p>
      <p className="text-xs font-medium uppercase tracking-wider text-white/50">{label}</p>
    </div>
  );
}

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidateCount, setCandidateCount] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const toast = useToast();

  // Split so the mount effect doesn't call setLoading synchronously: `loading`
  // already starts true, and a synchronous setState inside an effect just
  // schedules a second render before the first has painted.
  async function load() {
    try {
      // The pool size belongs on this page too: "3 jobs, 0 candidates" is the
      // single most useful thing to know before wondering why nothing ranks.
      const [jobList, candidates] = await Promise.all([listJobs(), listCandidates()]);
      setJobs(jobList);
      setCandidateCount(candidates.length);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    await load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createJob(title, description);
      setTitle('');
      setDescription('');
      setShowForm(false);
      toast('success', `"${created.title}" posted.`);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(job: Job) {
    try {
      await deleteJob(job.id);
      toast('info', `"${job.title}" and its ranking were deleted.`);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <Spotlight className="rounded-3xl bg-night shadow-lift ring-1 ring-white/[0.06] dark:bg-[#131a2e]">
        <div className="absolute inset-0 bg-grid-light opacity-60" aria-hidden="true" />
        <div className="relative px-6 py-10 sm:px-10 sm:py-12">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 ring-1 ring-inset ring-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Skill overlap + TF-IDF, scored across the whole pool
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            Rank every candidate,{' '}
            <span className="text-sweep motion-safe:animate-sweep">and see the reasoning</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
            Post a role, upload resumes, and get a ranked shortlist where every score opens into the
            matched skills, the missing ones, and any keyword-stuffing penalty behind it.
          </p>

          <div className="mt-8 flex flex-wrap items-end gap-8">
            <HeroStat value={jobs.length} label="Job postings" />
            <HeroStat value={candidateCount} label="Candidates" />
            <button className="btn-accent ml-auto" onClick={() => setShowForm((open) => !open)}>
              {showForm ? 'Cancel' : 'New job posting'}
            </button>
          </div>
        </div>
      </Spotlight>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mt-6 p-5 motion-safe:animate-fade-up sm:p-6">
          <div className="mb-4">
            <label className="label" htmlFor="job-title">Title</label>
            <input
              id="job-title"
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              autoFocus
              required
            />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="job-description">Description</label>
            <textarea
              id="job-description"
              className="field resize-y"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the role, the stack, and the skills it needs. The more concrete the skills, the sharper the ranking."
              required
            />
            <p className="mt-1.5 text-xs text-ink-300">
              Skills are read straight out of this text, so name the tools the role actually uses.
            </p>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting && <Spinner />}
            {submitting ? 'Posting…' : 'Post job'}
          </button>
        </form>
      )}

      {error && (
        <div className="mt-6">
          <ErrorNote message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="mt-8">
        {loading ? (
          <SkeletonList />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No job postings yet"
            body="Post a job, then upload resumes and rank them against it."
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-9 0h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
              </svg>
            }
          />
        ) : (
          <ul className="space-y-4">
            {jobs.map((job, index) => (
              <Reveal key={job.id} delay={index * 70}>
                <li>
                  <Tilt className="card p-5 transition-shadow hover:shadow-lift">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="text-base font-semibold text-ink-900 decoration-brand-400 decoration-2 underline-offset-4 hover:underline"
                        >
                          {job.title}
                        </Link>
                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-500">{job.description}</p>
                        <p className="mt-2.5 text-xs text-ink-300">Posted {formatDate(job.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Link to={`/jobs/${job.id}`} className="btn-ghost px-3 py-2 text-xs">
                          Rank
                          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                            <path d="M5.7 2.3a.7.7 0 0 0 0 1L10.4 8l-4.7 4.7a.7.7 0 1 0 1 1l5.2-5.2a.7.7 0 0 0 0-1L6.7 2.3a.7.7 0 0 0-1 0Z" />
                          </svg>
                        </Link>
                        <ConfirmButton onConfirm={() => handleDelete(job)} label={`Delete ${job.title}`}>
                          <TrashIcon />
                        </ConfirmButton>
                      </div>
                    </div>
                  </Tilt>
                </li>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
