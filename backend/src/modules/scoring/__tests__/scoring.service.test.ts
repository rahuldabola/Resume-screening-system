import { createCandidate } from '../../candidates/candidates.service';
import { createJob } from '../../jobs/jobs.service';
import * as mlServiceClient from '../mlServiceClient';
import * as scoringService from '../scoring.service';

jest.mock('../mlServiceClient');
const mockedScoreMatch = mlServiceClient.scoreMatch as jest.Mock;

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

    mockedScoreMatch.mockImplementation(async (resumeText: string) => {
      const isStrong = resumeText.includes('PostgreSQL');
      return {
        match_score: isStrong ? 90 : 5,
        skill_overlap_score: isStrong ? 100 : 0,
        tfidf_similarity: isStrong ? 60 : 2,
        is_strong_match: isStrong,
        matched_skills: isStrong ? ['node.js', 'postgresql'] : [],
        missing_skills: isStrong ? [] : ['node.js', 'postgresql'],
        resume_skills: isStrong ? ['node.js', 'postgresql'] : ['graphic design'],
        required_skills: ['node.js', 'postgresql'],
      };
    });

    const results = await scoringService.rankCandidatesForJob(job.id);

    expect(results).toHaveLength(2);
    expect(results[0].candidate_id).toBe(strong.id);
    expect(results[0].match_score).toBe(90);
    expect(results[1].candidate_id).toBe(weak.id);
    expect(results[1].match_score).toBe(5);
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

    mockedScoreMatch.mockResolvedValue({
      match_score: 10, skill_overlap_score: 0, tfidf_similarity: 10, is_strong_match: false,
      matched_skills: [], missing_skills: [], resume_skills: [], required_skills: [],
    });
    await scoringService.rankCandidatesForJob(job.id);

    mockedScoreMatch.mockResolvedValue({
      match_score: 50, skill_overlap_score: 50, tfidf_similarity: 20, is_strong_match: true,
      matched_skills: ['sql'], missing_skills: [], resume_skills: ['sql'], required_skills: ['sql'],
    });
    const secondRun = await scoringService.rankCandidatesForJob(job.id);

    const rowsForCandidate = secondRun.filter((r) => r.candidate_id === candidate.id);
    expect(rowsForCandidate).toHaveLength(1);
    expect(rowsForCandidate[0].match_score).toBe(50);
  });

  it('rescoreOneCandidate updates just that candidate', async () => {
    const job = createJob('Rescore Job', 'A job used to test rescoring a single candidate in isolation.');
    const candidate = createCandidate({
      name: 'Rescore Me',
      email: null,
      resumeFilename: 'rescore.txt',
      resumeText: 'Some resume text.',
      extractedSkills: [],
    });

    mockedScoreMatch.mockResolvedValue({
      match_score: 42, skill_overlap_score: 42, tfidf_similarity: 42, is_strong_match: false,
      matched_skills: [], missing_skills: [], resume_skills: [], required_skills: [],
    });

    const results = await scoringService.rescoreOneCandidate(job.id, candidate.id);
    expect(results[0].match_score).toBe(42);
  });

  it('rescoreOneCandidate throws for a non-existent candidate', async () => {
    const job = createJob('Another Job', 'A job used to test rescoring against a missing candidate id.');
    await expect(scoringService.rescoreOneCandidate(job.id, 999999)).rejects.toThrow('Candidate not found');
  });
});
