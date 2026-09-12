"""End-to-end smoke test against a running deployment.

The unit suites mock the ML service and never leave the machine, so nothing in
them can catch a wrong environment variable, an expired service token, a CORS
allowlist that does not include the frontend, or a container that is up but
unreachable. This talks to the real thing over the real network.

It checks behaviour the README makes claims about — the alias and negation
false positives, the stuffing penalty, pool-relative scoring — rather than only
that endpoints answer.

    export ML_SERVICE_TOKEN=...        # same value as the ML service's SERVICE_TOKEN
    python scripts/smoke_test.py

Override API_URL, ML_URL and CLIENT_ORIGIN to point it at a different
deployment, or at docker-compose on localhost.

It creates its own job postings and candidates and deletes them at the end,
touching nothing it did not create. Needs httpx, and reportlab for the PDF
case; both are already in ml-service/requirements.txt.
"""
import io
import json
import os
import sys
import time

import httpx

API = os.getenv("API_URL", "https://backend-production-36da.up.railway.app/api")
ML = os.getenv("ML_URL", "https://ml-service-production-7fb2.up.railway.app")
TOKEN = os.getenv("ML_SERVICE_TOKEN", "")
ORIGIN = os.getenv("CLIENT_ORIGIN", "https://screensmart.vercel.app")

if not TOKEN:
    sys.exit(
        "ML_SERVICE_TOKEN is not set. It has to match the SERVICE_TOKEN the ML "
        "service runs with, or every direct ML call here is answered with a 401."
    )

client = httpx.Client(timeout=90.0)

passed, failed = 0, 0
created_jobs, created_candidates = [], []


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}")
        if detail:
            print(f"        {detail}")


def section(title):
    print(f"\n{title}\n" + "-" * len(title))


def upload(name, text, filename=None, email=None, content=None):
    files = {"resume": (filename or f"{name}.txt", content or text.encode(), "text/plain")}
    data = {"name": name}
    if email:
        data["email"] = email
    res = client.post(f"{API}/candidates", data=data, files=files)
    if res.status_code == 201:
        created_candidates.append(res.json()["id"])
    return res


def skills_of(res):
    return set(json.loads(res.json()["extracted_skills"]))


# ---------------------------------------------------------------- infrastructure
section("1. Infrastructure and access control")

t0 = time.time()
r = client.get(f"{API}/health")
check("backend /api/health returns ok", r.status_code == 200 and r.json() == {"status": "ok"}, r.text[:120])

r = client.get(f"{ML}/health")
check("ML service /health is open to platform probes", r.status_code == 200, r.text[:120])

r = client.post(f"{ML}/score", json={"resume_text": "python", "job_description": "python"})
check("ML /score refuses a request with no service token (401)", r.status_code == 401, f"got {r.status_code}")

r = client.post(
    f"{ML}/score",
    headers={"X-Service-Token": "wrong-token"},
    json={"resume_text": "python", "job_description": "python"},
)
check("ML /score refuses a wrong service token (401)", r.status_code == 401, f"got {r.status_code}")

r = client.post(
    f"{ML}/score",
    headers={"X-Service-Token": TOKEN},
    json={"resume_text": "Python and scikit-learn engineer.", "job_description": "Hiring a Python engineer."},
)
check("ML /score accepts the real service token", r.status_code == 200, f"got {r.status_code}")

r = client.get(f"{API}/jobs", headers={"Origin": ORIGIN})
check("CORS allows the deployed frontend origin",
      r.headers.get("access-control-allow-origin") == ORIGIN,
      f"got {r.headers.get('access-control-allow-origin')!r}")

r = client.get(f"{API}/jobs", headers={"Origin": "https://evil.example"})
check("CORS does not allow an unlisted origin",
      "access-control-allow-origin" not in r.headers,
      f"got {r.headers.get('access-control-allow-origin')!r}")

check("per-IP rate limit is advertised in response headers",
      r.headers.get("ratelimit-limit") == "300",
      f"got {r.headers.get('ratelimit-limit')!r}")

# ---------------------------------------------------------------- validation
section("2. Input validation and error codes")

r = client.post(f"{API}/jobs", json={"title": "A", "description": "too short"})
check("rejects a job with a 1-character title (400)", r.status_code == 400, f"got {r.status_code}")

