import db from '../../db';

export interface Candidate {
  id: number;
  name: string;
  email: string | null;
  resume_filename: string;
  resume_text: string;
  extracted_skills: string; // JSON-encoded string[]
  created_at: string;
}

export function createCandidate(params: {
  name: string;
  email: string | null;
  resumeFilename: string;
  resumeText: string;
  extractedSkills: string[];
}): Candidate {
  const info = db
    .prepare(
      'INSERT INTO candidates (name, email, resume_filename, resume_text, extracted_skills) VALUES (?, ?, ?, ?, ?)'
    )
    .run(params.name, params.email, params.resumeFilename, params.resumeText, JSON.stringify(params.extractedSkills));
  return getCandidateById(Number(info.lastInsertRowid)) as Candidate;
}

export function listCandidates(): Candidate[] {
  return db.prepare('SELECT * FROM candidates ORDER BY created_at DESC, id DESC').all() as unknown as Candidate[];
}

export function getCandidateById(id: number): Candidate | undefined {
  return db.prepare('SELECT * FROM candidates WHERE id = ?').get(id) as Candidate | undefined;
}

export function deleteCandidate(id: number): void {
  db.prepare('DELETE FROM assessment_results WHERE candidate_id = ?').run(id);
  db.prepare('DELETE FROM candidates WHERE id = ?').run(id);
}
