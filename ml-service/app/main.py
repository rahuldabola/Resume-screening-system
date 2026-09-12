import hmac
import os
from dataclasses import asdict

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    ParseResumeResponse,
    ScoreBatchRequest,
    ScoreBatchResponse,
    ScoreRequest,
    ScoreResponse,
)
from app.resume_parser import UnsupportedFileTypeError, extract_text
from app.scoring import compute_match, compute_matches
from app.skills_taxonomy import extract_skills

app = FastAPI(
    title="Resume Screening ML Service",
    description="Resume parsing, skill extraction, and resume/job matching.",
    version="2.0.0",
)

# Only the Node backend is supposed to reach this service (the browser talks to
# the backend, never here). Defaults to the backend's dev origin rather than
# "*" so a stray public deployment isn't callable from any page on the web.
_allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:4000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def require_service_token(x_service_token: str | None = Header(default=None)) -> None:
    """Reject anyone who is not the backend.

    CORS is not a defence here: it is enforced by browsers, and this service is
    called server to server. When the two services can only reach each other
    over the public internet (the deployed topology), a shared secret is what
    actually keeps a stranger from spending this service's CPU on their own
    resumes.

    Unset SERVICE_TOKEN leaves the endpoints open, which is what docker-compose
    and the test suite want: there, the service is only reachable from inside
    the compose network or the test process.
    """
    expected = os.getenv("SERVICE_TOKEN", "")
    if not expected:
        return

    # Constant-time: a plain == leaks how much of the token is right via timing.
    if not x_service_token or not hmac.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing service token.")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/score", response_model=ScoreResponse, dependencies=[Depends(require_service_token)])
def score(payload: ScoreRequest):
    """Score one resume against one job.

    Prefer /score-batch when ranking several candidates: IDF is estimated from
    the documents the vectorizer is fit on, so a one-resume call is the
    degenerate two-document corpus described in app/scoring.py.
    """
    if not payload.resume_text.strip() or not payload.job_description.strip():
        raise HTTPException(status_code=400, detail="resume_text and job_description are both required.")

    return asdict(compute_match(payload.resume_text, payload.job_description))


@app.post("/score-batch", response_model=ScoreBatchResponse, dependencies=[Depends(require_service_token)])
def score_batch(payload: ScoreBatchRequest):
    """Score a pool of resumes against one job in a single pass.

    This is the endpoint the ranking flow uses: one round trip instead of one
    per candidate, and one TF-IDF fit across the whole pool so the similarity
    term is comparable between candidates.
    """
    if not payload.job_description.strip():
        raise HTTPException(status_code=400, detail="job_description is required.")
    if any(not resume.text.strip() for resume in payload.resumes):
        raise HTTPException(status_code=400, detail="Every resume must have non-empty text.")

    results = compute_matches([resume.text for resume in payload.resumes], payload.job_description)

    return ScoreBatchResponse(
        results=[
            {"id": resume.id, **asdict(result)}
            for resume, result in zip(payload.resumes, results)
        ]
    )


@app.post("/parse-resume", response_model=ParseResumeResponse, dependencies=[Depends(require_service_token)])
async def parse_resume(file: UploadFile = File(...)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        text = extract_text(file.filename or "resume.txt", content)
    except UnsupportedFileTypeError as err:
        raise HTTPException(status_code=400, detail=str(err))

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract any text from this file.")

    skills = sorted(extract_skills(text))
    return ParseResumeResponse(text=text, skills=skills, char_count=len(text))
