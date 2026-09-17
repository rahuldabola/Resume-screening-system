"""Tests for the two false-positive classes the extractor guards against:
ambiguous aliases that are also ordinary English, and negated claims.

Every case here is a sentence a real resume could plausibly contain.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.skills_taxonomy import (
    extract_skills,
    find_skill_mentions,
    keyword_coverage,
)

# ---- ambiguous aliases ---------------------------------------------------


def test_ordinary_english_does_not_become_a_tech_stack():
    text = (
        "Sales leader. I go above and beyond to express our value and drive "
        "go-to-market strategy. Managed 500 ml of reagent per assay."
    )
    skills = extract_skills(text)

    assert "go" not in skills          # "go above and beyond", "go-to-market"
    assert "express" not in skills     # "express our value"
    assert "machine learning" not in skills  # "500 ml"
    assert skills == {"sales"}


def test_ambiguous_alias_is_accepted_next_to_a_technical_cue():
    assert "go" in extract_skills("Backend developer writing Go and Python services.")
    assert "express" in extract_skills("Built the API using Express and Node.js.")
    assert "machine learning" in extract_skills("Deployed ML models to production.")


def test_ambiguous_alias_is_accepted_in_a_terse_skills_list():
    skills = extract_skills("Skills: Go, Node, Express, TypeScript, PostgreSQL")
    assert {"go", "node.js", "express", "typescript", "postgresql"} <= skills


def test_a_non_technical_skill_nearby_does_not_validate_an_ambiguous_alias():
    """"sales" is a real skill but says nothing about whether "go" is a language."""
    assert "go" not in extract_skills("Sales director. I go the extra mile for clients.")


def test_alias_does_not_match_the_tail_of_a_dotted_token():
    """`\\bjs\\b` fires inside "node.js" without the dotted-token guard."""
    assert "javascript" not in extract_skills("Backend services written in Node.js.")
    assert "javascript" not in extract_skills("Built dashboards with Next.js and Vue.js.")
    # ...but a real mention still resolves.
    assert "javascript" in extract_skills("Comfortable writing plain JS in the browser.")


# ---- negation ------------------------------------------------------------


def test_denied_skills_are_not_extracted():
    text = "I have no professional Python experience and have never used Docker."
    assert extract_skills(text) == set()


def test_negation_stops_at_the_end_of_the_clause():
    text = "Never used Docker. Kubernetes in production for three years."
    skills = extract_skills(text)

    assert "docker" not in skills
    assert "kubernetes" in skills


def test_negation_does_not_swallow_unrelated_phrasing():
    """"Zero downtime deployments" is not a denial of Docker."""
    skills = extract_skills("Zero downtime deployments with Docker and Kubernetes.")
    assert {"docker", "kubernetes"} <= skills


def test_a_skill_claimed_before_a_later_denial_still_counts():
    text = "Docker in production since 2019. No formal accounting background."
    assert "docker" in extract_skills(text)


def test_a_contrast_conjunction_ends_the_denial():
    """"No X, but Y" claims Y.

    A comma is not a clause break, so without the conjunction as a boundary the
    negation's reach ran straight through the contrast and dropped skills the
    candidate does have. That is a false negative, which -- unlike the false
    positives this module is built around -- leaves no trace on screen.
    """
    text = "No Python experience, but 8 years of Kubernetes and Docker in production."
    skills = extract_skills(text)

    assert "python" not in skills
    assert {"docker", "kubernetes"} <= skills


def test_contrast_after_a_denial_without_a_comma():
    skills = extract_skills("Never used Docker but Kubernetes daily.")

    assert "docker" not in skills
    assert "kubernetes" in skills


@pytest.mark.parametrize(
    "conjunction",
    ["but", "although", "though", "however", "whereas", "aside from", "apart from", "other than"],
)
def test_every_contrast_conjunction_ends_the_denial(conjunction):
    text = f"No backend experience {conjunction} Flask in production."
    assert "flask" in extract_skills(text)


def test_a_bare_comma_does_not_end_the_denial():
    """The conjunction is the boundary, not the comma that usually precedes it.

    A comma-separated list after one negation denies every item in it, so
    breaking on the comma itself would credit Django and Flask here.
    """
    assert extract_skills("No experience with Python, Django or Flask.") == set()


# ---- mentions and coverage ----------------------------------------------


def test_find_skill_mentions_reports_positions_in_order():
    mentions = find_skill_mentions("Python first, then Docker.")
    assert [m.skill for m in mentions] == ["python", "docker"]
    assert mentions[0].start < mentions[1].start
    assert all(m.end > m.start for m in mentions)


def test_keyword_coverage_separates_prose_from_a_keyword_dump():
    prose = (
        "Backend engineer with 6 years building REST APIs in Node.js and Express, "
        "backed by PostgreSQL and Redis. Containerized the platform with Docker."
    )
    dump = "python java golang sql react docker kubernetes aws azure postgresql redis"

    assert keyword_coverage(prose) < 0.4
    assert keyword_coverage(dump) > 0.8


def test_keyword_coverage_of_empty_text_is_zero():
    assert keyword_coverage("") == 0.0
    assert keyword_coverage("    \n  ") == 0.0


def test_keyword_coverage_does_not_double_count_overlapping_aliases():
    """"node.js" matches both the "node.js" and "node" aliases; the overlapping
    spans must be merged, not summed, or coverage can exceed the real text."""
    assert keyword_coverage("node.js") <= 1.0
