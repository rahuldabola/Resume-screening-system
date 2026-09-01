import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { apiErrorMessage } from '../api/client';
import { deleteCandidate, listCandidates, uploadCandidate } from '../api/candidates';
import { parseSkills } from '../api/types';
import type { Candidate } from '../api/types';
import { SkillPills } from '../components/SkillPills';

export function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      setCandidates(await listCandidates());
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
    if (!file) {
      setError('Please choose a resume file (.pdf, .docx, or .txt).');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await uploadCandidate(name, email, file);
      setName('');
      setEmail('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteCandidate(id);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Candidates</h1>

      <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Upload a resume</h2>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email (optional)</label>
            <input
              type="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">Resume file (.pdf, .docx, .txt)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? 'Uploading & parsing...' : 'Upload Resume'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Loading candidates...</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-slate-500">No candidates yet — upload a resume above.</p>
      ) : (
        <ul className="space-y-3">
          {candidates.map((candidate) => (
            <li key={candidate.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{candidate.name}</p>
                  {candidate.email && <p className="text-sm text-slate-500">{candidate.email}</p>}
                  <p className="mt-1 text-xs text-slate-400">{candidate.resume_filename}</p>
                  <div className="mt-2">
                    <SkillPills skills={parseSkills(candidate.extracted_skills)} tone="neutral" />
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(candidate.id)}
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
