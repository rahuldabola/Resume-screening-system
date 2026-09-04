import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import os from 'os';
import path from 'path';

/**
 * The schema in db/index.ts is created with CREATE TABLE IF NOT EXISTS, which
 * is a no-op against a database an earlier version already created. A
 * developer's screening.db — or a mounted Docker volume — therefore has to be
 * migrated in place, not just declared. These tests open a database written by
 * the old code and check the current module can use it.
 */

const OLD_SCHEMA = `
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  resume_filename TEXT NOT NULL,
  resume_text TEXT NOT NULL,
  extracted_skills TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assessment_results (
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
`;

const createdPaths: string[] = [];

function seedLegacyDatabase(): string {
  const dbPath = path.join(os.tmpdir(), `legacy-screening-${process.pid}-${Date.now()}-${Math.random()}.db`);
  createdPaths.push(dbPath);

  const legacy = new DatabaseSync(dbPath);
  legacy.exec(OLD_SCHEMA);
  legacy.exec(`INSERT INTO jobs (id, title, description) VALUES (1, 'Legacy Job', 'A job stored by the old schema.')`);
  legacy.exec(
    `INSERT INTO candidates (id, name, resume_filename, resume_text)
     VALUES (1, 'Legacy Candidate', 'legacy.txt', 'Legacy resume text.')`
  );
  legacy.exec(
    `INSERT INTO assessment_results
       (job_id, candidate_id, match_score, skill_overlap_score, tfidf_similarity, is_strong_match, matched_skills, missing_skills)
     VALUES (1, 1, 61.5, 80, 30, 1, '["python"]', '[]')`
  );
  legacy.close();

  return dbPath;
}

/** Load a fresh copy of the db module pointed at `dbPath`. */
function loadDbModule(dbPath: string) {
  const previous = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = dbPath;

  let db!: typeof import('../index').default;
  jest.isolateModules(() => {
    db = require('../index').default;
  });

  process.env.DATABASE_PATH = previous;
  return db;
}

function columnNames(db: { prepare: (sql: string) => { all: () => unknown } }): Set<string> {
  const rows = db.prepare('PRAGMA table_info(assessment_results)').all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

afterAll(() => {
  for (const dbPath of createdPaths) {
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
      } catch {
        // Windows may still hold the file open; it's a temp file either way.
      }
    }
  }
});

describe('schema migration', () => {
  it('renames is_strong_match to clears_domain_floor, preserving the stored value', () => {
    const db = loadDbModule(seedLegacyDatabase());
    const columns = columnNames(db);

    expect(columns.has('clears_domain_floor')).toBe(true);
    expect(columns.has('is_strong_match')).toBe(false);

    const row = db
      .prepare('SELECT clears_domain_floor, match_score FROM assessment_results WHERE job_id = 1')
      .get() as { clears_domain_floor: number; match_score: number };

    expect(row.clears_domain_floor).toBe(1);
    expect(row.match_score).toBe(61.5);
  });

  it('backfills the keyword-stuffing columns with neutral defaults', () => {
    const db = loadDbModule(seedLegacyDatabase());
    const row = db
      .prepare('SELECT keyword_coverage, stuffing_factor FROM assessment_results WHERE job_id = 1')
      .get() as { keyword_coverage: number; stuffing_factor: number };

    // Rows scored before stuffing detection existed were never damped, so a
    // factor of 1 is the truthful backfill.
    expect(row.keyword_coverage).toBe(0);
    expect(row.stuffing_factor).toBe(1);
  });

  it('is idempotent — migrating an already-current database changes nothing', () => {
    const dbPath = seedLegacyDatabase();
    const first = columnNames(loadDbModule(dbPath));
    const second = columnNames(loadDbModule(dbPath));

    expect([...second].sort()).toEqual([...first].sort());
  });

  it('creates the schema from scratch for a brand new database', () => {
    const fresh = path.join(os.tmpdir(), `fresh-screening-${process.pid}-${Date.now()}.db`);
    createdPaths.push(fresh);

    const columns = columnNames(loadDbModule(fresh));
    expect(columns.has('clears_domain_floor')).toBe(true);
    expect(columns.has('keyword_coverage')).toBe(true);
    expect(columns.has('stuffing_factor')).toBe(true);
  });
});
