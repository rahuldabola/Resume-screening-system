import request from 'supertest';
import type { Express } from 'express';
import { parseOrigins } from '../env';

/**
 * Load a fresh copy of the app with the given environment. `env` is read once
 * at import time, so changing process.env after the first import would have no
 * effect without resetting the module registry.
 */
function appWithEnv(vars: Record<string, string | undefined>): Express {
  const previous = { ...process.env };
  Object.assign(process.env, vars);

  let app: Express;
  jest.isolateModules(() => {
    app = require('../../app').createApp();
  });

  process.env = previous;
  return app!;
}

describe('parseOrigins', () => {
  it('splits a comma-separated list and trims each entry', () => {
    expect(parseOrigins('https://a.example, https://b.example')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('accepts a single origin', () => {
    expect(parseOrigins('https://only.example')).toEqual(['https://only.example']);
  });

  it('falls back to the dev origin when unset or empty', () => {
    expect(parseOrigins(undefined)).toEqual(['http://localhost:5173']);
    expect(parseOrigins('   ')).toEqual(['http://localhost:5173']);
    expect(parseOrigins(' , ,')).toEqual(['http://localhost:5173']);
  });
});

describe('deployed configuration', () => {
  it('allows every origin listed in CLIENT_ORIGIN', async () => {
    const app = appWithEnv({ CLIENT_ORIGIN: 'https://a.example,https://b.example' });

    for (const origin of ['https://a.example', 'https://b.example']) {
      const res = await request(app).get('/api/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  it('does not allow an origin that is not listed', async () => {
    const app = appWithEnv({ CLIENT_ORIGIN: 'https://a.example' });

    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('trusts exactly one proxy hop when TRUST_PROXY is enabled', () => {
    expect(appWithEnv({ TRUST_PROXY: 'true' }).get('trust proxy')).toBe(1);
  });

  it('trusts no proxy by default, so X-Forwarded-For cannot forge a rate-limit key', () => {
    expect(appWithEnv({ TRUST_PROXY: undefined }).get('trust proxy')).toBe(false);
  });
});