r = client.post(f"{API}/jobs", json={"title": "Backend Engineer", "description": "short"})
check("rejects a job with a too-short description (400)", r.status_code == 400, f"got {r.status_code}")

r = client.get(f"{API}/jobs/not-a-number")
check("rejects a non-numeric id with 400, not a silent 404",
      r.status_code == 400 and "positive integer" in r.text, f"got {r.status_code} {r.text[:80]}")

r = client.delete(f"{API}/candidates/-5")
check("rejects a negative id (400)", r.status_code == 400, f"got {r.status_code}")

r = client.get(f"{API}/jobs/999999")
check("returns 404 for a job that does not exist", r.status_code == 404, f"got {r.status_code}")

r = client.post(f"{API}/candidates", data={"name": "No File"})
check("rejects a candidate upload with no file (400)", r.status_code == 400, f"got {r.status_code}")

r = upload("Bad Email", "Some resume text about Python.", email="not-an-email")
check("rejects an invalid email (400)", r.status_code == 400, f"got {r.status_code}")

r = upload("Bad Type", "", filename="resume.exe", content=b"MZ\x90\x00binary junk")
check("rejects an unsupported file type, surfacing the ML reason (502)",
      r.status_code == 502 and "Unsupported file type" in r.text, f"got {r.status_code} {r.text[:100]}")

# ---------------------------------------------------------------- extraction
section("3. Skill extraction: the false positives the README claims to avoid")

sales = upload(
    "Alias Trap",
    "I go above and beyond to express our value and drive go-to-market strategy. "
    "Managed 500 ml of reagent per assay and ran the sales pipeline for the region.",
)
found = skills_of(sales) if sales.status_code == 201 else set()
check("'go above and beyond' does not become the Go language", "go" not in found, f"extracted {sorted(found)}")
check("'express our value' does not become Express", "express" not in found, f"extracted {sorted(found)}")
check("'500 ml of reagent' does not become machine learning",
      "machine learning" not in found, f"extracted {sorted(found)}")

neg = upload(
    "Negation Case",
    "Never used Docker. Kubernetes in production for three years, running a "
    "large cluster with Terraform and Prometheus.",
)
found = skills_of(neg) if neg.status_code == 201 else set()
check("'Never used Docker' suppresses Docker", "docker" not in found, f"extracted {sorted(found)}")
check("the negation stops at the clause, so Kubernetes still counts",
      "kubernetes" in found, f"extracted {sorted(found)}")

pos = upload("Not A Denial", "Zero downtime deployments with Docker and automated rollbacks.")
found = skills_of(pos) if pos.status_code == 201 else set()
check("'Zero downtime ... with Docker' is not read as a denial", "docker" in found, f"extracted {sorted(found)}")

dotted = upload("Dotted Token", "Backend services in Node.js with Express and PostgreSQL.")
found = skills_of(dotted) if dotted.status_code == 201 else set()
check("'node.js' does not leak a bare 'js' into JavaScript",
      "node.js" in found and "javascript" not in found, f"extracted {sorted(found)}")

# ---------------------------------------------------------------- ranking
section("4. Ranking, stuffing penalty, and persistence")

job = client.post(f"{API}/jobs", json={
    "title": "TEST Senior Platform Engineer",
    "description": "Platform engineer to run Kubernetes clusters on AWS, build CI/CD "
                   "pipelines with Terraform, and operate Docker workloads in production. "
                   "Prometheus monitoring and Linux administration required.",
})
check("creates a job posting (201)", job.status_code == 201, f"got {job.status_code}")
job_id = job.json()["id"] if job.status_code == 201 else None
if job_id:
    created_jobs.append(job_id)

empty_job = client.post(f"{API}/jobs", json={
    "title": "TEST Empty Pool",
    "description": "A posting with no candidates uploaded against it at all, used to check the empty case.",
})
if empty_job.status_code == 201:
    created_jobs.append(empty_job.json()["id"])

