import type { Coordinate } from '../routeData';
export type BusNetworkId = 'lahore-metrobus' | 'islamabad-metrobus' | 'peshawar-brt' | 'multan-metrobus';
export type BusDirection = 'gajjumata' | 'shahdara' | 'pak-secretariat' | 'saddar' | 'karkhano-market' | 'chamkani' | 'chowk-kumharan' | 'bzu';
export interface BusStation { id:string; name:string; coordinate:Coordinate; km:number; sourceId:number; underground:boolean }
export interface BusPath { direction:BusDirection; destination:string; coordinates:Coordinate[]; distanceKm:number; stations:BusStation[]; sections:{ underground:boolean; coordinates:Coordinate[] }[] }
export interface BusDataset { version:1; id:BusNetworkId; fingerprint:string; attribution:string; sourceTimestamp:string; paths:BusPath[] }
// Simulation setting; not an assertion of an official corridor speed limit.
export const BUS_MAX_KMH=60;
export const BUS_STATIONS=['Shahdara','Niazi Chowk','Timber Market','Azadi Chowk','Bhati Chowk','Katchehry','Civil Secretariat','MAO College','Janazgah','Qartaba Chowk','Shama','Ichhra','Canal','Gaddafi Stadium','Kalma Chowk','Model Town','Naseerabad','Ittefaq Hospital','Qainchi','Ghazi Chowk','Chungi Amar Sidhu','Kamahan','Atari Saroba','Nishtar Colony','Youhanabad','Dullu Khurd','Gajjumata'] as const;
