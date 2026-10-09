'use client';
import { memo, useMemo, useRef } from 'react';
import MapView, { Source, Layer, NavigationControl, type MapRef } from 'react-map-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { BusPath } from '@/lib/bus/types';
interface Props { colour:string; darkColour:string; path:BusPath; attribution:string; token:string; onReady:(map:MapboxMap)=>void; onFailure:(message:string)=>void; onInteraction:()=>void }
export default memo(function BusMap({colour,darkColour,path,attribution,token,onReady,onFailure,onInteraction}:Props) {
  const ref=useRef<MapRef>(null);
  const lines=useMemo(()=>({type:'FeatureCollection' as const,features:path.sections.map(section=>({type:'Feature' as const,properties:{underground:section.underground},geometry:{type:'LineString' as const,coordinates:section.coordinates}}))}),[path]);
  const stations=useMemo(()=>({type:'FeatureCollection' as const,features:path.stations.map(station=>({type:'Feature' as const,properties:{name:station.name,underground:station.underground},geometry:{type:'Point' as const,coordinates:station.coordinate}}))}),[path]);
  const origin=path.coordinates[0];
  return <MapView ref={ref} mapboxAccessToken={token} mapStyle="mapbox://styles/mapbox/light-v11" initialViewState={{longitude:origin[0],latitude:origin[1],zoom:18,pitch:40}} style={{width:'100%',height:'100%'}} onLoad={()=>{if(ref.current)onReady(ref.current.getMap());}} onDragStart={onInteraction} onError={event=>onFailure(event.error.message)}>
    <Source id="metrobus-running-track" type="geojson" data={lines} attribution={attribution}>
      <Layer id="metrobus-track-casing" type="line" paint={{'line-color':'#fff1f2','line-width':9}}/>
      <Layer id="metrobus-elevated-track" type="line" filter={['==',['get','underground'],false]} paint={{'line-color':colour,'line-width':4}}/>
      <Layer id="metrobus-tunnel-track" type="line" filter={['==',['get','underground'],true]} paint={{'line-color':darkColour,'line-width':4,'line-dasharray':[2,1.5]}}/>
    </Source>
    <Source id="metrobus-platforms" type="geojson" data={stations}>
      <Layer id="metrobus-platform-dot" type="circle" paint={{'circle-radius':5,'circle-color':'#fff','circle-stroke-color':colour,'circle-stroke-width':3}}/>
      <Layer id="metrobus-platform-name" type="symbol" layout={{'text-field':['get','name'],'text-size':12,'text-offset':[0,1.4],'text-anchor':'top'}} paint={{'text-color':darkColour,'text-halo-color':'#fff','text-halo-width':2}}/>
    </Source>
    <NavigationControl position="bottom-right"/>
  </MapView>;
});
