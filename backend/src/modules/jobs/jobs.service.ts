import db from '../../db';

export interface Job {
  id: number;
  title: string;
  description: string;
  created_at: string;
}

export function createJob(title: string, description: string): Job {
  const info = db
    .prepare('INSERT INTO jobs (title, description) VALUES (?, ?)')
    .run(title, description);
  return getJobById(Number(info.lastInsertRowid)) as Job;
}

export function listJobs(): Job[] {
  return db.prepare('SELECT * FROM jobs ORDER BY created_at DESC, id DESC').all() as unknown as Job[];
}

export function getJobById(id: number): Job | undefined {
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Job | undefined;
}

export function deleteJob(id: number): void {
  db.prepare('DELETE FROM assessment_results WHERE job_id = ?').run(id);
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
}
