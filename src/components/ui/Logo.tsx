import { TrendingUp } from 'lucide-react';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
        <TrendingUp className="h-5 w-5" aria-hidden="true" />
      </div>
      <span className={`text-lg font-bold tracking-tight ${light ? 'text-white' : 'text-gray-900'}`}>AGENTPAY</span>
    </div>
  );
}
