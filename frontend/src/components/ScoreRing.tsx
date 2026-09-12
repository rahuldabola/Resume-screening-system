import { useCountUp, usePrefersReducedMotion } from '../lib/motion';
import { bandFor } from './scoreBands';

interface ScoreRingProps {
  score: number;
  size?: number;
  /** Hold the animation back so a list of rings fills in sequence. */
  delay?: number;
}

/**
 * The match score as a ring that draws itself.
 *
 * A recruiter scanning a list reads the arc before the digits, which is the
 * point: the ordering is the product, and an arc compares at a glance in a way
 * that four two-digit numbers do not. The number counts up alongside the arc so
 * the two never disagree mid-animation.
 */
export function ScoreRing({ score, size = 56, delay = 0 }: ScoreRingProps) {
  const reduced = usePrefersReducedMotion();
  const band = bandFor(score);
  const stroke = size >= 56 ? 5 : 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const counted = useCountUp(clamped, { duration: 1000, enabled: !reduced });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* A halo that fires once for a genuinely strong match. Restricted to
          the top band so it stays a signal rather than decoration. */}
      {score >= 70 && !reduced && (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse-ring rounded-full"
          style={{ boxShadow: `0 0 0 3px ${band.stroke}` }}
        />
      )}
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-ink-900/[0.07]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={band.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - (reduced ? clamped : counted) / 100)}
          style={{ transition: reduced ? undefined : `stroke-dashoffset 120ms linear ${delay}ms` }}
        />
      </svg>
      <span
        className={`tnum absolute inset-0 flex items-center justify-center font-bold ${band.text}`}
        style={{ fontSize: size * 0.27 }}
      >
        {Math.round(reduced ? clamped : counted)}
      </span>
      <span className="sr-only">
        {score}% match — {band.label}
      </span>
    </div>
  );
}
