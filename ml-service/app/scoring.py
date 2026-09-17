"""
Resume <-> job description matching.

Combines two independent signals into one match score:

1. Skill overlap -- of the skills a job posting asks for, what fraction does
   the candidate's resume actually mention? (recall against required skills)
2. TF-IDF cosine similarity -- how similar is the resume's overall language
   to the job description's, beyond just the fixed skills taxonomy? This
   catches relevant experience phrased in ways the taxonomy doesn't cover.

Two design points worth stating explicitly, because both are easy to get
subtly wrong:

**The vectorizer is fit over the whole candidate pool, not per pair.**
`TfidfVectorizer` estimates IDF from the documents it is fit on. Fitting it
on just `[resume, job]` gives a two-document corpus, where a term appearing
in both gets idf = ln(3/2)+1 = 1.405 and a term appearing in one gets
idf = 1.0 -- i.e. terms *shared* by the resume and the job are weighted
*below* terms unique to one of them, which is backwards for a similarity
measure. Fitting across the pool makes IDF mean what it should: "python" in
a pool where every resume says python carries little signal, while a rare
term that both this resume and the job use carries a lot. This is why
`compute_matches` (pool-aware) is the primary entry point and
`compute_match` is the thin single-pair wrapper.

**Scores are pool-relative.** A consequence of the above: the same
(resume, job) pair can score differently in a pool of 3 than in a pool of
50. That is correct for ranking candidates against one another, which is
what this system does, and it is why re-scoring one candidate still runs
the whole pool (see the backend's scoring service).
"""

from dataclasses import dataclass, field

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.skills_taxonomy import extract_skills, keyword_coverage

SKILL_OVERLAP_WEIGHT = 0.65
TFIDF_WEIGHT = 0.35

# The floor that separates "this candidate is at least in the right field"
# from "wrong field entirely". Chosen by sweeping thresholds against
# evaluation/eval_dataset.json -- see evaluation/evaluate.py.
#
# Note what this is *not*: it is not a quality bar. On the labelled set the
# two classes are separated by a wide empty band (wrong-field pairs cluster
# near 0, right-field pairs start around 25), so every threshold from ~3 to
# ~25 scores identically. It is a domain filter, and the UI bands candidates
# well above it (see frontend/src/components/ScoreBadge.tsx).
DOMAIN_FLOOR_THRESHOLD = 3.0

# Keyword-stuffing damping. `keyword_coverage` is the fraction of a document
# made of skill keywords. Measured over the labelled corpus, genuine resume
# and job prose runs 0.07-0.33; a document engineered to game a keyword
# matcher (a bare comma-separated skills dump) runs 0.85+. The ramp starts
# above anything real prose produces, so honest resumes are never touched.
STUFFING_COVERAGE_THRESHOLD = 0.40
STUFFING_FULL_PENALTY_AT = 0.80
STUFFING_MIN_FACTOR = 0.20


@dataclass
class MatchResult:
    match_score: float
    skill_overlap_score: float
    tfidf_similarity: float
    clears_domain_floor: bool
    keyword_coverage: float
    stuffing_factor: float
    matched_skills: list[str] = field(default_factory=list)
    missing_skills: list[str] = field(default_factory=list)
    resume_skills: list[str] = field(default_factory=list)
    required_skills: list[str] = field(default_factory=list)


def stuffing_factor(coverage: float) -> float:
    """Multiplier in [STUFFING_MIN_FACTOR, 1.0] damping keyword-stuffed text.

    1.0 for anything with the keyword density of real prose, ramping linearly
    down to the floor for a document that is nothing but keywords.
    """
    if coverage <= STUFFING_COVERAGE_THRESHOLD:
        return 1.0
    if coverage >= STUFFING_FULL_PENALTY_AT:
        return STUFFING_MIN_FACTOR

    span = STUFFING_FULL_PENALTY_AT - STUFFING_COVERAGE_THRESHOLD
    progress = (coverage - STUFFING_COVERAGE_THRESHOLD) / span
    return 1.0 - (1.0 - STUFFING_MIN_FACTOR) * progress


def _tfidf_similarities(resume_texts: list[str], job_description: str) -> list[float]:
    """Cosine similarity of each resume to the job, in [0, 1].

    The vectorizer is fit once across every resume plus the job description,
    so IDF is estimated over the whole pool rather than a two-document corpus.
    """
    if not job_description.strip():
        return [0.0] * len(resume_texts)

    corpus = [*resume_texts, job_description]
    vectorizer = TfidfVectorizer(stop_words="english", max_features=2000)
    try:
        matrix = vectorizer.fit_transform(corpus)
    except ValueError:
        # No vocabulary survives stop-word removal across the whole corpus.
        return [0.0] * len(resume_texts)

    job_vector = matrix[-1]
    similarities = cosine_similarity(matrix[:-1], job_vector).ravel()

    return [
        0.0 if not text.strip() else max(0.0, min(1.0, float(value)))
        for text, value in zip(resume_texts, similarities, strict=True)
    ]


def compute_tfidf_similarity(resume_text: str, job_description: str) -> float:
    """Single-pair TF-IDF cosine similarity, in [0, 1].

    Kept for the single-pair `/score` endpoint. Prefer `compute_matches` when
    scoring a pool: with one resume this is the degenerate two-document fit
    described in the module docstring.
    """
    if not resume_text.strip() or not job_description.strip():
        return 0.0
    return _tfidf_similarities([resume_text], job_description)[0]


def compute_matches(resume_texts: list[str], job_description: str) -> list[MatchResult]:
    """Score every resume in a pool against one job description."""
    if not resume_texts:
        return []

    required_skills = extract_skills(job_description)
    similarities = _tfidf_similarities(resume_texts, job_description)

    results = []
    for resume_text, tfidf_similarity in zip(resume_texts, similarities, strict=True):
        resume_skills = extract_skills(resume_text)
        matched = resume_skills & required_skills
        missing = required_skills - resume_skills

        skill_overlap = (len(matched) / len(required_skills)) if required_skills else 0.0
        coverage = keyword_coverage(resume_text)
        factor = stuffing_factor(coverage)

        raw_score = SKILL_OVERLAP_WEIGHT * skill_overlap + TFIDF_WEIGHT * tfidf_similarity
        match_score = raw_score * factor * 100

        results.append(
            MatchResult(
                match_score=round(match_score, 1),
                skill_overlap_score=round(skill_overlap * 100, 1),
                tfidf_similarity=round(tfidf_similarity * 100, 1),
                clears_domain_floor=match_score >= DOMAIN_FLOOR_THRESHOLD,
                keyword_coverage=round(coverage, 3),
                stuffing_factor=round(factor, 3),
                matched_skills=sorted(matched),
                missing_skills=sorted(missing),
                resume_skills=sorted(resume_skills),
                required_skills=sorted(required_skills),
            )
        )

    return results


def compute_match(resume_text: str, job_description: str) -> MatchResult:
    """Score a single resume against a job description."""
    return compute_matches([resume_text], job_description)[0]
