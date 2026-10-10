'use client';

import { ROAD_LEVEL_PRESENTATION, type RoadLevel } from '@/lib/roadLevel';

export default function RoadLevelIndicator({ level }: { level: RoadLevel }) {
  const { label, description, color, height } = ROAD_LEVEL_PRESENTATION[level];
  return <div aria-label="Current road level" className="mb-3 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2">
    <svg aria-hidden="true" viewBox="0 0 96 68" className="h-10 w-16 shrink-0">
      <path d="M4 36h88" stroke="#64748b" strokeWidth="2" strokeDasharray="4 4" />
      {height === 20 && <path d="M18 22v14m60-14v14" stroke="#64748b" strokeWidth="3" />}
      {height === 52 && <path d="M22 53V39a26 26 0 0 1 52 0v14" fill="none" stroke="#64748b" strokeWidth="3" />}
      <path d={`M8 ${height}h80`} stroke={color} strokeWidth="3" strokeLinecap="round" />
      <g transform={`translate(36 ${height - 14})`}>
        <path d="M2 11V6l4-5h12l4 5v5z" fill={color} />
        <path d="M7 3h10l2 4H5z" fill="#0f172a" />
        <circle cx="6" cy="12" r="2" fill="#e2e8f0" /><circle cx="18" cy="12" r="2" fill="#e2e8f0" />
      </g>
    </svg>
    <div role="status" aria-live="polite" aria-atomic="true">
      <p className="text-xs font-semibold" style={{ color }}>{label}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>
    </div>
  </div>;
}
