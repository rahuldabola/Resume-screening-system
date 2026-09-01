import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as scoringService from './scoring.service';

const router = Router({ mergeParams: true });

// mounted at /api/jobs/:jobId/results and /api/jobs/:jobId/rank

router.post('/rank', asyncHandler(async (req, res) => {
  const jobId = Number(req.params.jobId);
  const results = await scoringService.rankCandidatesForJob(jobId);
  res.json(results);
}));

router.get('/results', asyncHandler(async (req, res) => {
  const jobId = Number(req.params.jobId);
  res.json(scoringService.getResultsForJob(jobId));
}));

router.post('/rescore/:candidateId', asyncHandler(async (req, res) => {
  const jobId = Number(req.params.jobId);
  const candidateId = Number(req.params.candidateId);
  const results = await scoringService.rescoreOneCandidate(jobId, candidateId);
  res.json(results);
}));

export default router;
