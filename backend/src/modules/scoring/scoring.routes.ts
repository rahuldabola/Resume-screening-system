import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { parseId } from '../../utils/parseId';
import * as scoringService from './scoring.service';

const router = Router({ mergeParams: true });

// mounted at /api/jobs/:jobId/results and /api/jobs/:jobId/rank

router.post('/rank', asyncHandler(async (req, res) => {
  const jobId = parseId(req.params.jobId, 'job id');
  const results = await scoringService.rankCandidatesForJob(jobId);
  res.json(results);
}));

router.get('/results', asyncHandler(async (req, res) => {
  const jobId = parseId(req.params.jobId, 'job id');
  res.json(scoringService.getResultsForJob(jobId));
}));

router.post('/rescore/:candidateId', asyncHandler(async (req, res) => {
  const jobId = parseId(req.params.jobId, 'job id');
  const candidateId = parseId(req.params.candidateId, 'candidate id');
  const results = await scoringService.rescoreOneCandidate(jobId, candidateId);
  res.json(results);
}));

export default router;
