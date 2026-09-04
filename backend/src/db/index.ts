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
  clears_domain_floor INTEGER NOT NULL,
  keyword_coverage REAL NOT NULL DEFAULT 0,
  stuffing_factor REAL NOT NULL DEFAULT 1,
  matched_skills TEXT NOT NULL,
  missing_skills TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, candidate_id),
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (candidate_id) REFERENCES candidates(id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_results_job
  ON assessment_results (job_id, match_score DESC);
`);

/**
 * Bring an existing database up to the schema above.
 *
 * `CREATE TABLE IF NOT EXISTS` is a no-op against a database created by an
 * earlier version, so a developer or a mounted Docker volume carrying the old
 * table would otherwise break on the first query. Each step is guarded by what
 * the table actually has, so running this repeatedly is safe.
 */
function migrate() {
  const columns = db
    .prepare('PRAGMA table_info(assessment_results)')
    .all() as unknown as { name: string }[];
  const columnNames = new Set(columns.map((column) => column.name));

  // `is_strong_match` was named for a bar it never enforced: it was set from a
  // score of 3/100, while the UI calls 70+ a strong match. Same data, honest name.
  if (columnNames.has('is_strong_match') && !columnNames.has('clears_domain_floor')) {
    db.exec('ALTER TABLE assessment_results RENAME COLUMN is_strong_match TO clears_domain_floor');
  }

  if (!columnNames.has('keyword_coverage')) {
    db.exec('ALTER TABLE assessment_results ADD COLUMN keyword_coverage REAL NOT NULL DEFAULT 0');
  }

  if (!columnNames.has('stuffing_factor')) {
    db.exec('ALTER TABLE assessment_results ADD COLUMN stuffing_factor REAL NOT NULL DEFAULT 1');
  }
}

migrate();

export default db;
