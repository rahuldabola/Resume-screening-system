import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_score_endpoint_returns_a_full_breakdown():
    res = client.post("/score", json={
        "resume_text": "Backend engineer experienced with Node.js, Express, and PostgreSQL.",
        "job_description": "Hiring a backend engineer skilled in Node.js, Express, and PostgreSQL.",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["skill_overlap_score"] == 100.0
    assert body["is_strong_match"] is True
    # "js" is a valid alias for the "javascript" skill and also appears
    # inside "node.js", so both skills are legitimately extracted here.
    assert set(body["matched_skills"]) == {"node.js", "express", "postgresql", "javascript"}
    assert body["missing_skills"] == []


def test_score_endpoint_rejects_empty_resume_text():
    res = client.post("/score", json={"resume_text": "", "job_description": "Something"})
    assert res.status_code == 400


def test_score_endpoint_rejects_empty_job_description():
    res = client.post("/score", json={"resume_text": "Something", "job_description": ""})
    assert res.status_code == 400


def test_score_endpoint_rejects_missing_fields():
    res = client.post("/score", json={"resume_text": "Something"})
    assert res.status_code == 422  # FastAPI/pydantic validation error


def test_parse_resume_endpoint_extracts_text_and_skills():
    file_content = b"Data scientist skilled in Python, pandas, and scikit-learn."
    res = client.post(
        "/parse-resume",
        files={"file": ("resume.txt", file_content, "text/plain")},
    )
    assert res.status_code == 200
    body = res.json()
    assert "Python" in body["text"]
    assert set(body["skills"]) >= {"python", "pandas", "scikit-learn"}
    assert body["char_count"] == len(file_content)


def test_parse_resume_endpoint_rejects_unsupported_file_type():
    res = client.post(
        "/parse-resume",
        files={"file": ("resume.exe", b"binary junk", "application/octet-stream")},
    )
    assert res.status_code == 400
    assert "Unsupported file type" in res.json()["detail"]


def test_parse_resume_endpoint_rejects_empty_file():
    res = client.post(
        "/parse-resume",
        files={"file": ("resume.txt", b"", "text/plain")},
    )
    assert res.status_code == 400


def test_parse_resume_endpoint_rejects_whitespace_only_file():
    res = client.post(
        "/parse-resume",
        files={"file": ("resume.txt", b"   \n\n   ", "text/plain")},
    )
    assert res.status_code == 422