senior = upload(
    "TEST Senior Platform",
    "Seven years running production Kubernetes clusters on AWS for a fintech. Built the "
    "CI/CD pipelines in Terraform that the platform team deploys through, containerized "
    "forty services with Docker, and owns Prometheus monitoring and alerting across "
    "Linux fleets. Led two migrations with zero customer-visible downtime.",
)
junior = upload(
    "TEST Junior Platform",
    "Two years as a junior engineer. Wrote Dockerfiles for internal tools and helped "
    "maintain a small Kubernetes cluster. Comfortable on Linux and learning Terraform.",
)
stuffed = upload(
    "TEST Stuffed",
    "kubernetes, aws, terraform, docker, prometheus, linux, ci/cd, python, java, go, "
    "javascript, typescript, react, vue, angular, django, flask, postgresql, mysql, "
    "mongodb, redis, gcp, azure, jenkins, git, rest, graphql, machine learning",
)
offfield = upload(
    "TEST Off Field",
    "Eight years designing brand identities and packaging for consumer goods clients. "
    "Expert in Adobe Illustrator, Photoshop and InDesign, running client workshops and "
    "presenting concepts to executives.",
)
check("uploads four test resumes",
      all(r.status_code == 201 for r in (senior, junior, stuffed, offfield)),
      f"statuses {[r.status_code for r in (senior, junior, stuffed, offfield)]}")

pdf_ok = False
try:
    from reportlab.pdfgen import canvas as pdf_canvas

    buf = io.BytesIO()
    pdf = pdf_canvas.Canvas(buf)
    pdf.drawString(72, 720, "Platform engineer with Kubernetes, Docker and Terraform experience.")
    pdf.drawString(72, 700, "Ran AWS infrastructure and Prometheus monitoring for four years.")
    pdf.save()
    r = upload("TEST Pdf Resume", "", filename="resume.pdf", content=buf.getvalue())
    pdf_ok = r.status_code == 201 and "kubernetes" in skills_of(r)
    check("extracts text and skills from a real PDF", pdf_ok,
          f"got {r.status_code} {r.text[:100]}")
except ImportError:
    print("  SKIP  PDF upload (reportlab not installed)")

if job_id:
    t = time.time()
    ranked = client.post(f"{API}/jobs/{job_id}/rank")
    rank_ms = (time.time() - t) * 1000
    check("ranks the whole pool in one request (200)", ranked.status_code == 200, ranked.text[:120])

    if ranked.status_code == 200:
        rows = ranked.json()
        by_name = {row["candidate_name"]: row for row in rows}
        order = [row["candidate_name"] for row in rows]

        print(f"\n  Ranking returned in {rank_ms:.0f} ms:")
        for i, row in enumerate(rows, 1):
            flag = "  [stuffing x%.2f]" % row["stuffing_factor"] if row["stuffing_factor"] < 1 else ""
            print(f"    {i}. {row['candidate_name']:<24} {row['match_score']:>5}%"
                  f"  skills={row['skill_overlap_score']:>5}  tfidf={row['tfidf_similarity']:>5}{flag}")
        print()

        check("scores are sorted best-first",
              all(rows[i]["match_score"] >= rows[i + 1]["match_score"] for i in range(len(rows) - 1)),
              str(order))
        check("the senior platform engineer outranks the junior",
              order.index("TEST Senior Platform") < order.index("TEST Junior Platform"), str(order))
        # Not "ranks last": several unrelated resumes legitimately tie at 0,
        # so the real claim is that it shares none of the job's skills and
        # sits below everyone who does.
        designer = by_name["TEST Off Field"]
        best_unrelated = max(r["match_score"] for r in rows if r["skill_overlap_score"] == 0)
        check("the off-field designer matches none of the required skills",
              designer["skill_overlap_score"] == 0, f"overlap={designer['skill_overlap_score']}")
        check("it scores below every candidate who shares a skill with the job",
              designer["match_score"] < min(r["match_score"] for r in rows if r["skill_overlap_score"] > 0),
              f"designer={designer['match_score']}, best unrelated={best_unrelated}")

        s = by_name.get("TEST Stuffed")
        if s:
            check("the keyword dump is flagged as stuffed (factor < 1)",
                  s["stuffing_factor"] < 1, f"factor={s['stuffing_factor']}")
            check("its measured keyword density is above anything real prose produces",
                  s["keyword_coverage"] > 0.40, f"density={s['keyword_coverage']}")
            check("it ranks below the senior despite naming every required skill",
                  order.index("TEST Stuffed") > order.index("TEST Senior Platform"),
                  f"stuffed skills={s['skill_overlap_score']} vs "
                  f"senior={by_name['TEST Senior Platform']['skill_overlap_score']}")

        genuine = by_name.get("TEST Senior Platform")
        if genuine:
            check("a genuine resume is not penalised (factor == 1)",
                  genuine["stuffing_factor"] == 1, f"factor={genuine['stuffing_factor']}")
            matched = json.loads(genuine["matched_skills"])
            check("the score breakdown names the matched skills",
                  len(matched) >= 5, f"matched {matched}")

        stored = client.get(f"{API}/jobs/{job_id}/results")
        check("the ranking is persisted and readable afterwards",
              stored.status_code == 200 and len(stored.json()) == len(rows),
              f"got {stored.status_code} with {len(stored.json()) if stored.status_code == 200 else '?'} rows")

        cand_id = by_name["TEST Senior Platform"]["candidate_id"]
        re_scored = client.post(f"{API}/jobs/{job_id}/rescore/{cand_id}")
        check("re-scoring one candidate still returns the whole pool",
              re_scored.status_code == 200 and len(re_scored.json()) == len(rows),
              f"got {re_scored.status_code}")

