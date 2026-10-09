import type { Coordinate } from '../routeData';
import type { BusSourceSnapshot, BusSourceWay } from './sourceQuality';

// The route relation covers only part of one direction. These 16 original
// dedicated corridor ways cover both directions; never include ordinary roads.
export const MULTAN_BUSWAY_IDS = [791728404,1203550233,1203557180,1203557181,1203550236,1203510811,1203510812,1203510813,1203510814,1203515347,1203515349,1203515972,1203515973,1203515974,1203515975,1203516196] as const;
export function multanSourceWays(source:BusSourceSnapshot):BusSourceWay[] {
 const elements=new Map(source.elements.map(element=>[element.type+'/'+element.id,element]));
 return MULTAN_BUSWAY_IDS.map(id=>{
  const way=elements.get('way/'+id);
  if(!way?.nodes?.length||way.tags?.bus!=='designated')throw Error('Missing dedicated Multan busway: '+id);
  // Legacy bus_guideway tags describe this dedicated BRT corridor. One
  // bridge has lost its highway tag; its exact ID, access and endpoint guard
  // keep that narrow source interpretation from admitting unrelated bridges.
  const bridge=id===1203515975&&way?.tags?.highway===undefined&&way.tags.access==='no'&&way.tags.bridge==='yes'&&way.nodes?.[0]===7401594845&&way.nodes.at(-1)===7401594721;
  if(!(['busway','bus_guideway'].includes(way.tags.highway??'')||bridge))throw Error('Missing dedicated Multan busway: '+id);
  const coordinates=way.nodes.map(nodeId=>{const node=elements.get('node/'+nodeId);if(!Number.isFinite(node?.lon)||!Number.isFinite(node?.lat))throw Error('Missing Multan busway node');return [node!.lon!,node!.lat!] as Coordinate;});
  return {wayId:id,nodeIds:way.nodes,coordinates,oneway:way.tags.oneway};
 });
}
