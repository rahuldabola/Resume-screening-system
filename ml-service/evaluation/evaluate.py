"""
Evaluates the resume/job matching pipeline against a hand-labeled dataset.

Usage:
    python -m evaluation.evaluate

For each (resume, job, label) pair, computes the match score, then sweeps
classification thresholds to find the one that maximizes accuracy. This is
standard practice for calibrating a binary classifier from a continuous
score — the dataset itself is fixed beforehand and the scoring function's
weights are not touched here, only the decision threshold applied on top.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.scoring import compute_match  # noqa: E402

DATASET_PATH = Path(__file__).parent / "eval_dataset.json"


def load_dataset():
    with open(DATASET_PATH, encoding="utf-8") as f:
        return json.load(f)


def run_evaluation():
    data = load_dataset()
    resumes = data["resumes"]
    jobs = data["jobs"]
    pairs = data["pairs"]

    scored = []
    for pair in pairs:
        result = compute_match(resumes[pair["resume"]], jobs[pair["job"]])
        scored.append({
            "resume": pair["resume"],
            "job": pair["job"],
            "label": pair["label"],
            "match_score": result.match_score,
        })

    best_threshold = None
    best_accuracy = -1.0
    for threshold in [t / 2 for t in range(0, 201)]:  # 0, 0.5, 1.0, ..., 100.0
        correct = sum(
            1 for s in scored
            if (s["match_score"] >= threshold) == bool(s["label"])
        )
        accuracy = correct / len(scored)
        if accuracy > best_accuracy:
            best_accuracy = accuracy
            best_threshold = threshold

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
    for s in scored:
        predicted = 1 if s["match_score"] >= best_threshold else 0
        if predicted != s["label"]:
            print(f"  {s['resume']:20s} vs {s['job']:20s}  score={s['match_score']:5.1f}  label={s['label']}  predicted={predicted}")

    return best_threshold, best_accuracy


if __name__ == "__main__":
    run_evaluation()
