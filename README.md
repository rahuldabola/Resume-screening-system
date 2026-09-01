# ScreenSmart — AI-Powered Resume Screening System

An end-to-end recruitment platform: post a job, upload resumes, and get candidates automatically ranked by how well they match — with a transparent score breakdown, not a black-box number.

**Stack:** React 18 + TypeScript · Node.js + Express + TypeScript · Python + FastAPI + scikit-learn · SQLite · Docker

## What it does

1. **Post a job** — title + description.
2. **Upload resumes** (PDF, DOCX, or TXT) — text is extracted and skills are identified automatically.
3. **Rank candidates** — every uploaded resume is scored against the job description and sorted best-first, with a visible breakdown of *why* each candidate scored the way they did (matched skills, missing skills, text similarity).

## Architecture

```
┌──────────────┐      HTTP       ┌──────────────────┐      HTTP       ┌─────────────────────┐
│  React SPA   │ ──────────────▶ │  Node/Express API │ ──────────────▶ │  Python ML service   │
│  (TS, Vite)  │ ◀────────────── │  (TS, SQLite)      │ ◀────────────── │  (FastAPI, sklearn)  │
└──────────────┘      JSON       └──────────────────┘      JSON       └─────────────────────┘
                                          │
                                          ▼
                                   screening.db
                              (jobs, candidates, results)
```

The Node API owns persistence, file upload, and orchestration. The Python service owns everything NLP/ML: resume text extraction, skill extraction, and the actual matching model. This split mirrors how these systems are built in practice — a general-purpose backend calling out to a specialized ML service rather than reimplementing text processing in two languages.

## The matching model — and a real accuracy number

Match score is a weighted combination of two independent signals, computed per (resume, job) pair:

1. **Skill overlap (65% weight)** — of the skills the job description asks for, what fraction does the candidate's resume actually mention? Skills are identified via a curated ~50-skill taxonomy with alias matching (`ml-service/app/skills_taxonomy.py`) — e.g. "node.js", "nodejs", and "node" all resolve to the same skill.
2. **TF-IDF cosine similarity (35% weight)** — how similar is the resume's overall language to the job description's, via scikit-learn's `TfidfVectorizer`? This catches relevant experience the fixed taxonomy doesn't have a keyword for.

**This is backed by a real, reproducible evaluation, not an asserted number.** `ml-service/evaluation/eval_dataset.json` contains 45 hand-labeled (resume, job, is-a-match) pairs across 9 job domains (backend, frontend, data science, DevOps, sales, marketing, accounting, design, support), including same-domain matches and deliberately-mismatched cross-domain pairs. Running the evaluation:

```bash
cd ml-service
python -m evaluation.evaluate
```

produces:

```
Pairs evaluated:     45
Best threshold:      3.0
Accuracy:            97.8%
Precision:           95.7%
Recall:              100.0%
F1:                  97.8%
Confusion matrix:    TP=22 FN=0 FP=1 TN=22
```

The one misclassification is printed by the script too — a sales resume scoring 34.9 against a design job, both of which happen to contain a handful of shared non-technical words. Nothing here is cherry-picked: the dataset was written before the passing threshold was chosen, and the threshold itself is just the value that maximizes accuracy on that fixed dataset (the standard way to calibrate a continuous score into a binary decision).

## Repo structure

```
frontend/          React + TypeScript + Tailwind SPA
backend/           Node.js + Express + TypeScript REST API, SQLite persistence
  src/modules/     jobs, candidates, scoring — each with routes + service + tests
ml-service/        Python + FastAPI — resume parsing, skill extraction, scoring
  evaluation/      the labeled dataset + evaluate.py (produces the numbers above)
  tests/           pytest unit tests for the scoring/extraction logic
docker-compose.yml runs all three services together
```

## Running it

### Option A — Docker Compose

```bash
docker compose up --build
```

- Frontend → http://localhost:5173
- Backend API → http://localhost:4000/api
- ML service docs (Swagger) → http://localhost:8000/docs

### Option B — Run each service locally

**ML service**
```bash
cd ml-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Backend**
```bash
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:4000
```

**Frontend**
```bash
cd frontend
cp .env.example .env
npm install
npm run dev           # http://localhost:5173
```

## Tests

```bash
# ML service: unit tests for skill extraction + scoring
cd ml-service && python -m pytest tests/ -v            # 9 tests

# ML service: the accuracy evaluation itself
cd ml-service && python -m evaluation.evaluate

# Backend: unit + integration tests (Jest + Supertest, ML service calls mocked)
cd backend && npm test                                   # 14 tests
```

## API overview

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/jobs` | Create a job posting |
| GET | `/api/jobs` | List job postings |
| GET | `/api/jobs/:id` | Get one job posting |
| DELETE | `/api/jobs/:id` | Delete a job posting |
| GET/POST | `/api/candidates` | List candidates / upload a resume (multipart) |
| DELETE | `/api/candidates/:id` | Delete a candidate |
| POST | `/api/jobs/:jobId/rank` | Score every candidate against this job, store + return ranked results |
| GET | `/api/jobs/:jobId/results` | Fetch the stored ranking |
| POST | `/api/jobs/:jobId/rescore/:candidateId` | Re-score a single candidate |

ML service (called by the backend, not the frontend directly):

| Method | Route | Purpose |
|---|---|---|
| POST | `/parse-resume` | Extract text + skills from an uploaded resume file |
| POST | `/score` | Compute the match score between resume text and a job description |

## Known limitations

- Skill extraction is keyword/taxonomy-based, not a trained NER model — it's fast, deterministic, and needs no training data, but it will miss skills phrased in ways the taxonomy doesn't cover. Extending it is a one-line addition to `skills_taxonomy.py`.
- No authentication — this is a single-tenant demo of the matching pipeline, not a multi-recruiter SaaS product.
- SQLite, not a client-server database — genuinely fine at this scale, but a real deployment serving concurrent recruiters would move to PostgreSQL (the schema is already normalized and would port directly).

## License

MIT — built as a portfolio project.
