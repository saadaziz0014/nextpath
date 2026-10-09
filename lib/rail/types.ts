import type { Coordinate } from '../routeData';
export type RailBranch = 'chord' | 'multan' | 'south' | 'north' | 'branch' | 'allama-iqbal' | 'musa-pak' | 'fareed' | 'jaffar' | 'green-line' | 'awam' | 'pak-business' | 'subak-kharam' | 'tezgam' | 'mohenjo-daro' | 'millat' | 'jamalo' | 'kcr';
export interface RailStation { id: string; name: string; coordinate: Coordinate; sourceCoordinate: Coordinate; km: number; offsetMeters: number }
export interface RailPath { id: RailBranch; name: string; coordinates: Coordinate[]; stations: RailStation[]; distanceKm: number; reversals?: { stationId: string; km: number }[] }
export interface RailDataset { version: 1; source: string; attribution: string; retrievedAt: string; sourceTimestamp: string; sources?: { file: string; sourceTimestamp: string }[]; coverage: string; paths: RailPath[] }
export interface RailMotion { km: number; velocity: number }
