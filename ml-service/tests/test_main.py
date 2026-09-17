import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app

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
    assert body["clears_domain_floor"] is True
    # "js" no longer leaks out of "node.js", so JavaScript is not claimed here.
    assert set(body["matched_skills"]) == {"node.js", "express", "postgresql"}
    assert body["missing_skills"] == []
    assert body["stuffing_factor"] == 1.0


def test_score_endpoint_rejects_empty_resume_text():
    res = client.post("/score", json={"resume_text": "", "job_description": "Something"})
    assert res.status_code == 400


def test_score_endpoint_rejects_empty_job_description():
    res = client.post("/score", json={"resume_text": "Something", "job_description": ""})
    assert res.status_code == 400


def test_score_endpoint_rejects_missing_fields():
    res = client.post("/score", json={"resume_text": "Something"})
    assert res.status_code == 422  # FastAPI/pydantic validation error


def test_score_batch_returns_one_result_per_resume_tagged_by_id():
    res = client.post("/score-batch", json={
        "job_description": "Backend engineer skilled in Node.js, Express, PostgreSQL and Docker.",
        "resumes": [
            {"id": 7, "text": "Backend engineer using Node.js, Express, PostgreSQL and Docker daily."},
            {"id": 9, "text": "Graphic designer skilled in Adobe Photoshop, Illustrator and Figma."},
        ],
    })
    assert res.status_code == 200
    results = res.json()["results"]

    assert [r["id"] for r in results] == [7, 9]
    assert results[0]["match_score"] > results[1]["match_score"]
    assert results[0]["skill_overlap_score"] == 100.0
    assert results[1]["matched_skills"] == []


def test_score_batch_rejects_an_empty_pool():
    res = client.post("/score-batch", json={"job_description": "Backend engineer.", "resumes": []})
    assert res.status_code == 422  # pydantic min_length on the resumes list


def test_score_batch_rejects_a_blank_resume():
    res = client.post("/score-batch", json={
        "job_description": "Backend engineer.",
        "resumes": [{"id": 1, "text": "   "}],
    })
    assert res.status_code == 400


def test_score_batch_rejects_a_blank_job_description():
    res = client.post("/score-batch", json={
        "job_description": "   ",
        "resumes": [{"id": 1, "text": "Backend engineer."}],
    })
    assert res.status_code == 400


def test_score_batch_flags_a_keyword_stuffed_resume_below_a_real_one():
    """The whole point of the stuffing penalty: naming every skill must not
    beat a real resume that demonstrates them."""
    stuffed = " ".join([
        "python javascript typescript java golang sql react vue angular html css",
        "node.js express django flask fastapi graphql microservices docker",
        "kubernetes aws azure gcp redis postgresql mysql mongodb linux",
    ])
    genuine = (
        "Backend engineer with 6 years building REST APIs in Node.js and Express, "
        "backed by PostgreSQL and Redis. Containerized the platform with Docker and "
        "ran it on Kubernetes in AWS, owning the deployment pipeline end to end."
    )

    res = client.post("/score-batch", json={
        "job_description": (
            "Backend engineer to build Node.js and Express services on PostgreSQL "
            "and Redis, containerized with Docker and deployed to AWS."
        ),
        "resumes": [{"id": 1, "text": stuffed}, {"id": 2, "text": genuine}],
    })
    assert res.status_code == 200
    stuffed_result, genuine_result = res.json()["results"]

    assert stuffed_result["stuffing_factor"] < 1.0
    assert genuine_result["stuffing_factor"] == 1.0
    assert stuffed_result["match_score"] < genuine_result["match_score"]


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


def test_endpoints_are_open_when_no_service_token_is_configured():
    """Unset SERVICE_TOKEN is the docker-compose and local-dev case."""
    res = client.post("/score", json={
        "resume_text": "Python and scikit-learn experience.",
        "job_description": "Hiring a data scientist who knows Python.",
    })
    assert res.status_code == 200


def test_service_token_is_required_once_configured(monkeypatch):
    monkeypatch.setenv("SERVICE_TOKEN", "s3cret")

    res = client.post("/score", json={
        "resume_text": "Python and scikit-learn experience.",
        "job_description": "Hiring a data scientist who knows Python.",
    })
    assert res.status_code == 401
    assert "token" in res.json()["detail"].lower()


def test_a_wrong_service_token_is_rejected(monkeypatch):
    monkeypatch.setenv("SERVICE_TOKEN", "s3cret")

    res = client.post(
        "/score",
        headers={"X-Service-Token": "not-the-token"},
        json={
            "resume_text": "Python and scikit-learn experience.",
            "job_description": "Hiring a data scientist who knows Python.",
        },
    )
    assert res.status_code == 401


def test_the_right_service_token_is_accepted(monkeypatch):
    monkeypatch.setenv("SERVICE_TOKEN", "s3cret")

    res = client.post(
        "/score",
        headers={"X-Service-Token": "s3cret"},
        json={
            "resume_text": "Python and scikit-learn experience.",
            "job_description": "Hiring a data scientist who knows Python.",
        },
    )
    assert res.status_code == 200


def test_every_working_endpoint_is_guarded_not_just_score(monkeypatch):
    monkeypatch.setenv("SERVICE_TOKEN", "s3cret")

    batch = client.post("/score-batch", json={
        "resumes": [{"id": 1, "text": "Python engineer."}],
        "job_description": "Hiring a Python engineer.",
    })
    parse = client.post("/parse-resume", files={"file": ("resume.txt", b"Python engineer.", "text/plain")})

    assert batch.status_code == 401
    assert parse.status_code == 401


def test_health_stays_open_for_platform_probes(monkeypatch):
    """A platform healthcheck has no way to send the shared secret."""
    monkeypatch.setenv("SERVICE_TOKEN", "s3cret")

    assert client.get("/health").status_code == 200
