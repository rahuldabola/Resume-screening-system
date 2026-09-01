import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import candidatesRoutes from './modules/candidates/candidates.routes';
import jobsRoutes from './modules/jobs/jobs.routes';
import scoringRoutes from './modules/scoring/scoring.routes';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/jobs/:jobId', scoringRoutes);
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/candidates', candidatesRoutes);

  app.use(errorHandler);

  return app;
}
