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
  is_strong_match: boolean;
  matched_skills: string[];
  missing_skills: string[];
  resume_skills: string[];
  required_skills: string[];
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
