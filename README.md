# ScreenSmart — AI-Powered Resume Screening System

[![CI](https://github.com/rahuldabola/Resume-screening-system/actions/workflows/ci.yml/badge.svg)](https://github.com/rahuldabola/Resume-screening-system/actions/workflows/ci.yml)

**Live demo → [screensmart.vercel.app](https://screensmart.vercel.app)**

An end-to-end recruitment platform: post a job, upload resumes, and get candidates automatically ranked by how well they match — with a transparent score breakdown, not a black-box number.

**Stack:** React 19 + TypeScript · Node.js + Express + TypeScript · Python + FastAPI + scikit-learn · SQLite · Docker

## What it does

1. **Post a job** — title + description.
2. **Upload resumes** (PDF, DOCX, or TXT) — text is extracted and skills are identified automatically.
3. **Rank candidates** — every uploaded resume is scored against the job description and sorted best-first, with a visible breakdown of *why* each candidate scored the way they did (matched skills, missing skills, text similarity, and any keyword-stuffing penalty).

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

## The matching model

Match score is a weighted combination of two independent signals:

1. **Skill overlap (65%)** — of the skills the job description asks for, what fraction does the candidate's resume actually mention? Skills come from a curated ~50-skill taxonomy with alias matching (`ml-service/app/skills_taxonomy.py`).
2. **TF-IDF cosine similarity (35%)** — how similar is the resume's overall language to the job description's? This catches relevant experience the fixed taxonomy has no keyword for.

The result is then damped if the resume looks keyword-stuffed (see below).

### Extraction is built around avoiding false positives

Naive keyword matching gets a hiring shortlist wrong in two specific ways, and both are handled explicitly rather than waved at in a limitations section:

**Ambiguous aliases.** Several skill names are also ordinary English words. A plain word-boundary match reads this sales resume as a Go/Express/ML engineer:

> "I go above and beyond to express our value and drive go-to-market strategy. Managed 500 ml of reagent per assay."

An alias in `AMBIGUOUS_ALIASES` only counts when the surrounding 25 characters contain a technical cue, or an unambiguous *technical* skill. (Non-technical skills deliberately don't count as support — otherwise "sales" sitting next to "go" validates it.) A related structural fix: `\bjs\b` matches inside "node.js", so every alias carries a `(?<!\.)` guard against matching the tail of a dotted token.

**Negation.** "No professional Python experience" and "never used Docker" both contain the keyword while denying it. A negated-capability phrase suppresses the skill names it governs, stopping at the end of the clause — so "Never used Docker. Kubernetes in production for 3 years" still credits Kubernetes, and "Zero downtime deployments with Docker" is not read as a denial.

A clause ends at punctuation *or* at a contrast conjunction, because "No Python experience, but 8 years of Kubernetes" denies the first skill and claims the second. A comma alone is not a boundary — "no experience with Python, Django or Flask" denies all three — so it is the conjunction that is matched. Getting this wrong is the one error this module cannot see itself make: a dropped skill leaves nothing on screen to notice, unlike a false positive that shows up as a pill nobody claimed.

### Keyword stuffing is detected, not ignored

A resume that is nothing but a comma-separated list of every skill in the taxonomy has a perfect skill overlap and no evidence behind it. Measured over the labelled corpus, genuine resume and job prose has a keyword density of **0.07–0.33**; a bare skills dump runs **0.85+**. Scores are damped on a ramp that starts at 0.40 — above anything real prose produces — down to a floor of 20%. The penalty and the density are returned by the API and shown in the UI, so a recruiter can see *why* a keyword-perfect candidate ranks below a candidate who described actual work.

### Scores are pool-relative, deliberately

`TfidfVectorizer` estimates IDF from the documents it is fit on. Fitting it on just `[resume, job]` gives a two-document corpus where a term appearing in **both** gets idf = ln(3/2)+1 = 1.405 while a term appearing in one gets 1.0 — terms *shared* by the resume and the job are weighted *below* terms unique to one of them, which is backwards for a similarity measure. The vectorizer is therefore fit across the whole candidate pool plus the job (`POST /score-batch`), which is also why ranking is one round trip rather than one per candidate.

The consequence, stated plainly: the same pair can score differently in a pool of 3 than in a pool of 50. That is correct for ranking candidates against one another, and it is why re-scoring a single candidate still runs the whole pool.

## Evaluation — two questions, two answers

Both evaluations run in CI on every push, so the numbers below can't drift from what the code produces.

### 1. Is the candidate even in the right field?

```bash
cd ml-service && python -m evaluation.evaluate
```

45 hand-labeled (resume, job, is-a-match) pairs across 9 domains:

```
Pairs evaluated:     45
Best threshold:      3.0
Accuracy:            97.8%    Precision: 95.7%    Recall: 100.0%    F1: 97.8%
Confusion matrix:    TP=22 FN=0 FP=1 TN=22
```

**Read this number with the caveat the script prints underneath it.** Wrong-field pairs score 0.0–34.8 and right-field pairs score 21.3–83.2, and *every threshold from 3.0 to 21.0 gives the identical 97.8%*. A wide tie band means the classes barely overlap — this is an easy question, and 97.8% mostly says the model can tell a sales resume from a DevOps posting. It is a domain filter, not a quality bar.

There's a second caveat worth stating: the taxonomy's non-technical skills and this dataset's mismatch pairs were built alongside each other, so the number is not fully independent of the thing it measures.

### 2. Can it rank candidates who are all in the right field?

This is the question a recruiter actually has, and the harder one.

```bash
cd ml-service && python -m evaluation.evaluate_ranking
```

`ml-service/evaluation/ranking_dataset.json` holds 4 job postings × 6 same-field candidates, each graded 1–5 against a written rubric (exact stack + senior → right field in name only). Grades were assigned from the rubric before any model score was computed, and not adjusted afterwards.

```
Job postings:        4
Graded pairs:        24
Mean Spearman rho:   +0.91   (per job: +0.90, +0.93, +0.90, +0.90)
Mean NDCG@3:         0.95
Top-1 hit rate:      3/4
```

Spearman is the headline: +0.91 means the model's ordering closely tracks the human ordering, consistently across all four domains rather than on one lucky posting. The failure modes it does have are consistent and worth naming:

- **It cannot read seniority.** A junior data scientist who names the right tools (graded 2) ranks 3rd, above a senior ML engineer with an adjacent toolset (graded 3). Skill overlap counts mentions; it has no notion of depth or years.
- **It under-ranks adjacent stacks.** A senior Vue engineer (graded 3) lands 5th of 6 for a React posting, below a junior who happens to use React. Transferable skill is exactly what a keyword-and-TF-IDF model can't see.
- **The one top-1 miss** is a DevOps pool where the top three candidates land within 1.1 points of each other — the model is right that they're close and wrong about the order inside that cluster.

**What this number is not.** These resumes were written for this project, by the same author who knew how the scorer works. The grades were assigned blind to the model's output — but the resumes were not authored blind to the model's design, so this is **not an independent benchmark**, and +0.91 should be read as an upper bound rather than an expected production figure. It is strong enough to catch a regression and to characterize the failure modes above, which is what it is used for here. Re-running this evaluation against resumes the author did not write is the single highest-value improvement available to this project, and it is not done.

## Repo structure

```
frontend/          React + TypeScript + Tailwind SPA
  src/             components, pages and API layer, each with tests alongside
backend/           Node.js + Express + TypeScript REST API, SQLite persistence
  src/modules/     jobs, candidates, scoring — each with routes + service + tests
  src/db/          schema + in-place migrations, with tests against a legacy database
scripts/           smoke_test.py — end-to-end checks against a live deployment
ml-service/        Python + FastAPI — resume parsing, skill extraction, scoring
  evaluation/      both labeled datasets + the two scripts that produce the numbers above
  tests/           pytest unit tests for scoring, extraction, parsing, and the API
  pyproject.toml   ruff configuration
docker-compose.yml runs all three services together
.github/workflows/ CI: lint + typecheck + test every service, run both evaluations,
                   then build all Docker images
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

## Deployment

The live demo runs the same three services, split across two platforms:

```
screensmart.vercel.app          backend-production-36da        ml-service-production-7fb2
  Vercel (static build)  ──────▶  .up.railway.app        ──────▶  .up.railway.app
  VITE_API_URL baked in           Railway (Docker)                 Railway (Docker)
  at build time                   + 1GB volume for SQLite          X-Service-Token required
```

**Why the ML service is on a public URL and not Railway's private network.** Private
networking there is IPv6-only, so a service has to bind `::` to be reachable by a
sibling. Python's `asyncio` sets `IPV6_V6ONLY` on that socket, which hides the port
from Railway's port detection, and the deployment never leaves `DEPLOYING` — the
container is up and serving the whole time. Binding `0.0.0.0` and going over the
public edge is what actually works. That makes a stranger's `POST /score-batch` free
ML CPU, so the service requires a shared secret (`SERVICE_TOKEN`) on every working
endpoint; `/health` stays open because a platform probe has no way to send it. Leave
`SERVICE_TOKEN` unset locally and under Compose, where nothing outside the network
can reach the service anyway.

**Environment variables**

| Service | Variable | Deployed value | Why |
|---|---|---|---|
| backend | `ML_SERVICE_URL` | the ML service's public URL | who to score against |
| backend | `ML_SERVICE_TOKEN` | shared secret | sent as `X-Service-Token` |
| backend | `CLIENT_ORIGIN` | `https://screensmart.vercel.app,…` | CORS allowlist, comma-separated |
| backend | `DATABASE_PATH` | `/app/data/screening.db` | on the mounted volume, so a redeploy keeps the data |
| backend | `TRUST_PROXY` | `true` | rate-limit on the real client IP, not the proxy's |
| ml-service | `SERVICE_TOKEN` | shared secret | rejects everyone who isn't the backend |
| ml-service | `ALLOWED_ORIGINS` | the backend's URL | CORS, belt and braces |
| ml-service | `HOST` / `PORT` | `0.0.0.0` / `8000` | platform-assigned bind |
| frontend | `VITE_API_URL` | the backend's `/api` URL | baked in at build time, not read at runtime |

The Vercel project's Root Directory is `frontend`, and `.vercelignore` keeps the two
Railway services out of the upload. Both matter: with the root left at the repo root a
git-triggered build finds no `package.json`, installs nothing, and fails on `vite:
command not found`.

`VITE_API_URL` is a build-time substitution: changing the backend URL means rebuilding
the frontend, not restarting it.

**Reproducing it**

```bash
# Railway — one project, two services, each built from its own Dockerfile
railway init --name resume-screening
railway add -s ml-service && railway add -s backend      # then set each root directory
railway up -s ml-service
railway up -s backend

# Vercel — from the repo root. The project's Root Directory is set to
# "frontend", so a git push builds the same way this command does.
vercel link --project <name>
vercel env add VITE_API_URL production     # the backend's /api URL
vercel deploy --prod
```

Deployed state persists on the Railway volume mounted at `/app/data`. Rotating the
shared secret means setting `SERVICE_TOKEN` and `ML_SERVICE_TOKEN` to the same new
value and redeploying both services.

## Tests

**330 automated tests**, all run on every push via [CI](https://github.com/rahuldabola/Resume-screening-system/actions/workflows/ci.yml) — including a job that builds all three images with `docker compose build` on GitHub's runners, so the containerization claim is verified on real infrastructure rather than asserted.

```bash
# ML service: extraction, disambiguation, negation, scoring, stuffing, endpoints
cd ml-service && python -m ruff check . && python -m pytest tests/ -v   # 67 tests

# ML service: both evaluations
cd ml-service && python -m evaluation.evaluate
cd ml-service && python -m evaluation.evaluate_ranking

# Backend: unit + integration + schema migration (Jest + Supertest, ML calls mocked)
cd backend && npm test                                    # 92 tests

# Frontend: components, pages, API layer (Vitest + Testing Library, jsdom)
cd frontend && npm test                                   # 171 tests
cd frontend && npm run test:coverage                      # 93% of statements

# Frontend: lint, typecheck, production build
cd frontend && npm run lint && npx tsc -b && npm run build
```

The frontend tests are written against what someone using the app would see, so
they cover the things that are easy to break quietly: that an unreachable `GET`
is retried once and an unreachable `POST` is never retried, that ranking
collapses an open breakdown whose row ids no longer exist, that the score bands
agree at exactly 70 and 40, and that the `role="alert"` on errors, the live
region toasts land in, and the labelled file input behind the drag-and-drop zone
all stay where a screen reader can find them.

### Smoke test against a running deployment

The suites above mock the ML service and never leave the machine, so none of them
can catch a wrong environment variable, an expired service token, a CORS allowlist
that omits the frontend, or a container that is up but unreachable. This one talks
to the real deployment over the real network:

```bash
export ML_SERVICE_TOKEN=...            # same value the ML service runs with
python scripts/smoke_test.py           # 46 checks, ~20s
```

It checks the claims this README makes rather than only that endpoints answer: that
"go above and beyond to express our value" yields no Go and no Express, that "Never
used Docker. Kubernetes in production" credits Kubernetes and not Docker, that a
keyword dump is damped below a genuine resume that names fewer skills, and that the
same pair really does score differently in a pool of 2 than in a pool of 5. It
creates its own jobs and candidates and deletes them afterwards, touching nothing
it did not create. Point it elsewhere with `API_URL`, `ML_URL` and `CLIENT_ORIGIN`,
including at docker-compose on localhost.

The backend suite includes a migration test that opens a database written by the *previous* schema and asserts the current code migrates it in place — the schema is created with `CREATE TABLE IF NOT EXISTS`, which is a no-op against an existing database, so a rename has to be a real migration.

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
| POST | `/score-batch` | Score a pool of resumes against one job in one TF-IDF fit — what ranking uses |
| POST | `/score` | Single-pair score; convenient, but see the pool-relative note above |

Ranking writes are wrapped in a transaction: a failure partway through would otherwise leave some candidates scored against the current job description and the rest against whatever it said last time — a ranking that looks complete and isn't.

## Known limitations

- **No seniority or recency model.** The evaluation above shows exactly where this bites: a junior who names the right tools can outrank a senior with an adjacent stack. Extracting years-of-experience per skill is the obvious next step and is not implemented.
- **Skill extraction is taxonomy-based, not a trained NER model.** The disambiguation and negation handling above cut the false positives, but recall is still bounded by the taxonomy: a skill phrased in a way it doesn't cover is simply missed. Extending it is a one-line addition to `skills_taxonomy.py`.
- **Keyword-stuffing detection is a density heuristic.** It catches the bare-skills-dump attack cleanly. A more patient adversary who writes plausible prose around fabricated skills defeats it, and nothing here verifies that a claimed skill was ever used.
- **No user authentication.** This is a single-tenant demo of the matching pipeline, not a multi-recruiter SaaS: anyone with the URL sees the same jobs and candidates. The backend applies a per-IP rate limit (`backend/src/middleware/rateLimiter.ts`, 300 req/15min, skipped in tests) as a cheap guard against one client burning ML-service CPU — that's abuse mitigation, not access control. The ML service *is* authenticated, because deployed it sits on a public URL: it rejects any request without the shared `SERVICE_TOKEN` the backend sends (see Deployment).
- **SQLite, not a client-server database.** Genuinely fine at this scale; a deployment serving concurrent recruiters would move to PostgreSQL (the schema is already normalized and would port directly).
- **Both evaluation sets are small and author-written.** 45 classification pairs and 24 graded ranking pairs, written for this project by the same author who wrote the scorer. Enough to catch a regression and to characterize the failure modes; not enough to claim a production accuracy figure.

## What I would do next

Named because they are the honest gaps, not because they are polish. Neither is implemented.

1. **Evaluate against resumes I did not write.** 40–60 resumes from a public dataset or anonymized real ones, graded by someone other than the model's author. This is what converts +0.91 from suggestive into evidence, and it is the highest-value change available.
2. **Add sentence embeddings as a third signal.** A `sentence-transformers` encoder scoring resume/job semantic similarity alongside skill overlap and TF-IDF, aimed squarely at the "under-ranks adjacent stacks" failure the ranking evaluation already documents. The benchmark is in place to show whether it actually beats TF-IDF — including if it doesn't.

## License

MIT — built as a portfolio project.
