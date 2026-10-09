import type { Junction, Turn } from './roadNetwork';

export interface TurnPrompt { id: string; meters: number; turns: Turn[] }

/** Prompt only for actual direction choices, within the final 50 metres. */
export function getTurnPrompt(junction: Junction | null, dismissedId: string | null): TurnPrompt | null {
  if (!junction || junction.meters > 50 || !junction.choices.length) return null;
  const turns = [...new Set(junction.choices.map(choice => choice.turn))];
  if (turns.every(turn => turn === 'straight')) return null;
  const id = junction.choices[0].edge.from;
  return id === dismissedId ? null : { id, meters: Math.max(0, junction.meters), turns };
}
