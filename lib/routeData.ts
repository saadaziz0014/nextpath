export type Coordinate = [longitude: number, latitude: number];
export const SPEED_OPTIONS = [1, 2, 5, 10] as const;
export type PlaybackSpeed = typeof SPEED_OPTIONS[number];
