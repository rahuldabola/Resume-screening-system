import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { createRateLimiter } from './middleware/rateLimiter';
import candidatesRoutes from './modules/candidates/candidates.routes';
import jobsRoutes from './modules/jobs/jobs.routes';
import scoringRoutes from './modules/scoring/scoring.routes';

export function createApp() {
  const app = express();

  // Railway/Render/Fly put a proxy in front of the app, so req.ip is the
  // proxy's address unless the first X-Forwarded-For hop is trusted. Exactly
  // one hop: trusting the whole chain lets a client prepend a forged address
  // and hand itself a fresh rate-limit bucket per request.
  if (env.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(cors({ origin: env.clientOrigins }));
  app.use(express.json());

  // Skipped in tests: the whole suite drives one createApp() instance
  // through many requests from the same supertest "IP", and a real window
  // would make later tests fail depending on how many ran before them.
  // createRateLimiter() itself is covered directly in rateLimiter.test.ts.
  if (process.env.NODE_ENV !== 'test') {
    app.use('/api', createRateLimiter());
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/jobs/:jobId', scoringRoutes);
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/candidates', candidatesRoutes);

  app.use(errorHandler);

  return app;
}
