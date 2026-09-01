import db from '../../db';
import { ApiError } from '../../utils/ApiError';
import { getCandidateById, listCandidates } from '../candidates/candidates.service';
import { getJobById } from '../jobs/jobs.service';
import { scoreMatch } from './mlServiceClient';

export interface AssessmentResult {
  id: number;
  job_id: number;
  candidate_id: number;
  match_score: number;
  skill_overlap_score: number;
  tfidf_similarity: number;
  is_strong_match: number; // sqlite stores booleans as 0/1
  matched_skills: string; // JSON-encoded string[]
  missing_skills: string; // JSON-encoded string[]
  created_at: string;
  candidate_name?: string;
  candidate_email?: string | null;
}

export async function rankCandidatesForJob(jobId: number): Promise<AssessmentResult[]> {
  const job = getJobById(jobId);
  if (!job) throw new ApiError(404, 'Job not found');

  const candidates = listCandidates();
  if (candidates.length === 0) {
    throw new ApiError(400, 'No candidates to score yet. Upload at least one resume first.');
  }

  const upsert = db.prepare(`
    INSERT INTO assessment_results
      (job_id, candidate_id, match_score, skill_overlap_score, tfidf_similarity, is_strong_match, matched_skills, missing_skills)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id, candidate_id) DO UPDATE SET
      match_score = excluded.match_score,
      skill_overlap_score = excluded.skill_overlap_score,
      tfidf_similarity = excluded.tfidf_similarity,
      is_strong_match = excluded.is_strong_match,
      matched_skills = excluded.matched_skills,
      missing_skills = excluded.missing_skills,
      created_at = CURRENT_TIMESTAMP
  `);

  for (const candidate of candidates) {
    const result = await scoreMatch(candidate.resume_text, job.description);
    upsert.run(
      jobId,
      candidate.id,
      result.match_score,
      result.skill_overlap_score,
      result.tfidf_similarity,
      result.is_strong_match ? 1 : 0,
      JSON.stringify(result.matched_skills),
      JSON.stringify(result.missing_skills)
    );
  }

  return getResultsForJob(jobId);
}

export function getResultsForJob(jobId: number): AssessmentResult[] {
  return db
    .prepare(
      `SELECT r.*, c.name as candidate_name, c.email as candidate_email
       FROM assessment_results r
       JOIN candidates c ON c.id = r.candidate_id
       WHERE r.job_id = ?
       ORDER BY r.match_score DESC`
    )
    .all(jobId) as unknown as AssessmentResult[];
}

export async function rescoreOneCandidate(jobId: number, candidateId: number): Promise<AssessmentResult[]> {
  const job = getJobById(jobId);
  if (!job) throw new ApiError(404, 'Job not found');

  const candidate = getCandidateById(candidateId);
  if (!candidate) throw new ApiError(404, 'Candidate not found');

  const result = await scoreMatch(candidate.resume_text, job.description);

  db.prepare(`
    INSERT INTO assessment_results
      (job_id, candidate_id, match_score, skill_overlap_score, tfidf_similarity, is_strong_match, matched_skills, missing_skills)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id, candidate_id) DO UPDATE SET
      match_score = excluded.match_score,
      skill_overlap_score = excluded.skill_overlap_score,
      tfidf_similarity = excluded.tfidf_similarity,
      is_strong_match = excluded.is_strong_match,
      matched_skills = excluded.matched_skills,
      missing_skills = excluded.missing_skills,
      created_at = CURRENT_TIMESTAMP
  `).run(
    jobId,
    candidateId,
    result.match_score,
    result.skill_overlap_score,
    result.tfidf_similarity,
    result.is_strong_match ? 1 : 0,
    JSON.stringify(result.matched_skills),
    JSON.stringify(result.missing_skills)
  );

  return getResultsForJob(jobId);
}
