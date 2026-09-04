import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.scoring import (  # noqa: E402
    STUFFING_MIN_FACTOR,
    compute_match,
    compute_matches,
    compute_tfidf_similarity,
    stuffing_factor,
)
from app.skills_taxonomy import extract_skills, keyword_coverage  # noqa: E402


def test_extract_skills_finds_known_aliases():
    text = "Built REST APIs with Node.js and Express, deployed via Docker on AWS."
    skills = extract_skills(text)
    assert "node.js" in skills
    assert "express" in skills
    assert "docker" in skills
    assert "aws" in skills
    assert "rest api" in skills


def test_extract_skills_ignores_unrelated_text():
    text = "Enjoys hiking, painting, and playing the guitar on weekends."
    assert extract_skills(text) == set()


def test_tfidf_similarity_identical_text_is_high():
    text = "Backend engineer experienced with Node.js, Express, and PostgreSQL."
    similarity = compute_tfidf_similarity(text, text)
    assert similarity > 0.99


def test_tfidf_similarity_unrelated_text_is_low():
    resume = "Backend engineer experienced with Node.js, Express, and PostgreSQL."
    job = "Graphic designer skilled in Adobe Photoshop, Illustrator, and Figma."
    similarity = compute_tfidf_similarity(resume, job)
    assert similarity < 0.3


def test_tfidf_similarity_handles_empty_text():
    assert compute_tfidf_similarity("", "something") == 0.0
    assert compute_tfidf_similarity("something", "") == 0.0
    assert compute_tfidf_similarity("", "") == 0.0


def test_compute_match_perfect_skill_overlap():
    resume = "Experienced with Python, scikit-learn, pandas, and SQL for data analysis."
    job = "Looking for a data scientist skilled in Python, scikit-learn, pandas, and SQL."
    result = compute_match(resume, job)

    assert result.missing_skills == []
    assert result.skill_overlap_score == 100.0
    assert result.match_score > 0
    assert result.clears_domain_floor is True


def test_compute_match_no_skill_overlap():
    resume = "Sales representative with a strong record of quota attainment and CRM pipeline management."
    job = "Hiring a DevOps engineer skilled in Docker, Kubernetes, AWS, and CI/CD."
    result = compute_match(resume, job)

    assert result.matched_skills == []
    assert result.skill_overlap_score == 0.0
    assert set(result.missing_skills) == {"docker", "kubernetes", "aws", "ci/cd"}


def test_compute_match_score_bounded_between_0_and_100():
    resume = "Python developer with machine learning and SQL experience."
    job = "Hiring a Python machine learning engineer with strong SQL skills."
    result = compute_match(resume, job)

    assert 0.0 <= result.match_score <= 100.0
    assert 0.0 <= result.skill_overlap_score <= 100.0
    assert 0.0 <= result.tfidf_similarity <= 100.0


def test_skill_overlap_is_recall_against_the_jobs_requirements():
    # skill_overlap_score is recall against the JOB's required skills, so
    # swapping resume/job is not expected to give the same overlap score
    # unless both texts request exactly the same skill set.
    result = compute_match("Python and SQL.", "Python, SQL, and Docker required.")
    assert result.skill_overlap_score < 100.0


# ---- pool-aware scoring -------------------------------------------------


def test_compute_matches_returns_one_result_per_resume_in_order():
    job = "Backend engineer skilled in Node.js, Express and PostgreSQL."
    resumes = [
        "Node.js and Express developer working against PostgreSQL.",
        "Graphic designer using Adobe Photoshop and Figma.",
        "Backend engineer building Express services on PostgreSQL.",
    ]
    results = compute_matches(resumes, job)

    assert len(results) == 3
    assert results[0].match_score > results[1].match_score
    assert results[2].match_score > results[1].match_score


def test_compute_matches_handles_an_empty_pool():
    assert compute_matches([], "Backend engineer.") == []


def test_compute_matches_idf_is_estimated_across_the_pool():
    """A term every candidate shares carries less weight than a distinctive one.

    This is the whole reason the vectorizer is fit over the pool rather than
    per pair: with a two-document fit, IDF cannot distinguish a term common to
    the entire field from one that actually sets a candidate apart.
    """
    job = "Backend engineer working with Kubernetes and PostgreSQL."
    shared_boilerplate = "Backend engineer. " * 3

    pool = [
        shared_boilerplate + "Kubernetes and PostgreSQL in production.",
        shared_boilerplate + "Mostly spreadsheets and email.",
    ]
    distinctive, generic = compute_matches(pool, job)

    assert distinctive.tfidf_similarity > generic.tfidf_similarity


def test_pool_scoring_is_consistent_for_the_same_pool():
    job = "Backend engineer skilled in Node.js and PostgreSQL."
    pool = ["Node.js and PostgreSQL engineer.", "Django and PostgreSQL engineer."]
    assert [r.match_score for r in compute_matches(pool, job)] == [
        r.match_score for r in compute_matches(pool, job)
    ]


# ---- keyword-stuffing damping -------------------------------------------


def test_stuffing_factor_leaves_normal_prose_alone():
    assert stuffing_factor(0.0) == 1.0
    assert stuffing_factor(0.33) == 1.0


def test_stuffing_factor_ramps_down_and_clamps_at_the_floor():
    mild = stuffing_factor(0.5)
    severe = stuffing_factor(0.7)

    assert STUFFING_MIN_FACTOR < severe < mild < 1.0
    assert stuffing_factor(0.95) == STUFFING_MIN_FACTOR
    assert stuffing_factor(1.0) == STUFFING_MIN_FACTOR


def test_genuine_resume_prose_is_never_treated_as_stuffing():
    genuine = (
        "Backend engineer with 6 years building REST APIs in Node.js and Express, "
        "backed by PostgreSQL and Redis. Containerized the platform with Docker and "
        "ran it on Kubernetes in AWS."
    )
    assert keyword_coverage(genuine) < 0.4
    assert compute_match(genuine, "Node.js engineer.").stuffing_factor == 1.0


def test_keyword_stuffed_resume_is_damped_below_a_genuine_one():
    job = "Backend engineer building Node.js and Express services on PostgreSQL, deployed with Docker to AWS."
    stuffed = (
        "python javascript typescript java golang sql react vue angular html css "
        "node.js express django flask fastapi graphql microservices docker "
        "kubernetes aws azure gcp redis postgresql mysql mongodb linux"
    )
    genuine = (
        "Backend engineer with 6 years building REST APIs in Node.js and Express, "
        "backed by PostgreSQL. Containerized services with Docker and deployed to AWS."
    )

    stuffed_result, genuine_result = compute_matches([stuffed, genuine], job)

    # The stuffed resume genuinely contains every required skill...
    assert stuffed_result.skill_overlap_score == 100.0
    # ...but claiming skills without evidence must not outrank demonstrating them.
    assert stuffed_result.stuffing_factor < 1.0
    assert stuffed_result.match_score < genuine_result.match_score
