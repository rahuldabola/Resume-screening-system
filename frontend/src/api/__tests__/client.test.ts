import { AxiosError } from 'axios';
import type { AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, apiErrorMessage } from '../client';

const realAdapter = apiClient.defaults.adapter;

afterEach(() => {
  apiClient.defaults.adapter = realAdapter;
  vi.useRealTimers();
});

/** No response at all: a dropped connection, or a container mid-deploy. */
function unreachable(): AxiosAdapter {
  return vi.fn((config) =>
    Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config))
  );
}

/** A real HTTP response, which is the server answering -- just not with 2xx. */
function responds(status: number, data: unknown): AxiosAdapter {
  return vi.fn((config) =>
    Promise.reject(
      new AxiosError('Request failed', String(status), config, null, {
        status,
        statusText: '',
        data,
        headers: {},
        config,
      })
    )
  );
}

describe('apiClient retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('retries a GET once when the request never reached the server', async () => {
    const adapter = unreachable();
    apiClient.defaults.adapter = adapter;

    const pending = apiClient.get('/jobs').catch(() => 'failed');
    await vi.advanceTimersByTimeAsync(700);

    expect(await pending).toBe('failed');
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it('gives up after one retry rather than looping', async () => {
    const adapter = unreachable();
    apiClient.defaults.adapter = adapter;

    const pending = apiClient.get('/jobs').catch(() => 'failed');
    await vi.advanceTimersByTimeAsync(5000);

    await pending;
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it('succeeds transparently when the retry lands', async () => {
    let call = 0;
    apiClient.defaults.adapter = vi.fn((config) => {
      call += 1;
      if (call === 1) {
        return Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config));
      }
      return Promise.resolve({
        status: 200,
        statusText: 'OK',
        data: [{ id: 1 }],
        headers: {},
        config,
      });
    });

    const pending = apiClient.get('/jobs');
    await vi.advanceTimersByTimeAsync(700);

    expect((await pending).data).toEqual([{ id: 1 }]);
  });

  /**
   * The important half of the rule. A POST that got through and was applied
   * can still fail on the way back; replaying it would upload the same resume
   * a second time, so an unreachable write is reported, never repeated.
   */
  it.each(['post', 'put', 'delete'] as const)('never retries a %s', async (method) => {
    const adapter = unreachable();
    apiClient.defaults.adapter = adapter;

    const pending = apiClient.request({ url: '/candidates', method }).catch(() => 'failed');
    await vi.advanceTimersByTimeAsync(5000);

    await pending;
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('does not retry a GET that the server actually answered', async () => {
    const adapter = responds(500, { error: 'boom' });
    apiClient.defaults.adapter = adapter;

    const pending = apiClient.get('/jobs').catch(() => 'failed');
    await vi.advanceTimersByTimeAsync(5000);

    await pending;
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});

describe('apiErrorMessage', () => {
  it('explains an unreachable server in words a user can act on', () => {
    const err = new AxiosError('Network Error', AxiosError.ERR_NETWORK);
    expect(apiErrorMessage(err)).toBe(
      'Could not reach the server. Check your connection and try again.'
    );
  });

  it("prefers the API's own error text", () => {
    const err = new AxiosError('Request failed with status code 400', '400', undefined, null, {
      status: 400,
      statusText: 'Bad Request',
      data: { error: 'title must be at least 3 characters' },
      headers: {},
      config: { headers: {} } as never,
    });
    expect(apiErrorMessage(err)).toBe('title must be at least 3 characters');
  });

  it('falls back to the axios message when the body carries no error field', () => {
    const err = new AxiosError('Request failed with status code 502', '502', undefined, null, {
      status: 502,
      statusText: 'Bad Gateway',
      data: '<html>gateway</html>',
      headers: {},
      config: { headers: {} } as never,
    });
    expect(apiErrorMessage(err)).toBe('Request failed with status code 502');
  });

  it.each([
    ['a thrown Error', new Error('kaboom')],
    ['a thrown string', 'kaboom'],
    ['null', null],
  ])('gives a generic message for %s', (_label, thrown) => {
    expect(apiErrorMessage(thrown)).toBe('Something went wrong.');
  });
});
