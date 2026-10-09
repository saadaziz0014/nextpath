import type { Coordinate } from '../routeData';
export type MetroDirection = 'dera-gujran' | 'ali-town';
export interface MetroStation { id: string; name: string; coordinate: Coordinate; km: number; sourceId: number; underground: boolean }
export interface MetroPath { direction: MetroDirection; destination: string; coordinates: Coordinate[]; distanceKm: number; stations: MetroStation[]; sections: { underground: boolean; coordinates: Coordinate[] }[] }
export interface MetroDataset { version: 1; id: 'lahore-orange'; fingerprint: string; attribution: string; sourceTimestamp: string; paths: MetroPath[] }
export const METRO_MAX_KMH = 80;
export const METRO_CAR_COUNT = 5;
// PMA's station directory, ordered from Ali Town towards Dera Gujran.
export const ORANGE_STATIONS = ['Ali Town','Thokar Niaz Baig','Canal View','Hanjarwal','Wahdat Road','Awan Town','Sabzazar','Shahnoor','Salahudin Road','Band Road','Samanabad','Gulshan-e-Ravi','Chauburji','Anarkali','GPO','Lakshmi','Railway Station','Sultanpura','UET','Baghbanpura','Shalamar Garden','Pakistan Mint','Mahmood Booti','Salamatpura','Islam Park','Dera Gujran'] as const;
