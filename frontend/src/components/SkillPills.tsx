interface SkillPillsProps {
  skills: string[];
  tone?: 'positive' | 'negative' | 'neutral';
  /** Show only this many, then a "+N more" pill. */
  limit?: number;
}

const TONE_CLASSES: Record<NonNullable<SkillPillsProps['tone']>, string> = {
  positive: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  negative: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  neutral: 'bg-ink-900/[0.04] text-ink-700 ring-ink-900/10',
};

export function SkillPills({ skills, tone = 'neutral', limit }: SkillPillsProps) {
  if (skills.length === 0) {
    return <span className="text-xs italic text-ink-300">none</span>;
  }

  const shown = limit ? skills.slice(0, limit) : skills;
  const hidden = skills.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((skill) => (
        <span
          key={skill}
          className={`rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}
        >
          {skill}
        </span>
      ))}
      {hidden > 0 && (
        <span
          title={skills.slice(shown.length).join(', ')}
          className="rounded-lg px-2 py-1 text-xs font-medium text-ink-500 ring-1 ring-inset ring-ink-900/10"
        >
          +{hidden} more
        </span>
      )}
    </div>
  );
}
