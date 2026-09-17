import type { AxiosAdapter, AxiosProgressEvent, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../client';
import { deleteCandidate, listCandidates, uploadCandidate } from '../candidates';
import { createJob, deleteJob, getJob, getResults, listJobs, rankCandidates } from '../jobs';
import { makeCandidate, makeJob, makeResult } from '../../test/utils';

/**
 * These run against a stub adapter rather than a mocked module, so the URL,
 * the verb and the body each call actually puts on the wire are asserted. The
 * page tests mock this layer away, which is exactly why it needs its own.
 */
const realAdapter = apiClient.defaults.adapter;
let sent: InternalAxiosRequestConfig[];

function replyWith(data: unknown): AxiosAdapter {
  return vi.fn((config) => {
    sent.push(config);
    return Promise.resolve({ status: 200, statusText: 'OK', data, headers: {}, config });
  });
}

beforeEach(() => {
  sent = [];
});

afterEach(() => {
  apiClient.defaults.adapter = realAdapter;
});

const lastCall = () => sent[sent.length - 1]!;

describe('jobs endpoints', () => {
  it('lists jobs', async () => {
    apiClient.defaults.adapter = replyWith([makeJob()]);

    await expect(listJobs()).resolves.toEqual([makeJob()]);
    expect(lastCall().method).toBe('get');
    expect(lastCall().url).toBe('/jobs');
  });

  it('fetches one job by id', async () => {
    apiClient.defaults.adapter = replyWith(makeJob({ id: 7 }));

    await getJob(7);

    expect(lastCall().url).toBe('/jobs/7');
  });

  it('posts a new job as JSON', async () => {
    apiClient.defaults.adapter = replyWith(makeJob());

    await createJob('Senior Backend Engineer', 'Python and FastAPI.');

    expect(lastCall().method).toBe('post');
    expect(lastCall().url).toBe('/jobs');
    expect(JSON.parse(lastCall().data)).toEqual({
      title: 'Senior Backend Engineer',
      description: 'Python and FastAPI.',
    });
  });

  it('deletes a job', async () => {
    apiClient.defaults.adapter = replyWith(undefined);

    await deleteJob(7);

    expect(lastCall().method).toBe('delete');
    expect(lastCall().url).toBe('/jobs/7');
  });

  /** Ranking rewrites the whole pool's scores, so it is a POST, not a read. */
  it('ranks a whole job with a POST', async () => {
    apiClient.defaults.adapter = replyWith([makeResult()]);

    await expect(rankCandidates(7)).resolves.toEqual([makeResult()]);
    expect(lastCall().method).toBe('post');
    expect(lastCall().url).toBe('/jobs/7/rank');
  });

  it('reads existing results without re-ranking', async () => {
    apiClient.defaults.adapter = replyWith([makeResult()]);

    await getResults(7);

    expect(lastCall().method).toBe('get');
    expect(lastCall().url).toBe('/jobs/7/results');
  });
});

describe('candidate endpoints', () => {
  it('lists candidates', async () => {
    apiClient.defaults.adapter = replyWith([makeCandidate()]);

    await expect(listCandidates()).resolves.toEqual([makeCandidate()]);
    expect(lastCall().url).toBe('/candidates');
  });

  it('deletes a candidate', async () => {
    apiClient.defaults.adapter = replyWith(undefined);

    await deleteCandidate(3);

    expect(lastCall().method).toBe('delete');
    expect(lastCall().url).toBe('/candidates/3');
  });

  describe('uploadCandidate', () => {
    const file = () => new File(['resume'], 'priya.pdf', { type: 'application/pdf' });

    it('sends the resume as multipart form data', async () => {
      apiClient.defaults.adapter = replyWith(makeCandidate());

      await uploadCandidate('Priya Sharma', 'priya@example.com', file());

      const body = lastCall().data as FormData;
      expect(lastCall().method).toBe('post');
      expect(lastCall().url).toBe('/candidates');
      expect(body.get('name')).toBe('Priya Sharma');
      expect(body.get('email')).toBe('priya@example.com');
      expect((body.get('resume') as File).name).toBe('priya.pdf');
    });

    /**
     * Email is optional, and an empty field is not the same as an empty
     * address: omitting the part entirely lets the API store NULL rather than
     * an empty string that later renders as a blank line under every name.
     */
    it('omits an empty email rather than sending a blank one', async () => {
      apiClient.defaults.adapter = replyWith(makeCandidate());

      await uploadCandidate('Priya Sharma', '', file());

      expect((lastCall().data as FormData).has('email')).toBe(false);
    });

    it('reports upload progress as a percentage', async () => {
      const onProgress = vi.fn();
      apiClient.defaults.adapter = vi.fn((config) => {
        sent.push(config);
        config.onUploadProgress?.({ loaded: 512, total: 2048 } as AxiosProgressEvent);
        return Promise.resolve({
          status: 200,
          statusText: 'OK',
          data: makeCandidate(),
          headers: {},
          config,
        });
      });

      await uploadCandidate('Priya Sharma', '', file(), onProgress);

      expect(onProgress).toHaveBeenCalledWith(25);
    });

    /** A progress event without a total would otherwise compute NaN%. */
    it('stays quiet when the total size is unknown', async () => {
      const onProgress = vi.fn();
      apiClient.defaults.adapter = vi.fn((config) => {
        sent.push(config);
        config.onUploadProgress?.({ loaded: 512 } as AxiosProgressEvent);
        return Promise.resolve({
          status: 200,
          statusText: 'OK',
          data: makeCandidate(),
          headers: {},
          config,
        });
      });

      await uploadCandidate('Priya Sharma', '', file(), onProgress);

      expect(onProgress).not.toHaveBeenCalled();
    });

    it('works with no progress callback at all', async () => {
      apiClient.defaults.adapter = vi.fn((config) => {
        sent.push(config);
        config.onUploadProgress?.({ loaded: 512, total: 2048 } as AxiosProgressEvent);
        return Promise.resolve({
          status: 200,
          statusText: 'OK',
          data: makeCandidate(),
          headers: {},
          config,
        });
      });

      await expect(uploadCandidate('Priya Sharma', '', file())).resolves.toBeTruthy();
    });
  });
});
