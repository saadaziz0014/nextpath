'use client';

import type { Turn } from '@/lib/roadNetwork';
import type { TurnPrompt as Prompt } from '@/lib/turnPrompt';

export default function TurnPrompt({ prompt, enabled, onChoose }: { prompt: Prompt | null; enabled: boolean; onChoose: (turn: Turn | null) => void }) {
  if (!prompt) return null;
  const straight = prompt.turns.includes('straight');
  return <section aria-label="Upcoming junction" className="glass absolute left-3 right-14 top-28 z-20 rounded-2xl p-4 sm:left-auto sm:right-14 sm:top-6 sm:w-80">
    <p role="status" className="text-sm font-semibold text-sky-300">Junction in {Math.round(prompt.meters)} m — turn?</p>
    <p className="mt-2 text-xs text-slate-300">{straight ? 'Choose a turn, or continue straight. Without a choice, you continue straight.' : 'No road continues straight. Choose an available turn to continue.'}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {prompt.turns.filter(turn => turn !== 'straight').map(turn => <button key={turn} disabled={!enabled} onClick={() => onChoose(turn)} className="rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold capitalize text-slate-950 disabled:opacity-40">Turn {turn} ({turn === 'left' ? 'A' : 'D'})</button>)}
      {straight && <button disabled={!enabled} onClick={() => onChoose(null)} className="rounded-lg border border-slate-500 px-3 py-2 text-xs font-semibold disabled:opacity-40">No, continue straight (Enter)</button>}
    </div>
  </section>;
}

