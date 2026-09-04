import { Router } from 'express';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { parseId } from '../../utils/parseId';
import * as jobsService from './jobs.service';
import { createJobSchema } from './jobs.validation';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  res.json(jobsService.listJobs());
}));

router.post('/', asyncHandler(async (req, res) => {
  const { title, description } = createJobSchema.parse(req.body);
  const job = jobsService.createJob(title, description);
  res.status(201).json(job);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const job = jobsService.getJobById(parseId(req.params.id, 'job id'));
  if (!job) throw new ApiError(404, 'Job not found');
  res.json(job);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = jobsService.deleteJob(parseId(req.params.id, 'job id'));
  if (!deleted) throw new ApiError(404, 'Job not found');
  res.status(204).send();
}));

export default router;
