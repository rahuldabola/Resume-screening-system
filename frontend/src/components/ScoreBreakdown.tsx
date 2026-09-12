import type { CSSProperties } from 'react';
import type { AssessmentResult } from '../api/types';
import { parseSkills } from '../api/types';
import { SkillPills } from './SkillPills';

interface ScoreBreakdownProps {
  result: AssessmentResult;
}

const SKILL_WEIGHT = 0.65;
const TFIDF_WEIGHT = 0.35;

interface SignalBarProps {
  label: string;
  value: number;
  weight: number;
  hint: string;
  color: string;
  delay: number;
}

function SignalBar({ label, value, weight, hint, color, delay }: SignalBarProps) {
  const width = `${Math.max(0, Math.min(100, value))}%`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink-700">
          {label} <span className="text-xs font-normal text-ink-300">· {Math.round(weight * 100)}% of score</span>
        </p>
        <p className="tnum text-sm font-semibold text-ink-900">{value}%</p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-900/[0.06]">
        {/* The keyframe animates to --target-w, so the bar still ends at the
            right width when motion is reduced and the animation is skipped. */}
        <div
          className={`h-full rounded-full motion-safe:animate-fill-bar ${color}`}
          style={{ width, '--target-w': width, animationDelay: `${delay}ms` } as CSSProperties}
        />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{hint}</p>
    </div>
  );
}

/**
 * Why the candidate scored what they scored.
 *
 * The whole argument of this project is that a ranking nobody can interrogate
 * is not usable for hiring, so the two signals, their weights and any stuffing
 * penalty are all on screen rather than folded into one opaque number. The bars
 * fill from zero each time the panel opens — the caller remounts this by key —
 * which makes their relative lengths the first thing you read.
 */
export function ScoreBreakdown({ result }: ScoreBreakdownProps) {
  const matched = parseSkills(result.matched_skills);
  const missing = parseSkills(result.missing_skills);
  const damped = result.stuffing_factor < 1;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-5">
        <SignalBar
          label="Skill overlap"
          value={result.skill_overlap_score}
          weight={SKILL_WEIGHT}
          color="bg-gradient-to-r from-brand-600 to-brand-400"
          delay={60}
          hint={`${matched.length} of ${matched.length + missing.length} skills this job asks for appear in the resume.`}
        />
        <SignalBar
          label="Text similarity"
          value={result.tfidf_similarity}
          weight={TFIDF_WEIGHT}
          color="bg-gradient-to-r from-brand-400 to-brand-200"
          delay={180}
          hint="TF-IDF cosine similarity, fit across this job's whole candidate pool so it is comparable between candidates."
        />
        {damped && (
          <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-inset ring-amber-600/20">
            <p className="text-sm font-semibold text-amber-800">Keyword-stuffing penalty applied</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              {Math.round(result.keyword_coverage * 100)}% of this resume is bare skill keywords. Genuine
              prose runs 7–33%. The score was damped to {Math.round(result.stuffing_factor * 100)}% of its
              raw value.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-300">
            Matched skills · {matched.length}
          </p>
          <SkillPills skills={matched} tone="positive" stagger />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-300">
            Missing skills · {missing.length}
          </p>
          <SkillPills skills={missing} tone="negative" stagger />
        </div>
      </div>
    </div>
  );
}
