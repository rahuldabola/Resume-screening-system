import { bandFor } from './scoreBands';

interface ScoreRingProps {
  score: number;
  size?: number;
}

/**
 * The match score as a ring rather than a number alone.
 *
 * A recruiter scanning a list reads the arc before the digits, which is the
 * point: the ordering is the product, and an arc compares at a glance in a way
 * that four two-digit numbers do not.
 */
export function ScoreRing({ score, size = 56 }: ScoreRingProps) {
  const band = bandFor(score);
  const stroke = size >= 56 ? 5 : 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
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
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <span
        className={`tnum absolute inset-0 flex items-center justify-center font-bold ${band.text}`}
        style={{ fontSize: size * 0.27 }}
      >
        {Math.round(score)}
      </span>
      <span className="sr-only">{score}% match — {band.label}</span>
    </div>
  );
}
