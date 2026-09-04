"""
Evaluates the resume/job matching pipeline against a hand-labeled dataset.

Usage:
    python -m evaluation.evaluate

This measures ONE thing: can the model tell a resume in the right field from a
resume in the wrong field? For each (resume, job, label) pair it computes the
match score, then sweeps classification thresholds to find the one that
maximizes accuracy. The dataset is fixed beforehand and the scoring weights
are not touched here -- only the decision threshold applied on top.

Read `report_separation()` alongside the headline accuracy. The two classes
turn out to be separated by a wide empty band, which means the accuracy number
is much less impressive than it looks: a large range of thresholds all score
identically, so this task is close to trivially separable. Ranking quality
among same-field candidates is the harder question, and it is measured
separately in `evaluation/evaluate_ranking.py`.
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.scoring import compute_matches  # noqa: E402

DATASET_PATH = Path(__file__).parent / "eval_dataset.json"


def load_dataset():
    with open(DATASET_PATH, encoding="utf-8") as f:
        return json.load(f)


def score_pairs(data):
    """Score every labelled pair, one TF-IDF fit per job's candidate pool.

    Pairs are grouped by job so that scoring matches how the application
    actually runs: a pool of candidates evaluated against one posting, with
    IDF estimated across that pool.
    """
    resumes, jobs, pairs = data["resumes"], data["jobs"], data["pairs"]

    by_job = defaultdict(list)
    for pair in pairs:
        by_job[pair["job"]].append(pair)

    scored = []
    for job_key, job_pairs in by_job.items():
        resume_keys = [pair["resume"] for pair in job_pairs]
        results = compute_matches([resumes[key] for key in resume_keys], jobs[job_key])
        for pair, result in zip(job_pairs, results):
            scored.append({
                "resume": pair["resume"],
                "job": job_key,
                "label": pair["label"],
                "match_score": result.match_score,
            })

    return scored


def sweep_threshold(scored):
    """The accuracy-maximizing threshold, plus every threshold that ties it."""
    candidates = [t / 2 for t in range(0, 201)]  # 0, 0.5, 1.0, ..., 100.0

    accuracies = []
    for threshold in candidates:
        correct = sum(
            1 for s in scored
            if (s["match_score"] >= threshold) == bool(s["label"])
        )
        accuracies.append(correct / len(scored))

    best_accuracy = max(accuracies)
    tied = [t for t, acc in zip(candidates, accuracies) if acc == best_accuracy]
    return tied[0], best_accuracy, tied


def report_separation(scored, tied_thresholds):
    """Print how easy the task actually is, not just how well we did on it."""
    positives = sorted(s["match_score"] for s in scored if s["label"] == 1)
    negatives = sorted(s["match_score"] for s in scored if s["label"] == 0)

    print()
    print("How separable is this task, really?")
    print(f"  Right-field pairs:  n={len(positives):2d}  range {positives[0]:.1f} - {positives[-1]:.1f}")
    print(f"  Wrong-field pairs:  n={len(negatives):2d}  range {negatives[0]:.1f} - {negatives[-1]:.1f}")
    print(f"  Thresholds tied at best accuracy: {tied_thresholds[0]:.1f} - {tied_thresholds[-1]:.1f}")
    print("  A wide tie band means the classes barely overlap, so the headline")
    print("  accuracy reflects an easy question. See evaluate_ranking.py for the")
    print("  harder one: ordering candidates who are all in the right field.")


def run_evaluation():
    data = load_dataset()
    scored = score_pairs(data)
    best_threshold, best_accuracy, tied = sweep_threshold(scored)

    tp = sum(1 for s in scored if s["label"] == 1 and s["match_score"] >= best_threshold)
    fn = sum(1 for s in scored if s["label"] == 1 and s["match_score"] < best_threshold)
    fp = sum(1 for s in scored if s["label"] == 0 and s["match_score"] >= best_threshold)
    tn = sum(1 for s in scored if s["label"] == 0 and s["match_score"] < best_threshold)

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    print(f"Pairs evaluated:     {len(scored)}")
    print(f"Best threshold:      {best_threshold}")
    print(f"Accuracy:            {best_accuracy * 100:.1f}%")
    print(f"Precision:           {precision * 100:.1f}%")
    print(f"Recall:              {recall * 100:.1f}%")
    print(f"F1:                  {f1 * 100:.1f}%")
    print(f"Confusion matrix:    TP={tp} FN={fn} FP={fp} TN={tn}")
    print()
    print("Misclassified pairs:")
    misclassified = [
        s for s in scored
        if (1 if s["match_score"] >= best_threshold else 0) != s["label"]
    ]
    if not misclassified:
        print("  (none)")
    for s in misclassified:
        predicted = 1 if s["match_score"] >= best_threshold else 0
        print(f"  {s['resume']:20s} vs {s['job']:20s}  score={s['match_score']:5.1f}  label={s['label']}  predicted={predicted}")

    report_separation(scored, tied)

    return best_threshold, best_accuracy


if __name__ == "__main__":
    run_evaluation()
