import db from '../../db';
import { ApiError } from '../../utils/ApiError';
import { getCandidateById, listCandidates, type Candidate } from '../candidates/candidates.service';
import { getJobById } from '../jobs/jobs.service';
import { scoreMatchBatch, type ScoredResume } from './mlServiceClient';

export interface AssessmentResult {
  id: number;
  job_id: number;
  candidate_id: number;
  match_score: number;
  skill_overlap_score: number;
  tfidf_similarity: number;
  clears_domain_floor: number; // sqlite stores booleans as 0/1
  keyword_coverage: number;
  stuffing_factor: number;
  matched_skills: string; // JSON-encoded string[]
  missing_skills: string; // JSON-encoded string[]
  created_at: string;
  candidate_name?: string;
  candidate_email?: string | null;
}

const UPSERT_RESULT = `
  INSERT INTO assessment_results
    (job_id, candidate_id, match_score, skill_overlap_score, tfidf_similarity,
     clears_domain_floor, keyword_coverage, stuffing_factor, matched_skills, missing_skills)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(job_id, candidate_id) DO UPDATE SET
    match_score = excluded.match_score,
    skill_overlap_score = excluded.skill_overlap_score,
    tfidf_similarity = excluded.tfidf_similarity,
    clears_domain_floor = excluded.clears_domain_floor,
    keyword_coverage = excluded.keyword_coverage,
    stuffing_factor = excluded.stuffing_factor,
    matched_skills = excluded.matched_skills,
    missing_skills = excluded.missing_skills,
    created_at = CURRENT_TIMESTAMP
`;

/**
 * Persist a batch of scores atomically.
 *
 * Without the transaction, an error partway through leaves some candidates
 * scored against the current job description and the rest against whatever it
 * said last time — a ranking that looks complete and isn't.
 */
const persistResults = db.transaction((jobId: number, scored: ScoredResume[]) => {
  const upsert = db.prepare(UPSERT_RESULT);

  for (const result of scored) {
    upsert.run(
      jobId,
      result.id,
      result.match_score,
      result.skill_overlap_score,
      result.tfidf_similarity,
      result.clears_domain_floor ? 1 : 0,
      result.keyword_coverage,
      result.stuffing_factor,
      JSON.stringify(result.matched_skills),
      JSON.stringify(result.missing_skills)
    );
  }
});

function toResumeInputs(candidates: Candidate[]) {
  return candidates.map((candidate) => ({ id: candidate.id, text: candidate.resume_text }));
}

export async function rankCandidatesForJob(jobId: number): Promise<AssessmentResult[]> {
  const job = getJobById(jobId);
  if (!job) throw new ApiError(404, 'Job not found');

  const candidates = listCandidates();
  if (candidates.length === 0) {
    throw new ApiError(400, 'No candidates to score yet. Upload at least one resume first.');
  }

  const scored = await scoreMatchBatch(toResumeInputs(candidates), job.description);
  persistResults(jobId, scored);

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

/**
 * Re-score one candidate against a job.
 *
 * The whole pool is sent to the ML service even though only one row is
 * written. That looks wasteful until you remember scores are pool-relative:
 * IDF is estimated across the documents the vectorizer sees, so scoring this
 * candidate alone would produce a number that isn't comparable with the
 * stored ranking it's about to sit inside.
 */
export async function rescoreOneCandidate(
  jobId: number,
  candidateId: number
): Promise<AssessmentResult[]> {
  const job = getJobById(jobId);
  if (!job) throw new ApiError(404, 'Job not found');

  const candidate = getCandidateById(candidateId);
  if (!candidate) throw new ApiError(404, 'Candidate not found');

  const pool = listCandidates();
  const scored = await scoreMatchBatch(toResumeInputs(pool), job.description);

  const result = scored.find((entry) => entry.id === candidateId);
  if (!result) {
    throw new ApiError(502, 'ML service error: no score returned for the requested candidate.');
  }

  persistResults(jobId, [result]);

  return getResultsForJob(jobId);
}
