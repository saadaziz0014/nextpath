'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Marker, type Map as MapboxMap } from 'mapbox-gl';
import { ArrowUpRight, LoaderCircle, Map as MapIcon } from 'lucide-react';
import DoubleBusIcon from './DoubleBusIcon';
import { busDeparture, platformAt, stepBus, toggleBusDoors, toggleBusAutomatic, type BusMotion } from '@/lib/bus/motion';
import { indexBusTrack, sampleBusTrack, validateBusDataset } from '@/lib/bus/track';
import { restoreBusSave, type BusSave } from '@/lib/bus/persistence';
import { articulatedBus, busSectionSvg } from '@/lib/bus/vehicle';
import { type BusDataset, type BusDirection, type BusPath, type BusNetworkId } from '@/lib/bus/types';
import { smoothBearing } from '@/lib/simulation';
import { isTransitShortcut, transitCommand } from '@/lib/transit/controls';
import { useBusAudio } from '@/app/hooks/useBusAudio';
import { busAudioInput } from '@/lib/audio/bus';
import BusCab from './BusCab';
import TouchDpad from './TouchDpad';
import MobileCabPanel from './MobileCabPanel';
import { busNetwork } from '@/lib/bus/networks';
const BusMap=dynamic(()=>import('./BusMap'),{ssr:false});
const initial:BusMotion={km:0,velocity:0,doorsOpen:false,dwellSeconds:0,nextStop:1,automatic:false};

