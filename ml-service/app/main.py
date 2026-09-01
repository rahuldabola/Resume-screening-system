from dataclasses import asdict

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.models import ParseResumeResponse, ScoreRequest, ScoreResponse
from app.resume_parser import UnsupportedFileTypeError, extract_text
from app.scoring import compute_match
from app.skills_taxonomy import extract_skills

app = FastAPI(
    title="Resume Screening ML Service",
    description="Resume parsing, skill extraction, and resume/job matching.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/score", response_model=ScoreResponse)
def score(payload: ScoreRequest):
    if not payload.resume_text.strip() or not payload.job_description.strip():
        raise HTTPException(status_code=400, detail="resume_text and job_description are both required.")

    result = compute_match(payload.resume_text, payload.job_description)
    return asdict(result)


@app.post("/parse-resume", response_model=ParseResumeResponse)
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
