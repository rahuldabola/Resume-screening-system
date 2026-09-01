import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiErrorMessage } from '../api/client';
import { createJob, deleteJob, listJobs } from '../api/jobs';
import type { Job } from '../api/types';

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setJobs(await listJobs());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createJob(title, description);
      setTitle('');
      setDescription('');
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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Job Postings</h1>

      <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Post a new job</h2>
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Backend Engineer"
            required
          />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the role, required skills, and responsibilities..."
            required
          />
        </div>
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? 'Posting...' : 'Post Job'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Loading jobs...</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-slate-500">No job postings yet — create one above.</p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link to={`/jobs/${job.id}`} className="text-base font-semibold text-slate-900 hover:underline">
                    {job.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{job.description}</p>
                </div>
                <button
                  onClick={() => handleDelete(job.id)}
                  className="shrink-0 text-xs font-medium text-rose-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
