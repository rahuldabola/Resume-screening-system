import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { createJob, deleteJob, listJobs } from '../api/jobs';
import type { Job } from '../api/types';
import { EmptyState, ErrorNote, SkeletonList, Spinner } from '../components/Ui';

function formatDate(iso: string) {
  const date = new Date(iso.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Split so the mount effect doesn't call setLoading synchronously: `loading`
  // already starts true, and a synchronous setState inside an effect just
  // schedules a second render before the first has painted.
  async function load() {
    try {
      setJobs(await listJobs());
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
      await createJob(title, description);
      setTitle('');
      setDescription('');
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteJob(id);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Job postings</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Open a posting to rank every uploaded resume against it.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((open) => !open)}>
          {showForm ? 'Cancel' : 'New job posting'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card animate-fade-up mt-6 p-5 sm:p-6">
          <div className="mb-4">
            <label className="label" htmlFor="job-title">Title</label>
            <input
              id="job-title"
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
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

      <div className="mt-6">
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
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id} className="card group p-5 transition-shadow hover:shadow-lift">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="text-base font-semibold text-ink-900 decoration-brand-400 underline-offset-4 group-hover:underline"
                    >
                      {job.title}
                    </Link>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-500">{job.description}</p>
                    <p className="mt-2.5 text-xs text-ink-300">Posted {formatDate(job.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link to={`/jobs/${job.id}`} className="btn-ghost px-3 py-2 text-xs">
                      Rank
                    </Link>
                    <button
                      onClick={() => handleDelete(job.id)}
                      aria-label={`Delete ${job.title}`}
                      className="rounded-lg p-2 text-ink-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                        <path d="M8 2h4a1 1 0 0 1 1 1v1h4v2H3V4h4V3a1 1 0 0 1 1-1Zm-3 6h10l-.8 9.1a1 1 0 0 1-1 .9H6.8a1 1 0 0 1-1-.9L5 8Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
