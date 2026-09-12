import { bandFor } from './scoreBands';

interface ScoreBadgeProps {
  score: number;
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const band = bandFor(score);

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${band.pill}`}>
      {band.label}
    </span>
  );
}
