import { parseResume, scoreMatch, scoreMatchBatch } from '../mlServiceClient';

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('mlServiceClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('scoreMatch', () => {
    it('returns the parsed score on success', async () => {
      const mockResult = {
        match_score: 80,
        skill_overlap_score: 100,
        tfidf_similarity: 40,
        clears_domain_floor: true,
        keyword_coverage: 0.12,
        stuffing_factor: 1,
        matched_skills: ['python'],
        missing_skills: [],
        resume_skills: ['python'],
        required_skills: ['python'],
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(fakeResponse(mockResult));

      const result = await scoreMatch('resume text', 'job text');
      expect(result).toEqual(mockResult);
    });

    it('throws an ApiError when the ML service responds with an error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        fakeResponse({ detail: 'resume_text and job_description are both required.' }, false, 400)
      );

      await expect(scoreMatch('', 'job text')).rejects.toThrow(/ML service error/);
    });

    it('reports an unreachable ML service as a 503, not an opaque 500', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch failed'));

      await expect(scoreMatch('resume', 'job')).rejects.toMatchObject({
        statusCode: 503,
        message: expect.stringContaining('unreachable'),
      });
    });

    it('reports a hung ML service as a 504', async () => {
      const timeout = new Error('The operation was aborted due to timeout');
      timeout.name = 'TimeoutError';
      jest.spyOn(global, 'fetch').mockRejectedValue(timeout);

      await expect(scoreMatch('resume', 'job')).rejects.toMatchObject({
        statusCode: 504,
        message: expect.stringContaining('timed out'),
      });
    });

    it('sends no service token when none is configured', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(fakeResponse({ match_score: 0 }));

      await scoreMatch('resume', 'job');

      const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers['X-Service-Token']).toBeUndefined();
    });

    it('aborts the request rather than waiting on the ML service forever', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(fakeResponse({ match_score: 0 }));

      await scoreMatch('resume', 'job');

      const init = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('scoreMatchBatch', () => {
    const scored = (id: number, match_score: number) => ({
      id,
      match_score,
      skill_overlap_score: 100,
      tfidf_similarity: 40,
      clears_domain_floor: true,
      keyword_coverage: 0.12,
      stuffing_factor: 1,
      matched_skills: ['python'],
      missing_skills: [],
      resume_skills: ['python'],
      required_skills: ['python'],
    });

    it('returns one result per resume', async () => {
      const results = [scored(1, 80), scored(2, 30)];
      jest.spyOn(global, 'fetch').mockResolvedValue(fakeResponse({ results }));

      const received = await scoreMatchBatch(
        [{ id: 1, text: 'resume one' }, { id: 2, text: 'resume two' }],
        'job text'
      );
      expect(received).toEqual(results);
    });

    it('short-circuits without calling the ML service for an empty pool', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      await expect(scoreMatchBatch([], 'job text')).resolves.toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throws when the ML service returns the wrong number of results', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(fakeResponse({ results: [scored(1, 80)] }));

      await expect(
        scoreMatchBatch([{ id: 1, text: 'one' }, { id: 2, text: 'two' }], 'job text')
      ).rejects.toThrow(/unexpected result set/);
    });

    it('throws when the ML service returns a malformed body', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(fakeResponse({ nonsense: true }));

      await expect(scoreMatchBatch([{ id: 1, text: 'one' }], 'job text')).rejects.toThrow(
        /unexpected result set/
      );
    });

    it('surfaces an ML service error as an ApiError', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        fakeResponse({ detail: 'job_description is required.' }, false, 400)
      );

      await expect(scoreMatchBatch([{ id: 1, text: 'one' }], '')).rejects.toThrow(/ML service error/);
    });
  });

  describe('parseResume', () => {
    it('returns the parsed resume on success', async () => {
      const mockResult = { text: 'extracted text', skills: ['sql'], char_count: 14 };
      jest.spyOn(global, 'fetch').mockResolvedValue(fakeResponse(mockResult));

      const result = await parseResume('resume.txt', Buffer.from('hello'));
      expect(result).toEqual(mockResult);
    });

    it('throws an ApiError for an unsupported file type', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        fakeResponse({ detail: "Unsupported file type for 'resume.xyz'." }, false, 400)
      );

      await expect(parseResume('resume.xyz', Buffer.from('hello'))).rejects.toThrow(/Unsupported file type/);
    });
  });
});
