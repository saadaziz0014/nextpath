export type RoadLevel = 'ground' | 'bridge' | 'tunnel' | 'elevated' | 'underground';

export function roadLevelFromProperties(properties: Record<string, unknown>): RoadLevel {
  if (properties.structure === 'bridge') return 'bridge';
  if (properties.structure === 'tunnel') return 'tunnel';
  const layer = Number(properties.layer ?? 0);
  return layer > 0 ? 'elevated' : layer < 0 ? 'underground' : 'ground';
}

export const ROAD_LEVEL_PRESENTATION: Record<RoadLevel, { label: string; description: string; color: string; height: number }> = {
  ground: { label: 'Ground road', description: 'Driving at road level', color: '#38bdf8', height: 36 },
  bridge: { label: 'Flyover / bridge', description: 'Driving above ground', color: '#fbbf24', height: 20 },
  tunnel: { label: 'Underpass / tunnel', description: 'Driving through a covered road', color: '#c4b5fd', height: 52 },
  elevated: { label: 'Elevated road', description: 'Driving above ground', color: '#fbbf24', height: 20 },
  underground: { label: 'Below ground', description: 'Driving below road level', color: '#c4b5fd', height: 52 },
};
