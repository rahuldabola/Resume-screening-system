import { createCandidate } from '../../candidates/candidates.service';
import { createJob } from '../../jobs/jobs.service';
import * as mlServiceClient from '../mlServiceClient';
import * as scoringService from '../scoring.service';

jest.mock('../mlServiceClient');
const mockedScoreBatch = mlServiceClient.scoreMatchBatch as jest.Mock;

type ResumeInput = { id: number; text: string };

/** Build a batch response from a per-resume scoring function. */
function batchScoredBy(score: (text: string) => Partial<mlServiceClient.ScoreResult>) {
  return async (resumes: ResumeInput[]) =>
    resumes.map((resume) => ({
      id: resume.id,
      match_score: 0,
      skill_overlap_score: 0,
      tfidf_similarity: 0,
      clears_domain_floor: false,
      keyword_coverage: 0.1,
      stuffing_factor: 1,
      matched_skills: [],
      missing_skills: [],
      resume_skills: [],
      required_skills: [],
      ...score(resume.text),
    }));
}

describe('scoring.service', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('throws for a non-existent job', async () => {
    await expect(scoringService.rankCandidatesForJob(999999)).rejects.toThrow('Job not found');
  });

  it('throws when there are no candidates at all', async () => {
    const job = createJob('Empty Job', 'A job with no candidates uploaded to score against it yet.');
    await expect(scoringService.rankCandidatesForJob(job.id)).rejects.toThrow('No candidates to score');
  });

  it('ranks candidates by match score, highest first', async () => {
    const job = createJob('Backend Role', 'Backend engineer role requiring Node.js and PostgreSQL experience.');
    const strong = createCandidate({
      name: 'Strong Fit',
      email: null,
      resumeFilename: 'strong.txt',
      resumeText: 'Node.js and PostgreSQL expert.',
      extractedSkills: ['node.js', 'postgresql'],
    });
    const weak = createCandidate({
      name: 'Weak Fit',
      email: null,
      resumeFilename: 'weak.txt',
      resumeText: 'Graphic designer.',
      extractedSkills: ['graphic design'],
    });

    mockedScoreBatch.mockImplementation(
      batchScoredBy((text) => {
        const isStrong = text.includes('PostgreSQL');
        return {
          match_score: isStrong ? 90 : 5,
          skill_overlap_score: isStrong ? 100 : 0,
          tfidf_similarity: isStrong ? 60 : 2,
          clears_domain_floor: isStrong,
          matched_skills: isStrong ? ['node.js', 'postgresql'] : [],
          missing_skills: isStrong ? [] : ['node.js', 'postgresql'],
        };
      })
    );

    const results = await scoringService.rankCandidatesForJob(job.id);

    expect(results[0].candidate_id).toBe(strong.id);
    expect(results[0].match_score).toBe(90);

    const weakRow = results.find((row) => row.candidate_id === weak.id);
    expect(weakRow?.match_score).toBe(5);
  });

  it('scores the whole pool in a single ML service call', async () => {
    const job = createJob('Batch Job', 'A job used to verify the pool is scored in one round trip.');
    createCandidate({
      name: 'Pool Member',
      email: null,
      resumeFilename: 'pool.txt',
      resumeText: 'Some resume text.',
      extractedSkills: [],
    });

    mockedScoreBatch.mockImplementation(batchScoredBy(() => ({ match_score: 20 })));
    await scoringService.rankCandidatesForJob(job.id);

    expect(mockedScoreBatch).toHaveBeenCalledTimes(1);
    const [resumes, description] = mockedScoreBatch.mock.calls[0];
    expect(resumes.length).toBeGreaterThan(0);
    expect(description).toContain('one round trip');
  });

  it('persists the keyword-stuffing breakdown alongside the score', async () => {
    const job = createJob('Stuffing Job', 'A job used to check that stuffing metadata is persisted.');
    const candidate = createCandidate({
      name: 'Keyword Stuffer',
      email: null,
      resumeFilename: 'stuffed.txt',
      resumeText: 'python java docker kubernetes aws',
      extractedSkills: [],
    });

    mockedScoreBatch.mockImplementation(
      batchScoredBy((text) =>
        text.startsWith('python java')
          ? { match_score: 14, keyword_coverage: 0.92, stuffing_factor: 0.2 }
          : { match_score: 30 }
      )
    );

    const results = await scoringService.rankCandidatesForJob(job.id);
    const row = results.find((entry) => entry.candidate_id === candidate.id);

    expect(row?.keyword_coverage).toBeCloseTo(0.92);
    expect(row?.stuffing_factor).toBeCloseTo(0.2);
  });

  it('is idempotent — re-ranking updates the existing row instead of duplicating it', async () => {
    // rankCandidatesForJob scores every candidate that exists in the system
    // (by design — it's a global candidate pool), so this test can't assume
    // it's the only candidate present; other tests in this file add their
    // own. It only asserts about the one candidate it created itself.
    const job = createJob('Idempotent Job', 'A job used to test that re-ranking does not duplicate results.');
    const candidate = createCandidate({
      name: 'Only Candidate',
      email: null,
      resumeFilename: 'only.txt',
      resumeText: 'Some resume text.',
      extractedSkills: [],
    });

    mockedScoreBatch.mockImplementation(batchScoredBy(() => ({ match_score: 10, tfidf_similarity: 10 })));
    await scoringService.rankCandidatesForJob(job.id);

    mockedScoreBatch.mockImplementation(
      batchScoredBy(() => ({ match_score: 50, skill_overlap_score: 50, matched_skills: ['sql'] }))
    );
    const secondRun = await scoringService.rankCandidatesForJob(job.id);

    const rowsForCandidate = secondRun.filter((r) => r.candidate_id === candidate.id);
    expect(rowsForCandidate).toHaveLength(1);
    expect(rowsForCandidate[0].match_score).toBe(50);
  });

  it('leaves every stored score untouched when the ML service fails mid-ranking', async () => {
    const job = createJob('Atomic Job', 'A job used to verify ranking writes are all-or-nothing.');
    createCandidate({
      name: 'Atomic Candidate',
      email: null,
      resumeFilename: 'atomic.txt',
      resumeText: 'Some resume text.',
      extractedSkills: [],
    });

    mockedScoreBatch.mockImplementation(batchScoredBy(() => ({ match_score: 33 })));
    const before = await scoringService.rankCandidatesForJob(job.id);

    mockedScoreBatch.mockRejectedValue(new Error('ML service error: upstream exploded'));
    await expect(scoringService.rankCandidatesForJob(job.id)).rejects.toThrow('upstream exploded');

    const after = scoringService.getResultsForJob(job.id);
    expect(after.map((row) => row.match_score)).toEqual(before.map((row) => row.match_score));
  });

  it('rescoreOneCandidate updates just that candidate', async () => {
    const job = createJob('Rescore Job', 'A job used to test rescoring a single candidate in isolation.');
    const candidate = createCandidate({
      name: 'Rescore Me',
      email: null,
      resumeFilename: 'rescore.txt',
      resumeText: 'Rescore me please.',
      extractedSkills: [],
    });

    mockedScoreBatch.mockImplementation(
      batchScoredBy((text) => ({ match_score: text.includes('Rescore me please') ? 42 : 1 }))
    );

    const results = await scoringService.rescoreOneCandidate(job.id, candidate.id);
    const row = results.find((entry) => entry.candidate_id === candidate.id);

    expect(row?.match_score).toBe(42);
    // Only the requested candidate is written, even though the whole pool was
    // scored to keep IDF comparable.
    expect(results.filter((entry) => entry.candidate_id !== candidate.id)).toHaveLength(0);
  });

  it('rescoreOneCandidate throws for a non-existent candidate', async () => {
    const job = createJob('Another Job', 'A job used to test rescoring against a missing candidate id.');
    await expect(scoringService.rescoreOneCandidate(job.id, 999999)).rejects.toThrow('Candidate not found');
  });

  it('rescoreOneCandidate throws when the ML service omits the requested candidate', async () => {
    const job = createJob('Missing Result Job', 'A job used to test a malformed batch response from the ML service.');
    const candidate = createCandidate({
      name: 'Dropped By ML',
      email: null,
      resumeFilename: 'dropped.txt',
      resumeText: 'Some resume text.',
      extractedSkills: [],
    });

    mockedScoreBatch.mockImplementation(async (resumes: ResumeInput[]) =>
      (await batchScoredBy(() => ({ match_score: 5 }))(resumes)).filter(
        (entry) => entry.id !== candidate.id
      )
    );

    await expect(scoringService.rescoreOneCandidate(job.id, candidate.id)).rejects.toThrow(
      'no score returned'
    );
  });
});
