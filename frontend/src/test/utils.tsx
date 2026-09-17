import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ToastProvider';
import type { AssessmentResult, Candidate, Job } from '../api/types';

/**
 * Renders a component inside the providers the real app always wraps it in.
 *
 * Every page calls `useToast`, which throws outside a provider, and most link
 * somewhere. Supplying both here keeps that plumbing out of the tests, so a
 * test that fails is failing about the thing it names.
 */
export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>
  );
}

/** Builders, so a test states only the fields it is actually about. */
export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 1,
    title: 'Senior Backend Engineer',
    description: 'Python, FastAPI and PostgreSQL.',
    created_at: '2026-01-15 09:30:00',
    ...overrides,
  };
}

export function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 1,
    name: 'Priya Sharma',
    email: 'priya@example.com',
    resume_filename: 'priya.pdf',
    resume_text: 'Backend engineer with six years of Python.',
    extracted_skills: JSON.stringify(['python', 'fastapi', 'postgresql']),
    created_at: '2026-01-15 09:30:00',
    ...overrides,
  };
}

export function makeResult(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    id: 1,
    job_id: 1,
    candidate_id: 1,
    candidate_name: 'Priya Sharma',
    candidate_email: 'priya@example.com',
    match_score: 82.4,
    skill_overlap_score: 88,
    tfidf_similarity: 71,
    clears_domain_floor: 1,
    keyword_coverage: 0.12,
    stuffing_factor: 1,
    matched_skills: JSON.stringify(['python', 'fastapi']),
    missing_skills: JSON.stringify(['kubernetes']),
    created_at: '2026-01-15 09:30:00',
    ...overrides,
  };
}
