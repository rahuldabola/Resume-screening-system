from pydantic import BaseModel


class ScoreRequest(BaseModel):
    resume_text: str
    job_description: str


class ScoreResponse(BaseModel):
    match_score: float
    skill_overlap_score: float
    tfidf_similarity: float
    is_strong_match: bool
    matched_skills: list[str]
    missing_skills: list[str]
    resume_skills: list[str]
    required_skills: list[str]


class ParseResumeResponse(BaseModel):
    text: str
    skills: list[str]
    char_count: int
