import rateLimit, { type Options } from 'express-rate-limit';

/**
 * There's no auth on this API (see README "Known limitations" — it's a
 * single-tenant demo), which makes a plain per-IP rate limit the cheapest
 * real guard against someone hammering /rank and burning ML-service CPU.
 * `overrides` exists so tests can use a tiny window/limit instead of the
 * real 15-minute one.
 */
export function createRateLimiter(overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    ...overrides,
  });
}