export default function BusSimulator({networkId='lahore-metrobus'}:{networkId?:BusNetworkId}) {
  const network=busNetwork(networkId);
  const firstStationId=network.stationPrefix+'1';
  // Public Mapbox token: set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local.
  const token=process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [data,setData]=useState<BusDataset|null>(null),[error,setError]=useState('');
  const [map,setMap]=useState<MapboxMap|null>(null);
  const [direction,setDirection]=useState<BusDirection>(network.directions[0].id),[stationId,setStationId]=useState(firstStationId);
  const [telemetry,setTelemetry]=useState<BusMotion>(initial),[active,setActive]=useState(false),[paused,setPaused]=useState(false),[following,setFollowing]=useState(true);
  const dataRef=useRef<BusDataset|null>(null),trackRef=useRef<ReturnType<typeof indexBusTrack>|null>(null);
  const departureId=useRef(firstStationId),motion=useRef<BusMotion>({...initial}),keys=useRef(new Set<string>());
  const activeRef=useRef(false),pausedRef=useRef(false),followRef=useRef(true);
  const {enabled,started,error:audioError,volume,setVolume,unlock,update,silence,horn,toggle}=useBusAudio();
  const persist=useCallback(()=>{
    const dataset=dataRef.current,track=trackRef.current;if(!dataset||!track||!activeRef.current)return;
    const value:BusSave={version:1,fingerprint:dataset.fingerprint,direction:track.path.direction,stationId:departureId.current,motion:{...motion.current},following:followRef.current};
    try{localStorage.setItem(network.saveKey,JSON.stringify(value));}catch{/* Storage failure must not interrupt driving. */}
  },[network.saveKey]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(network.dataUrl,{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw Error(`${network.title} corridor could not be loaded.`);
      const dataset=validateBusDataset(await response.json(),network.id);if(controller.signal.aborted)return;
      dataRef.current=dataset;const origin=dataset.paths.find(path=>path.direction===network.directions[0].id)!;trackRef.current=indexBusTrack(origin);motion.current=busDeparture(origin,origin.stations[0].id);
      try{const raw=localStorage.getItem(network.saveKey);if(raw){const saved=restoreBusSave(raw,dataset);trackRef.current=indexBusTrack(saved.path);motion.current={...saved.value.motion};departureId.current=saved.value.stationId;activeRef.current=true;pausedRef.current=true;followRef.current=saved.value.following;setDirection(saved.value.direction);setStationId(saved.value.stationId);setActive(true);setPaused(true);setFollowing(saved.value.following);}}
      catch{try{localStorage.removeItem(network.saveKey);}catch{}}
      setTelemetry({...motion.current});setData(dataset);
    }).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Bus loading failed.');});
    return()=>controller.abort();
  },[network]);
  const setPause=useCallback(()=>{if(!activeRef.current)return;pausedRef.current=!pausedRef.current;keys.current.clear();setPaused(pausedRef.current);if(pausedRef.current)silence();else unlock();persist();},[silence,unlock,persist]);
  useEffect(()=>{
    const hide=()=>{if(document.hidden){keys.current.clear();pausedRef.current=true;setPaused(true);silence();}persist();};
    const blur=()=>keys.current.clear();
    window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',hide);window.addEventListener('blur',blur);
    return()=>{persist();window.removeEventListener('pagehide',persist);document.removeEventListener('visibilitychange',hide);window.removeEventListener('blur',blur);};
  },[persist,silence]);
  const preview=useCallback((path:BusPath,id:string)=>{
    if(activeRef.current)return;const station=path.stations.find(s=>s.id===id);if(!station)return;
    trackRef.current=indexBusTrack(path);departureId.current=id;
    motion.current={...initial,km:station.km,nextStop:path.stations.indexOf(station)+1};
    setDirection(path.direction);setStationId(id);setTelemetry({...motion.current});
  },[]);
  const start=useCallback(()=>{
    const track=trackRef.current;if(!map||!track||error)return;
    try{motion.current=busDeparture(track.path,departureId.current);keys.current.clear();activeRef.current=true;pausedRef.current=false;followRef.current=true;setActive(true);setPaused(false);setFollowing(true);setTelemetry({...motion.current});map.stop().jumpTo({zoom:18});unlock();persist();}
    catch(cause){setError(cause instanceof Error?cause.message:'Bus departure failed.');}
  },[map,error,unlock,persist]);
  const setKey=useCallback((key:string,pressed:boolean)=>{
    if(!pressed){keys.current.delete(key);return;}
    if(!activeRef.current||pausedRef.current||(key==='w'&&motion.current.doorsOpen))return;
    keys.current.add(key);
    if((key==='w'||key==='s')&&motion.current.automatic){motion.current={...motion.current,automatic:false,dwellSeconds:0};setTelemetry({...motion.current});}
    unlock();
  },[unlock]);
  const doors=useCallback(()=>{
    const track=trackRef.current;if(!track||!activeRef.current||pausedRef.current)return;
    const changed=toggleBusDoors(track.path,motion.current);if(changed!==motion.current){motion.current=changed;keys.current.clear();unlock();setTelemetry({...changed});persist();}
  },[unlock,persist]);
  const automatic=useCallback(()=>{
    const track=trackRef.current;if(!track||!activeRef.current)return;
    // Mode may be selected while paused; movement still waits for Resume.
    keys.current.clear();motion.current=toggleBusAutomatic(track.path,motion.current);
    setTelemetry({...motion.current});unlock();persist();
  },[unlock,persist]);
  const announce=useCallback(()=>{if(!activeRef.current||pausedRef.current)return;unlock();horn();},[unlock,horn]);
  useEffect(()=>{
    const heldKeys=keys.current;
    const down=(event:KeyboardEvent)=>{
      if(event.ctrlKey||event.altKey||event.metaKey||(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable="true"]')))return;
      const key=event.key.toLowerCase();if(!isTransitShortcut(key))return;
      if(key===' '&&event.target instanceof HTMLElement&&event.target.closest('button,a'))return;
      event.preventDefault();const command=transitCommand(event);if(!command)return;
      if(command==='w'||command==='s')setKey(command,true);else{if(command==='o')doors();if(command==='t')automatic();if(command==='h')announce();if(command===' ')setPause();}
    };
    const up=(event:KeyboardEvent)=>keys.current.delete(event.key.toLowerCase());
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);heldKeys.clear();};
  },[setKey,doors,automatic,announce,setPause]);
  const onReady=useCallback((instance:MapboxMap)=>setMap(instance),[]);
  const onFailure=useCallback((message:string)=>{pausedRef.current=true;keys.current.clear();silence();setPaused(true);setError(message);},[silence]);
  const unfollow=useCallback(()=>{followRef.current=false;setFollowing(false);},[]);
  useEffect(()=>{
    if(!map||!data)return;
    const markers=Array.from({length:2},(_,index)=>{
      const element=document.createElement('div');element.style.cssText='width:12px;height:36px;pointer-events:none;filter:drop-shadow(0 2px 2px #0006)';element.innerHTML=busSectionSvg(index,network.colour,network.darkColour);element.dataset.busCar=String(index);element.setAttribute('role','img');element.setAttribute('aria-label',`${network.title} articulated bus section ${index+1}`);
      return new Marker({element,rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(trackRef.current!.path.coordinates[0]).addTo(map);
    });
    let frame=0,previous=0,lastUI=0,lastSave=0,cameraBearing=map.getBearing();
    const tick=(now:number)=>{
      // One requestAnimationFrame drives bus, sound and camera. Physics uses
      // elapsed time, capped after backgrounding, while React receives only
      // lightweight 10 Hz telemetry. The Map component stays memoized.
      const seconds=previous?(now-previous)/1000:0;previous=now;
      const track=trackRef.current;if(!track)return;
      
      const previousMotion=motion.current;
      if(activeRef.current&&!pausedRef.current&&!document.hidden)motion.current=stepBus(motion.current,keys.current,seconds,track.path);
      
      update(busAudioInput(previousMotion,motion.current,keys.current,activeRef.current&&!pausedRef.current&&!document.hidden));
      const sample=sampleBusTrack(track,motion.current.km);
      // The two bus bodies use their own chainage and Turf road bearings so
      // the articulated rear follows bends. Fixed 9 m body-center spacing
      // keeps the bus a road vehicle, without a train's detached coaches.
      const metresPerPixel=156543.03392*Math.cos(sample.position[1]*Math.PI/180)/2**map.getZoom();
      const height=Math.min(100,Math.max(18,9/metresPerPixel));
      articulatedBus(track,motion.current.km).forEach(body=>{const marker=markers[body.index],element=marker.getElement();marker.setLngLat(body.position).setRotation(body.heading);element.style.visibility=body.visible?'visible':'hidden';element.style.height=height+'px';element.style.width=height*30/92+'px';});
      cameraBearing=smoothBearing(cameraBearing,sample.heading,1-Math.exp(-Math.min(seconds,.1)*6));
      if(followRef.current)map.jumpTo({center:sample.position,bearing:cameraBearing,pitch:40});
      if(now-lastUI>=100){setTelemetry({...motion.current});lastUI=now;}
      if(now-lastSave>=1000){persist();lastSave=now;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);markers.forEach(marker=>marker.remove());silence();};
  },[map,data,update,persist,silence,network.title,network.colour,network.darkColour]);
  const path=data?.paths.find(path=>path.direction===direction),indexed=useMemo(()=>path?indexBusTrack(path):null,[path]);
  const station=path?platformAt(path,telemetry):null,next=path?.stations[telemetry.nextStop];
  const overview=()=>{if(!map||!path)return;unfollow();const xs=path.coordinates.map(c=>c[0]),ys=path.coordinates.map(c=>c[1]);map.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:70,pitch:0,bearing:0,duration:600});};
  const follow=()=>{followRef.current=!followRef.current;setFollowing(followRef.current);if(followRef.current)map?.jumpTo({zoom:18});};
  const reset=()=>{if(!path)return;motion.current=busDeparture(path,departureId.current);keys.current.clear();pausedRef.current=false;setPaused(false);setTelemetry({...motion.current});persist();};
  const configure=()=>{persist();keys.current.clear();silence();activeRef.current=false;pausedRef.current=false;setActive(false);setPaused(false);if(path)preview(path,departureId.current);};
  const tunnel=indexed?sampleBusTrack(indexed,telemetry.km).underground:false;
  return <main data-driving={active} className={`bus-shell${network.id==='peshawar-brt'?' bus-shell-zu':''}`}>
    <header className="bus-header"><Link href={network.href} className="bus-brand"><span><DoubleBusIcon size={23}/></span><div><h1>{network.title}</h1><p>{network.subtitle}</p></div></Link><nav aria-label="Transport modes"><Link href="/">Road <ArrowUpRight size={13}/></Link><Link href="/rail">Pakistan Rail <ArrowUpRight size={13}/></Link><Link href="/metro">Orange Line <ArrowUpRight size={13}/></Link></nav></header>
    <div className="bus-layout">
      <MobileCabPanel speed={telemetry.velocity} active={active} paused={paused} onPause={setPause} onFollow={follow} onSound={toggle} following={following} sound={enabled && started} onOverview={overview} status={telemetry.doorsOpen ? `Doors open | ${telemetry.automatic ? Math.ceil(telemetry.dwellSeconds) + 's dwell' : 'power locked'}` : `${telemetry.automatic ? 'Auto stops' : 'Manual'} | ${next ? Math.max(0, (next.km - telemetry.km) * 1000).toFixed(0) + ' m to platform' : 'Terminal'}`}>
      {path?<BusCab network={network} path={path} motion={telemetry} ready={!!map&&!error} active={active} paused={paused} following={following} stationId={stationId} direction={direction} sound={enabled} soundStarted={started} audioError={audioError} volume={volume} onVolume={setVolume} onStation={id=>preview(path,id)} onDirection={value=>{const selected=data!.paths.find(p=>p.direction===value)!;preview(selected,stationId===path.stations[0].id?selected.stations[0].id:stationId);}} onStart={start} onPause={setPause} onReset={reset} onConfigure={configure} onFollow={follow} onAutomatic={automatic} onDoors={doors} onSound={toggle} onHorn={announce} onKey={setKey}/>:<aside className="bus-cab"><LoaderCircle className="animate-spin"/> Loading bus cab…</aside>}
      </MobileCabPanel>
      <section className="bus-map-panel" aria-label={`${network.title} map`}>
        {token&&path&&<BusMap colour={network.colour} darkColour={network.darkColour} path={path} attribution={data!.attribution} token={token} onReady={onReady} onFailure={onFailure} onInteraction={unfollow}/>}
        <div className="bus-map-top"><span>{tunnel?'BUSWAY UNDERPASS':'DEDICATED BUS CORRIDOR'} · {network.stations.length} STATIONS</span><button onClick={overview} disabled={!map}><MapIcon size={15}/> Line overview</button></div>
        {(!token||error)?<div className="bus-map-message" role="alert"><h2>{!token?'Connect Mapbox':'Bus map unavailable'}</h2><p>{!token?'Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local and restart the server.':error}</p><button onClick={()=>window.location.reload()}>Retry</button></div>:!map&&<div className="bus-map-message" role="status"><LoaderCircle className="animate-spin"/><p>Loading {network.title}…</p></div>}
        {path&&<div className="bus-journey-strip"><div><span>{station?'AT STATION':'NEXT PLATFORM'}</span><strong>{station?.name??next?.name??path.destination}</strong><p>{network.corridor}</p></div><div className="bus-strip-distance"><strong>{Math.max(0,path.distanceKm-telemetry.km).toFixed(1)} <small>km</small></strong><span>TO {path.destination.toUpperCase()}</span></div><progress aria-label="Metrobus journey progress" max={path.distanceKm} value={telemetry.km}/></div>}
      </section>
    </div>
    {path&&<footer className="bus-route-ribbon" aria-label={`${network.title} station sequence`}>{path.stations.map((s,index)=><div key={s.id} className={`${s.km<telemetry.km-.025?'bus-stop-passed':''} ${station?.id===s.id?'bus-stop-current':''}`}><span>{String(index+1).padStart(2,'0')}</span><strong>{s.name}</strong>{s.underground&&<small>UNDERGROUND</small>}</div>)}</footer>}
    {active && <TouchDpad mode="transit" sessionActive={active} active={active && !paused} onAccelerate={pressed => setKey('w', pressed)} onBrake={pressed => setKey('s', pressed)} upDisabled={telemetry.doorsOpen} onDoors={doors} doorsOpen={telemetry.doorsOpen} doorsDisabled={!station && !telemetry.doorsOpen} onAutomatic={automatic} automaticActive={telemetry.automatic} onHorn={pressed => { if (pressed) announce(); }} hornDisabled={!enabled || !started || paused} />}
  </main>;
}
