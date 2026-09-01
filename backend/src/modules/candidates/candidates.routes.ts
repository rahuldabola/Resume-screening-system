import { Router } from 'express';
import multer from 'multer';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { parseResume } from '../scoring/mlServiceClient';
import * as candidatesService from './candidates.service';
import { candidateMetaSchema } from './candidates.validation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  res.json(candidatesService.listCandidates());
}));

router.post(
  '/',
  upload.single('resume'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'A resume file is required (field name "resume").');

    const { name, email } = candidateMetaSchema.parse(req.body);
    const parsed = await parseResume(req.file.originalname, req.file.buffer);

    const candidate = candidatesService.createCandidate({
      name,
      email: email || null,
      resumeFilename: req.file.originalname,
      resumeText: parsed.text,
      extractedSkills: parsed.skills,
    });

    res.status(201).json(candidate);
  })
);

router.get('/:id', asyncHandler(async (req, res) => {
  const candidate = candidatesService.getCandidateById(Number(req.params.id));
  if (!candidate) throw new ApiError(404, 'Candidate not found');
  res.json(candidate);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  candidatesService.deleteCandidate(Number(req.params.id));
  res.status(204).send();
}));

export default router;
