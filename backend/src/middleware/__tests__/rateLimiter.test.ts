import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../rateLimiter';

describe('createRateLimiter', () => {
  it('allows requests under the limit and blocks once it is exceeded', async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, limit: 2 }));
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    const first = await request(app).get('/ping');
    const second = await request(app).get('/ping');
    const third = await request(app).get('/ping');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body.error).toMatch(/too many requests/i);
  });
});
