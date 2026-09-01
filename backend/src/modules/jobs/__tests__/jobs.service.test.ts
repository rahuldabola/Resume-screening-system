import * as jobsService from '../jobs.service';

describe('jobs.service', () => {
  it('creates and retrieves a job', () => {
    const job = jobsService.createJob('Backend Engineer', 'Build REST APIs with Node.js and PostgreSQL.');
    expect(job.id).toBeGreaterThan(0);
    expect(job.title).toBe('Backend Engineer');

    const fetched = jobsService.getJobById(job.id);
    expect(fetched).toEqual(job);
  });

  it('returns undefined for a non-existent job', () => {
    expect(jobsService.getJobById(999999)).toBeUndefined();
  });

  it('lists jobs most-recent first', () => {
    const first = jobsService.createJob('Job A', 'Description for job A, long enough to pass validation.');
    const second = jobsService.createJob('Job B', 'Description for job B, long enough to pass validation.');

    const jobs = jobsService.listJobs();
    const indexA = jobs.findIndex((j) => j.id === first.id);
    const indexB = jobs.findIndex((j) => j.id === second.id);
    expect(indexB).toBeLessThan(indexA);
  });

  it('deletes a job', () => {
    const job = jobsService.createJob('Temp Job', 'This job will be deleted immediately after creation.');
    jobsService.deleteJob(job.id);
    expect(jobsService.getJobById(job.id)).toBeUndefined();
  });
});
