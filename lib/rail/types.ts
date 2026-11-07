import type { Coordinate } from '../routeData';
export type RailBranch = 'chord' | 'multan' | 'south' | 'north' | 'branch' | 'allama-iqbal' | 'musa-pak' | 'fareed' | 'jaffar' | 'green-line' | 'awam' | 'pak-business' | 'subak-kharam' | 'tezgam' | 'mohenjo-daro' | 'millat' | 'jamalo' | 'kcr';
export interface RailStation { id: string; name: string; coordinate: Coordinate; sourceCoordinate: Coordinate; km: number; offsetMeters: number }
/** A contiguous run of track with a sourced physical track count. `null` means
 * the OSM ways did not state passenger_lines/tracks; it is not a guess of one. */
export interface RailTrackSection { startKm: number; endKm: number; tracks: number | null }
export interface RailPath { id: RailBranch; name: string; coordinates: Coordinate[]; stations: RailStation[]; distanceKm: number; reversals?: { stationId: string; km: number }[]; trackSections?: RailTrackSection[] }
export interface RailDataset { version: 1; source: string; attribution: string; retrievedAt: string; sourceTimestamp: string; sources?: { file: string; sourceTimestamp: string }[]; coverage: string; paths: RailPath[] }
export interface RailMotion { km: number; velocity: number }
