/**
 * Deployed, the ML service is reachable over the public internet, so it checks
 * a shared secret. These tests set the variable before importing the client:
 * config/env reads process.env once, at import time.
 */
describe('ML service token', () => {
  const previous = process.env.ML_SERVICE_TOKEN;

  afterEach(() => {
    process.env.ML_SERVICE_TOKEN = previous;
    jest.restoreAllMocks();
  });

  function loadClientWithToken(token: string) {
    process.env.ML_SERVICE_TOKEN = token;
    let client!: typeof import('../mlServiceClient');
    jest.isolateModules(() => {
      client = require('../mlServiceClient');
    });
    return client;
  }

  it('sends the configured token on every ML call', async () => {
    const client = loadClientWithToken('s3cret');
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    } as Response);

    await client.scoreMatch('resume', 'job');
    await client.parseResume('resume.txt', Buffer.from('resume text'));

    for (const call of fetchSpy.mock.calls) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers['X-Service-Token']).toBe('s3cret');
    }
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps the content type it was already sending', async () => {
    const client = loadClientWithToken('s3cret');
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    await client.scoreMatch('resume', 'job');

    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});
