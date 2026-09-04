import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';

export interface ParseResumeResult {
  text: string;
  skills: string[];
  char_count: number;
}

export interface ScoreResult {
  match_score: number;
  skill_overlap_score: number;
  tfidf_similarity: number;
  clears_domain_floor: boolean;
  keyword_coverage: number;
  stuffing_factor: number;
  matched_skills: string[];
  missing_skills: string[];
  resume_skills: string[];
  required_skills: string[];
}

export interface ScoredResume extends ScoreResult {
  id: number;
}

export interface ResumeInput {
  id: number;
  text: string;
}

async function parseJsonOrThrow(res: Response, context: string) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (body as { detail?: string }).detail || `${context} failed (${res.status})`;
    throw new ApiError(502, `ML service error: ${message}`);
  }
  return body;
}

export async function parseResume(filename: string, buffer: Buffer): Promise<ParseResumeResult> {
  const formData = new FormData();
  formData.append('file', new Blob([buffer]), filename);

  const res = await fetch(`${env.mlServiceUrl}/parse-resume`, {
    method: 'POST',
    body: formData,
  });

  return parseJsonOrThrow(res, 'Resume parsing') as Promise<ParseResumeResult>;
}

export async function scoreMatch(resumeText: string, jobDescription: string): Promise<ScoreResult> {
  const res = await fetch(`${env.mlServiceUrl}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume_text: resumeText, job_description: jobDescription }),
  });

  return parseJsonOrThrow(res, 'Scoring') as Promise<ScoreResult>;
}

/**
 * Score a whole pool of candidates against one job in a single round trip.
 *
 * This is what the ranking flow uses. Scoring candidates one at a time was
 * both N HTTP calls and N independent TF-IDF fits, which made the similarity
 * term incomparable between candidates — the ML service estimates IDF from
 * the documents it is fit on, so it needs to see the pool at once.
 */
export async function scoreMatchBatch(
  resumes: ResumeInput[],
  jobDescription: string
): Promise<ScoredResume[]> {
  if (resumes.length === 0) return [];

  const res = await fetch(`${env.mlServiceUrl}/score-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumes, job_description: jobDescription }),
  });

  const body = (await parseJsonOrThrow(res, 'Batch scoring')) as { results?: ScoredResume[] };

  if (!Array.isArray(body.results) || body.results.length !== resumes.length) {
    throw new ApiError(502, 'ML service error: batch scoring returned an unexpected result set.');
  }

  return body.results;
}
