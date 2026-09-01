import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'screening.db');

const db = new DatabaseSync(dbPath) as DatabaseSync & {
  transaction: <TArgs extends unknown[], TReturn>(fn: (...args: TArgs) => TReturn) => (...args: TArgs) => TReturn;
};

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.transaction = <TArgs extends unknown[], TReturn>(fn: (...args: TArgs) => TReturn) => {
  return (...args: TArgs): TReturn => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
};

db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  resume_filename TEXT NOT NULL,
  resume_text TEXT NOT NULL,
  extracted_skills TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  candidate_id INTEGER NOT NULL,
  match_score REAL NOT NULL,
  skill_overlap_score REAL NOT NULL,
  tfidf_similarity REAL NOT NULL,
  is_strong_match INTEGER NOT NULL,
  matched_skills TEXT NOT NULL,
  missing_skills TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, candidate_id),
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (candidate_id) REFERENCES candidates(id)
);
`);

export default db;
