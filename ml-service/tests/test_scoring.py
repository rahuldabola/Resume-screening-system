import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.scoring import compute_match, compute_tfidf_similarity  # noqa: E402
from app.skills_taxonomy import extract_skills  # noqa: E402


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
    assert result.is_strong_match is True


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


def test_compute_match_is_symmetric_on_skill_extraction_but_not_overlap_score():
    # skill_overlap_score is recall against the JOB's required skills, so
    # swapping resume/job is not expected to give the same overlap score
    # unless both texts request exactly the same skill set.
    resume = "Python and SQL."
    job = "Python, SQL, and Docker required."
    result = compute_match(resume, job)
    assert result.skill_overlap_score < 100.0