# The candidate pool is global, not per-job: ranking any job scores every
# resume ever uploaded. The 400 guard fires only when nothing is uploaded at
# all, which is not reachable while the demo pool exists.
if len(created_jobs) > 1:
    pool_size = len(client.get(f"{API}/candidates").json())
    r = client.post(f"{API}/jobs/{created_jobs[1]}/rank")
    check("a second job scores the same shared candidate pool",
          r.status_code == 200 and len(r.json()) == pool_size,
          f"got {r.status_code} with {len(r.json()) if r.status_code == 200 else '?'} of {pool_size}")

# ---------------------------------------------------------------- pool-relative
section("5. The pool-relative scoring the README warns about")

resume = "Kubernetes and Terraform on AWS, Docker in production, Prometheus monitoring."
job_text = ("Platform engineer to run Kubernetes clusters on AWS, build CI/CD pipelines "
            "with Terraform, and operate Docker workloads in production.")
noise = ["Graphic designer skilled in Illustrator and Photoshop.",
         "Registered nurse with critical care experience.",
         "Sales manager running a regional pipeline.",
         "Copywriter for consumer brands."]

def batch(resumes):
    r = client.post(
        f"{ML}/score-batch",
        headers={"X-Service-Token": TOKEN},
        json={"resumes": [{"id": i, "text": t} for i, t in enumerate(resumes)], "job_description": job_text},
    )
    return r.json()["results"][0]["match_score"] if r.status_code == 200 else None

small = batch([resume, noise[0]])
large = batch([resume] + noise)
check("the same pair scores differently in a pool of 2 vs a pool of 5",
      small is not None and large is not None and small != large,
      f"pool of 2 = {small}, pool of 5 = {large}")
print(f"        pool of 2: {small}    pool of 5: {large}   (documented, not a bug)")

# ---------------------------------------------------------------- cleanup
section("6. Cleanup: delete everything this run created")

deleted = 0
for cid in created_candidates:
    if client.delete(f"{API}/candidates/{cid}").status_code == 204:
        deleted += 1
check(f"deletes the {len(created_candidates)} test candidates",
      deleted == len(created_candidates), f"deleted {deleted}")

deleted_jobs = 0
for jid in created_jobs:
    if client.delete(f"{API}/jobs/{jid}").status_code == 204:
        deleted_jobs += 1
check(f"deletes the {len(created_jobs)} test jobs", deleted_jobs == len(created_jobs), f"deleted {deleted_jobs}")

if created_jobs:
    check("a deleted job is really gone (404)",
          client.get(f"{API}/jobs/{created_jobs[0]}").status_code == 404)

remaining = client.get(f"{API}/candidates").json()
remaining_jobs = client.get(f"{API}/jobs").json()
check("the demo pool is left as it was found",
      not any(c["name"].startswith("TEST") or c["name"] in ("Alias Trap", "Negation Case", "Not A Denial", "Dotted Token")
              for c in remaining),
      f"leftovers: {[c['name'] for c in remaining]}")

print(f"\n{'=' * 60}")
print(f"  {passed} passed, {failed} failed, in {time.time() - t0:.1f}s against production")
print(f"  demo pool intact: {len(remaining_jobs)} job, {len(remaining)} candidates")
print(f"{'=' * 60}")
sys.exit(1 if failed else 0)
