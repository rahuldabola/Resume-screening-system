import { parseResume, scoreMatch } from '../mlServiceClient';

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
        is_strong_match: true,
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

    it('throws when the ML service is unreachable', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch failed'));
      await expect(scoreMatch('resume', 'job')).rejects.toThrow('fetch failed');
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
