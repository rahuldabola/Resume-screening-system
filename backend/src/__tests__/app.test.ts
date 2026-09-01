import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

function fakeJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('resume screening API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports healthy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('creates and lists a job', async () => {
    const createRes = await request(app)
      .post('/api/jobs')
      .send({ title: 'Backend Engineer', description: 'Build REST APIs with Node.js and PostgreSQL.' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.title).toBe('Backend Engineer');

    const listRes = await request(app).get('/api/jobs');
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((j: { id: number }) => j.id === createRes.body.id)).toBe(true);
  });

  it('rejects an invalid job', async () => {
    const res = await request(app).post('/api/jobs').send({ title: 'A', description: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 400 when ranking a job before any candidate has been uploaded', async () => {
    const jobRes = await request(app)
      .post('/api/jobs')
      .send({ title: 'Lonely Job', description: 'A job posting with no candidates to score against it yet.' });

    const rankRes = await request(app).post(`/api/jobs/${jobRes.body.id}/rank`);
    expect(rankRes.status).toBe(400);
  });

  it('uploads a candidate resume (ML service mocked) and ranks it against a job', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/parse-resume')) {
        return fakeJsonResponse({
          text: 'Backend engineer experienced with Node.js, Express, and PostgreSQL.',
          skills: ['node.js', 'express', 'postgresql'],
          char_count: 70,
        });
      }
      if (url.includes('/score')) {
        return fakeJsonResponse({
          match_score: 88.4,
          skill_overlap_score: 100,
          tfidf_similarity: 60.1,
          is_strong_match: true,
          matched_skills: ['node.js', 'express', 'postgresql'],
          missing_skills: [],
          resume_skills: ['node.js', 'express', 'postgresql'],
          required_skills: ['node.js', 'express', 'postgresql'],
        });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const jobRes = await request(app)
      .post('/api/jobs')
      .send({ title: 'Backend Engineer', description: 'Build REST APIs with Node.js, Express, and PostgreSQL.' });
    const jobId = jobRes.body.id;

    const candidateRes = await request(app)
      .post('/api/candidates')
      .field('name', 'Jane Doe')
      .field('email', 'jane@example.com')
      .attach('resume', Buffer.from('resume content'), 'resume.txt');

    expect(candidateRes.status).toBe(201);
    expect(candidateRes.body.name).toBe('Jane Doe');
    expect(JSON.parse(candidateRes.body.extracted_skills)).toEqual(['node.js', 'express', 'postgresql']);

    const rankRes = await request(app).post(`/api/jobs/${jobId}/rank`);
    expect(rankRes.status).toBe(200);
    expect(rankRes.body[0].match_score).toBe(88.4);
    expect(rankRes.body[0].candidate_name).toBe('Jane Doe');

    const resultsRes = await request(app).get(`/api/jobs/${jobId}/results`);
    expect(resultsRes.status).toBe(200);
    expect(resultsRes.body).toHaveLength(1);
  });

  it('returns 404 for a non-existent job', async () => {
    const res = await request(app).get('/api/jobs/999999');
    expect(res.status).toBe(404);
  });

  it('rejects a candidate upload with no file attached', async () => {
    const res = await request(app).post('/api/candidates').field('name', 'No File Guy');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/resume file is required/i);
  });

  it('rejects a candidate upload with an invalid email', async () => {
    const res = await request(app)
      .post('/api/candidates')
      .field('name', 'Bad Email')
      .field('email', 'not-an-email')
      .attach('resume', Buffer.from('some text'), 'resume.txt');
    expect(res.status).toBe(400);
  });

  it('propagates a resume-parsing failure from the ML service as a 502', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Unsupported file type for 'resume.exe'." }),
    } as Response);

    const res = await request(app)
      .post('/api/candidates')
      .field('name', 'Bad File Type')
      .attach('resume', Buffer.from('binary junk'), 'resume.exe');

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Unsupported file type/);
  });

  it('deletes a candidate', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      fakeJsonResponse({ text: 'resume text', skills: [], char_count: 11 })
    );

    const createRes = await request(app)
      .post('/api/candidates')
      .field('name', 'To Delete')
      .attach('resume', Buffer.from('resume text'), 'delete-me.txt');
    expect(createRes.status).toBe(201);

    const deleteRes = await request(app).delete(`/api/candidates/${createRes.body.id}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/api/candidates/${createRes.body.id}`);
    expect(getRes.status).toBe(404);
  });

  it('deletes a job', async () => {
    const createRes = await request(app)
      .post('/api/jobs')
      .send({ title: 'Job To Delete', description: 'This job posting will be deleted in this test.' });

    const deleteRes = await request(app).delete(`/api/jobs/${createRes.body.id}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/api/jobs/${createRes.body.id}`);
    expect(getRes.status).toBe(404);
  });

  it('rescores a single candidate via the rescore endpoint', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/parse-resume')) {
        return fakeJsonResponse({ text: 'Python and scikit-learn experience.', skills: ['python', 'scikit-learn'], char_count: 36 });
      }
      if (url.includes('/score')) {
        return fakeJsonResponse({
          match_score: 77, skill_overlap_score: 100, tfidf_similarity: 50, is_strong_match: true,
          matched_skills: ['python'], missing_skills: [], resume_skills: ['python'], required_skills: ['python'],
        });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const jobRes = await request(app)
      .post('/api/jobs')
      .send({ title: 'Data Scientist', description: 'Looking for a data scientist skilled in Python.' });
    const candidateRes = await request(app)
      .post('/api/candidates')
      .field('name', 'Rescore Candidate')
      .attach('resume', Buffer.from('resume text'), 'resume.txt');

    const rescoreRes = await request(app).post(`/api/jobs/${jobRes.body.id}/rescore/${candidateRes.body.id}`);
    expect(rescoreRes.status).toBe(200);
    expect(rescoreRes.body[0].match_score).toBe(77);
  });

  it('returns 404 when rescoring against a non-existent job', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      fakeJsonResponse({ text: 'text', skills: [], char_count: 4 })
    );

    const candidateRes = await request(app)
      .post('/api/candidates')
      .field('name', 'Orphan Candidate')
      .attach('resume', Buffer.from('resume text'), 'resume.txt');
    expect(candidateRes.status).toBe(201);

    const res = await request(app).post(`/api/jobs/999999/rescore/${candidateRes.body.id}`);
    expect(res.status).toBe(404);
  });
});
