from pydantic import BaseModel, Field


class ScoreRequest(BaseModel):
    resume_text: str
    job_description: str


class ScoreResponse(BaseModel):
    match_score: float
    skill_overlap_score: float
    tfidf_similarity: float
    clears_domain_floor: bool
    keyword_coverage: float
    stuffing_factor: float
    matched_skills: list[str]
    missing_skills: list[str]
    resume_skills: list[str]
    required_skills: list[str]


class ResumeInput(BaseModel):
    """One candidate in a batch scoring request, tagged so the caller can
    match results back to its own candidate rows."""

    id: int
    text: str


class ScoreBatchRequest(BaseModel):
    resumes: list[ResumeInput] = Field(min_length=1)
    job_description: str


class ScoredResume(ScoreResponse):
    id: int


class ScoreBatchResponse(BaseModel):
    results: list[ScoredResume]


class ParseResumeResponse(BaseModel):
    text: str
    skills: list[str]
    char_count: int
