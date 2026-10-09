'use client';
import { memo, useMemo, useRef } from 'react';
import MapView, { Source, Layer, NavigationControl, type MapRef } from 'react-map-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { MetroPath } from '@/lib/metro/types';
interface Props { path:MetroPath; attribution:string; token:string; onReady:(map:MapboxMap)=>void; onFailure:(message:string)=>void; onInteraction:()=>void }
export default memo(function MetroMap({path,attribution,token,onReady,onFailure,onInteraction}:Props) {
  const ref=useRef<MapRef>(null);
  const lines=useMemo(()=>({type:'FeatureCollection' as const,features:path.sections.map(section=>({type:'Feature' as const,properties:{underground:section.underground},geometry:{type:'LineString' as const,coordinates:section.coordinates}}))}),[path]);
  const stations=useMemo(()=>({type:'FeatureCollection' as const,features:path.stations.map(station=>({type:'Feature' as const,properties:{name:station.name,underground:station.underground},geometry:{type:'Point' as const,coordinates:station.coordinate}}))}),[path]);
  const origin=path.coordinates[0];
  return <MapView ref={ref} mapboxAccessToken={token} mapStyle="mapbox://styles/mapbox/light-v11" initialViewState={{longitude:origin[0],latitude:origin[1],zoom:17,pitch:48}} style={{width:'100%',height:'100%'}} onLoad={()=>{if(ref.current)onReady(ref.current.getMap());}} onDragStart={onInteraction} onError={event=>onFailure(event.error.message)}>
    <Source id="orange-running-track" type="geojson" data={lines} attribution={attribution}>
      <Layer id="orange-track-casing" type="line" paint={{'line-color':'#fff7ed','line-width':9}}/>
      <Layer id="orange-elevated-track" type="line" filter={['==',['get','underground'],false]} paint={{'line-color':'#f97316','line-width':4}}/>
      <Layer id="orange-tunnel-track" type="line" filter={['==',['get','underground'],true]} paint={{'line-color':'#c2410c','line-width':4,'line-dasharray':[2,1.5]}}/>
    </Source>
    <Source id="orange-platforms" type="geojson" data={stations}>
      <Layer id="orange-platform-dot" type="circle" paint={{'circle-radius':5,'circle-color':'#fff','circle-stroke-color':'#ea580c','circle-stroke-width':3}}/>
      <Layer id="orange-platform-name" type="symbol" layout={{'text-field':['get','name'],'text-size':12,'text-offset':[0,1.4],'text-anchor':'top'}} paint={{'text-color':'#431407','text-halo-color':'#fff','text-halo-width':2}}/>
    </Source>
    <NavigationControl position="bottom-right"/>
  </MapView>;
});
