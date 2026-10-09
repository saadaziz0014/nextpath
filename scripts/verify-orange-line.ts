import { readFileSync } from 'node:fs';
import { verifyMetroSource } from '../lib/metro/sourceQuality';
import type { MetroDataset } from '../lib/metro/types';
import type { Coordinate } from '../lib/routeData';
const data=JSON.parse(readFileSync('public/data/metro/orange-line.json','utf8')) as MetroDataset;
const source=JSON.parse(readFileSync('data/metro/orange-line.osm.json','utf8')) as {elements:{type:string;tags?:{railway?:string};geometry?:{lat:number;lon:number}[]}[]};
verifyMetroSource(data,source.elements.filter(element=>element.type==='way'&&element.tags?.railway==='subway'&&element.geometry).map(element=>element.geometry!.map(point=>[point.lon,point.lat] as Coordinate)));
console.log(data.paths.map(path=>`${path.destination}: ${path.distanceKm.toFixed(2)} km, ${path.stations.length} platforms, every edge backed by OSM metro geometry`).join('\n'));
