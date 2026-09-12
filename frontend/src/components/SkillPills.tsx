interface SkillPillsProps {
  skills: string[];
  tone?: 'positive' | 'negative' | 'neutral';
  /** Show only this many, then a "+N more" pill. */
  limit?: number;
  /** Arrive one after another rather than all at once. */
  stagger?: boolean;
}

const TONE_CLASSES: Record<NonNullable<SkillPillsProps['tone']>, string> = {
  positive: 'tone-positive',
  negative: 'tone-negative',
  neutral: 'tone-neutral',
};

export function SkillPills({ skills, tone = 'neutral', limit, stagger = false }: SkillPillsProps) {
  if (skills.length === 0) {
    return <span className="text-xs italic text-ink-300">none</span>;
  }

  const shown = limit ? skills.slice(0, limit) : skills;
  const hidden = skills.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((skill, index) => (
        <span
          key={skill}
          className={`rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset transition-transform duration-150 hover:scale-105 ${TONE_CLASSES[tone]} ${
            stagger ? 'motion-safe:animate-fade-up' : ''
          }`}
          // Capped: past a dozen pills the stagger stops reading as sequence
          // and starts reading as lag.
          style={stagger ? { animationDelay: `${Math.min(index, 12) * 35}ms` } : undefined}
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
