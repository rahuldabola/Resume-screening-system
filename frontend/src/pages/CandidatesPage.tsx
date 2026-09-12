import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { apiErrorMessage } from '../api/client';
import { deleteCandidate, listCandidates, uploadCandidate } from '../api/candidates';
import { parseSkills } from '../api/types';
import type { Candidate } from '../api/types';
import { Reveal, Tilt } from '../components/Depth';
import { FileDrop } from '../components/FileDrop';
import { SkillPills } from '../components/SkillPills';
import {
  ConfirmButton,
  EmptyState,
  ErrorNote,
  ProgressBar,
  SkeletonList,
  Spinner,
  TrashIcon,
} from '../components/Ui';
import { useToast } from '../lib/toastContext';

export function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Split so the mount effect doesn't call setLoading synchronously: `loading`
  // already starts true, and a synchronous setState inside an effect just
  // schedules a second render before the first has painted.
  async function load() {
    try {
      setCandidates(await listCandidates());
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

  // "/" jumps to search, the convention every list-heavy app shares. Ignored
  // while typing, so it still inserts a slash in the job description.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && ['INPUT', 'TEXTAREA'].includes(target.tagName);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === searchRef.current) {
        setQuery('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Choose a resume file first (.pdf, .docx or .txt).');
      return;
    }
    setError(null);
    setSubmitting(true);
    setProgress(0);
    try {
      const created = await uploadCandidate(name, email, file, setProgress);
      const skills = parseSkills(created.extracted_skills).length;
      setName('');
      setEmail('');
      setFile(null);
      toast('success', `${created.name} added — ${skills} skill${skills === 1 ? '' : 's'} extracted.`);
      await refresh();
    } catch (err) {
      const message = apiErrorMessage(err);
      setError(message);
      toast('error', message);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  async function handleDelete(candidate: Candidate) {
    try {
      await deleteCandidate(candidate.id);
      toast('info', `${candidate.name} removed from the pool.`);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  // Searching the extracted skills, not just the name: "who here knows
  // Kubernetes" is the question a recruiter actually arrives with.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter((candidate) => {
      const haystack = [candidate.name, candidate.email ?? '', ...parseSkills(candidate.extracted_skills)];
      return haystack.some((value) => value.toLowerCase().includes(needle));
    });
  }, [candidates, query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">Candidates</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        Resumes are parsed on upload, and their skills are extracted before any job is scored.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={handleSubmit} className="card p-5 lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-300">Upload a resume</h2>

          <div className="mt-4">
            <label className="label" htmlFor="candidate-name">Name</label>
            <input
              id="candidate-name"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Priya Sharma"
              required
            />
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="candidate-email">
              Email <span className="font-normal text-ink-300">optional</span>
            </label>
            <input
              id="candidate-email"
              type="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="priya@example.com"
            />
          </div>

          <div className="mt-4">
            <span className="label">Resume file</span>
            <FileDrop file={file} onSelect={setFile} accept=".pdf,.docx,.txt" />
          </div>

          {progress !== null && (
            <div className="mt-4">
              <ProgressBar
                value={progress}
                label={progress < 100 ? 'Uploading resume' : 'Extracting text and skills'}
              />
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-accent mt-5 w-full">
            {submitting && <Spinner />}
            {submitting ? 'Working…' : 'Upload resume'}
          </button>

          {error && (
            <div className="mt-4">
              <ErrorNote message={error} onDismiss={() => setError(null)} />
            </div>
          )}
        </form>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500">
              <span className="tnum font-semibold text-ink-900">{candidates.length}</span> in the pool
              {query && visible.length !== candidates.length && (
                <span className="tnum"> · {visible.length} matching</span>
              )}
            </p>
            <div className="relative w-full sm:w-72">
              <svg
                viewBox="0 0 16 16"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7 1a6 6 0 1 0 3.7 10.7l3.3 3.3a.75.75 0 0 0 1-1l-3.3-3.3A6 6 0 0 0 7 1Zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" />
              </svg>
              <input
                ref={searchRef}
                className="field pl-9 pr-10"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email or skill"
                aria-label="Search candidates"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-ink-900/10 bg-ink-900/[0.03] px-1.5 text-[11px] font-medium text-ink-300 sm:block">
                /
              </kbd>
            </div>
          </div>

          {loading ? (
            <SkeletonList />
          ) : candidates.length === 0 ? (
            <EmptyState
              title="No candidates yet"
              body="Upload a PDF, DOCX or TXT resume. Its text is extracted and its skills identified straight away."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 9.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM18 8v6m3-3h-6" />
                </svg>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              title="No match"
              body={`Nobody in the pool matches "${query}".`}
              icon={
                <svg viewBox="0 0 16 16" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                  <path d="M7 1a6 6 0 1 0 3.7 10.7l3.3 3.3a.75.75 0 0 0 1-1l-3.3-3.3A6 6 0 0 0 7 1Zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" />
                </svg>
              }
            />
          ) : (
            <ul className="space-y-3">
              {visible.map((candidate, index) => {
                const skills = parseSkills(candidate.extracted_skills);
                return (
                  <Reveal key={candidate.id} delay={index * 60}>
                    <li>
                      <Tilt max={4} className="card p-4 transition-shadow hover:shadow-lift sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-ink-900">{candidate.name}</p>
                            {candidate.email && <p className="text-sm text-ink-500">{candidate.email}</p>}
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-300">
                              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                                <path d="M4 2.5A1.5 1.5 0 0 1 5.5 1h5.9L16 5.6v11.9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 17.5v-15Zm7.5 0V6H15l-3.5-3.5Z" />
                              </svg>
                              {candidate.resume_filename}
                            </p>
                          </div>
                          <ConfirmButton onConfirm={() => handleDelete(candidate)} label={`Delete ${candidate.name}`}>
                            <TrashIcon />
                          </ConfirmButton>
                        </div>
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-300">
                            Extracted skills · {skills.length}
                          </p>
                          <SkillPills skills={skills} tone="neutral" limit={12} />
                        </div>
                      </Tilt>
                    </li>
                  </Reveal>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
