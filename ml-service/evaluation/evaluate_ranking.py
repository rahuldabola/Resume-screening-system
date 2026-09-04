"""
Evaluates RANKING quality among candidates who are all in the right field.

Usage:
    python -m evaluation.evaluate_ranking

`evaluate.py` answers "is this candidate even in the right field?", which the
labelled data shows is nearly trivially separable. This script answers the
question a recruiter actually has: given a pool of six plausible candidates for
one posting, does the model order them the way a human would?

Metrics, per job posting and averaged:

* **Spearman rho** -- rank correlation between the model's ordering and the
  human grades. 1.0 is a perfect ordering, 0.0 is no better than shuffling,
  negative is worse than shuffling. Ties in the human grades are handled with
  average ranks, which is what makes rho the right choice here.
* **NDCG@3** -- how good the top three are, discounted by position, since a
  recruiter looks at the top of the list and little else.
* **Top-1 hit** -- whether the candidate the model ranks first is one the
  humans also graded highest.

No threshold is fit here and nothing is swept: these numbers are what they
are.
"""

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.scoring import compute_matches  # noqa: E402

DATASET_PATH = Path(__file__).parent / "ranking_dataset.json"


def load_dataset():
    with open(DATASET_PATH, encoding="utf-8") as f:
        return json.load(f)


def average_ranks(values: list[float]) -> list[float]:
    """Ranks with ties averaged, ascending. [3, 1, 3] -> [2.5, 1.0, 2.5]."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)

    position = 0
    while position < len(order):
        end = position
        while end + 1 < len(order) and values[order[end + 1]] == values[order[position]]:
            end += 1
        shared = (position + end) / 2 + 1
        for index in order[position:end + 1]:
            ranks[index] = shared
        position = end + 1

    return ranks


def spearman(a: list[float], b: list[float]) -> float:
    """Spearman rank correlation: Pearson correlation of the average ranks."""
    rank_a, rank_b = average_ranks(a), average_ranks(b)
    n = len(a)
    mean_a, mean_b = sum(rank_a) / n, sum(rank_b) / n

    covariance = sum((x - mean_a) * (y - mean_b) for x, y in zip(rank_a, rank_b))
    variance_a = sum((x - mean_a) ** 2 for x in rank_a)
    variance_b = sum((y - mean_b) ** 2 for y in rank_b)

    if variance_a == 0 or variance_b == 0:
        # One side is entirely tied, so no ordering can be right or wrong.
        return 0.0

    return covariance / math.sqrt(variance_a * variance_b)


def ndcg_at_k(grades_in_model_order: list[int], k: int) -> float:
    def dcg(grades):
        return sum(
            (2 ** grade - 1) / math.log2(position + 2)
            for position, grade in enumerate(grades[:k])
        )

    ideal = dcg(sorted(grades_in_model_order, reverse=True))
    return dcg(grades_in_model_order) / ideal if ideal else 0.0


def evaluate_job(job_key: str, job_text: str, entries: list[dict], resumes: dict):
    resume_keys = [entry["resume"] for entry in entries]
    grades = [entry["grade"] for entry in entries]

    results = compute_matches([resumes[key] for key in resume_keys], job_text)
    scores = [result.match_score for result in results]

    ordered = sorted(zip(resume_keys, grades, scores), key=lambda row: -row[2])
    grades_in_model_order = [grade for _, grade, _ in ordered]

    rho = spearman(grades, scores)
    ndcg = ndcg_at_k(grades_in_model_order, 3)
    top1_hit = ordered[0][1] == max(grades)

    print(f"\n{job_key}   Spearman={rho:+.2f}  NDCG@3={ndcg:.2f}  top-1 {'hit' if top1_hit else 'MISS'}")
    print(f"  {'model rank':<11}{'candidate':<16}{'score':>7}{'human grade':>13}")
    for position, (resume_key, grade, score) in enumerate(ordered, start=1):
        print(f"  {position:<11}{resume_key:<16}{score:>7.1f}{grade:>13}")

    return rho, ndcg, top1_hit


def run_evaluation():
    data = load_dataset()
    jobs, resumes = data["jobs"], data["resumes"]

    by_job = defaultdict(list)
    for entry in data["graded_pairs"]:
        by_job[entry["job"]].append(entry)

    print("Ranking quality within a single job's candidate pool")
    print("=" * 60)

    rhos, ndcgs, hits = [], [], []
    for job_key, entries in by_job.items():
        rho, ndcg, hit = evaluate_job(job_key, jobs[job_key], entries, resumes)
        rhos.append(rho)
        ndcgs.append(ndcg)
        hits.append(hit)

    print()
    print("=" * 60)
    print(f"Job postings:        {len(rhos)}")
    print(f"Graded pairs:        {len(data['graded_pairs'])}")
    print(f"Mean Spearman rho:   {sum(rhos) / len(rhos):+.2f}   (per job: {', '.join(f'{r:+.2f}' for r in rhos)})")
    print(f"Mean NDCG@3:         {sum(ndcgs) / len(ndcgs):.2f}")
    print(f"Top-1 hit rate:      {sum(hits)}/{len(hits)}")

    return rhos, ndcgs, hits


if __name__ == "__main__":
    run_evaluation()
