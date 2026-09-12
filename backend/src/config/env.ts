import 'dotenv/config';

/**
 * CLIENT_ORIGIN is a comma-separated list, not a single value. A deployed
 * frontend usually answers on more than one hostname — Vercel serves the same
 * build on its project alias and on a per-deployment URL — and CORS rejects an
 * origin that isn't listed exactly.
 */
export function parseOrigins(raw: string | undefined): string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : ['http://localhost:5173'];
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGIN),
  // Behind a platform proxy (Railway, Render, Fly) every request arrives from
  // the proxy's address, so a per-IP rate limit keyed on it would throttle all
  // clients as one. Opt in explicitly: trusting X-Forwarded-For when nothing
  // sets it lets a client forge its own rate-limit key.
  trustProxy: process.env.TRUST_PROXY === 'true',
};
