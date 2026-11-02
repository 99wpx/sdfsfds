import type { ReactNode } from 'react';

type Tone = 'emerald' | 'sky' | 'amber' | 'neutral';

const iconTone: Record<Tone, string> = {
  emerald: 'bg-emerald-50 text-emerald-600',
  sky: 'bg-sky-50 text-sky-600',
  amber: 'bg-amber-50 text-amber-600',
  neutral: 'bg-gray-100 text-gray-600',
};

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: Tone;
  hint?: string;
}

export function StatCard({ label, value, icon, tone = 'emerald', hint }: StatCardProps) {
  return (
    <div className="group rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTone[tone]}`}>{icon}</div>
      </div>
      <p className="mt-3 truncate text-2xl font-bold tracking-tight text-gray-900">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
