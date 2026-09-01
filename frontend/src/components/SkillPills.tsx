interface SkillPillsProps {
  skills: string[];
  tone?: 'positive' | 'negative' | 'neutral';
}

const TONE_CLASSES: Record<NonNullable<SkillPillsProps['tone']>, string> = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  negative: 'bg-rose-50 text-rose-700 border-rose-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function SkillPills({ skills, tone = 'neutral' }: SkillPillsProps) {
  if (skills.length === 0) {
    return <span className="text-xs text-slate-400 italic">none</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span
          key={skill}
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
        >
          {skill}
        </span>
      ))}
    </div>
  );
}
