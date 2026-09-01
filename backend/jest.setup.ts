import fs from 'fs';
import os from 'os';
import path from 'path';

// give every test run its own throwaway SQLite file so tests never share
// state with each other or with a real dev database
process.env.DATABASE_PATH = path.join(os.tmpdir(), `resume-screening-test-${process.pid}-${Date.now()}.db`);

afterAll(() => {
  // best-effort cleanup: on Windows the sqlite file may still be held open
  // by this process, which makes unlink fail with EBUSY. That's harmless —
  // it's a throwaway temp file, not something the test correctness depends on.
  for (const suffix of ['', '-wal', '-shm']) {
    const file = process.env.DATABASE_PATH + suffix;
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      // ignore
    }
  }
});
