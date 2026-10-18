'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Marker, type Map as MapboxMap } from 'mapbox-gl';
import { ArrowUpRight, LoaderCircle, TrainFront, Map as MapIcon } from 'lucide-react';
import { metroDeparture, platformAt, stepMetro, toggleMetroDoors, toggleMetroAutomatic, type MetroMotion } from '@/lib/metro/motion';
import { indexMetroTrack, sampleMetroTrack, validateMetroDataset } from '@/lib/metro/track';
import { METRO_SAVE_KEY, restoreMetroSave, type MetroSave } from '@/lib/metro/persistence';
import { metroConsist, metroCarSvg } from '@/lib/metro/consist';
import { type MetroDataset, type MetroDirection, type MetroPath } from '@/lib/metro/types';
import { smoothBearing } from '@/lib/simulation';
import { isTransitShortcut, transitCommand } from '@/lib/transit/controls';
import { useMetroAudio } from '@/app/hooks/useMetroAudio';
import MetroCab from './MetroCab';
import TouchDpad from './TouchDpad';
import MobileCabPanel from './MobileCabPanel';
const MetroMap=dynamic(()=>import('./MetroMap'),{ssr:false});
const initial:MetroMotion={km:0,velocity:0,doorsOpen:false,dwellSeconds:0,nextStop:1,automatic:false};

export default function MetroSimulator() {
  // Public Mapbox token: set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local.
  const token=process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [data,setData]=useState<MetroDataset|null>(null),[error,setError]=useState('');
  const [map,setMap]=useState<MapboxMap|null>(null);
  const [direction,setDirection]=useState<MetroDirection>('dera-gujran'),[stationId,setStationId]=useState('ol-1');
  const [telemetry,setTelemetry]=useState<MetroMotion>(initial),[active,setActive]=useState(false),[paused,setPaused]=useState(false),[following,setFollowing]=useState(true);
  const dataRef=useRef<MetroDataset|null>(null),trackRef=useRef<ReturnType<typeof indexMetroTrack>|null>(null);
  const departureId=useRef('ol-1'),motion=useRef<MetroMotion>({...initial}),keys=useRef(new Set<string>());
  const activeRef=useRef(false),pausedRef=useRef(false),followRef=useRef(true);
  const {enabled,started,error:audioError,unlock,update,silence,chime,toggle}=useMetroAudio();
  const persist=useCallback(()=>{
    const dataset=dataRef.current,track=trackRef.current;if(!dataset||!track||!activeRef.current)return;
    const value:MetroSave={version:1,fingerprint:dataset.fingerprint,direction:track.path.direction,stationId:departureId.current,motion:{...motion.current},following:followRef.current};
    try{localStorage.setItem(METRO_SAVE_KEY,JSON.stringify(value));}catch{/* Storage failure must not interrupt driving. */}
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/data/metro/orange-line.json',{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw Error('Orange Line track could not be loaded.');
      const dataset=validateMetroDataset(await response.json());if(controller.signal.aborted)return;
      dataRef.current=dataset;const origin=dataset.paths[0];trackRef.current=indexMetroTrack(origin);motion.current=metroDeparture(origin,origin.stations[0].id);
      try{const raw=localStorage.getItem(METRO_SAVE_KEY);if(raw){const saved=restoreMetroSave(raw,dataset);trackRef.current=indexMetroTrack(saved.path);motion.current={...saved.value.motion};departureId.current=saved.value.stationId;activeRef.current=true;pausedRef.current=true;followRef.current=saved.value.following;setDirection(saved.value.direction);setStationId(saved.value.stationId);setActive(true);setPaused(true);setFollowing(saved.value.following);}}
      catch{try{localStorage.removeItem(METRO_SAVE_KEY);}catch{}}
      setTelemetry({...motion.current});setData(dataset);
    }).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Metro loading failed.');});
    return()=>controller.abort();
  },[]);
  const setPause=useCallback(()=>{if(!activeRef.current)return;pausedRef.current=!pausedRef.current;keys.current.clear();setPaused(pausedRef.current);if(pausedRef.current)silence();else unlock();persist();},[silence,unlock,persist]);
  useEffect(()=>{
    const hide=()=>{if(document.hidden){keys.current.clear();pausedRef.current=true;setPaused(true);silence();}persist();};
    const blur=()=>keys.current.clear();
    window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',hide);window.addEventListener('blur',blur);
    return()=>{persist();window.removeEventListener('pagehide',persist);document.removeEventListener('visibilitychange',hide);window.removeEventListener('blur',blur);};
  },[persist,silence]);
  const preview=useCallback((path:MetroPath,id:string)=>{
    if(activeRef.current)return;const station=path.stations.find(s=>s.id===id);if(!station)return;
    trackRef.current=indexMetroTrack(path);departureId.current=id;
    motion.current={...initial,km:station.km,nextStop:path.stations.indexOf(station)+1};
    setDirection(path.direction);setStationId(id);setTelemetry({...motion.current});
  },[]);
  const start=useCallback(()=>{
    const track=trackRef.current;if(!map||!track||error)return;
    try{motion.current=metroDeparture(track.path,departureId.current);keys.current.clear();activeRef.current=true;pausedRef.current=false;followRef.current=true;setActive(true);setPaused(false);setFollowing(true);setTelemetry({...motion.current});unlock();persist();}
    catch(cause){setError(cause instanceof Error?cause.message:'Metro departure failed.');}
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
    const changed=toggleMetroDoors(track.path,motion.current);if(changed!==motion.current){motion.current=changed;keys.current.clear();unlock();chime();setTelemetry({...changed});persist();}
  },[unlock,chime,persist]);
  const automatic=useCallback(()=>{
    const track=trackRef.current;if(!track||!activeRef.current)return;
    // Mode may be selected while paused; movement still waits for Resume.
    keys.current.clear();motion.current=toggleMetroAutomatic(track.path,motion.current);
    setTelemetry({...motion.current});unlock();persist();
  },[unlock,persist]);
  const announce=useCallback(()=>{if(!activeRef.current||pausedRef.current)return;unlock();chime();},[unlock,chime]);
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
    const markers=Array.from({length:5},(_,index)=>{
      const element=document.createElement('div');element.style.cssText='width:14px;height:38px;pointer-events:none;filter:drop-shadow(0 2px 2px #0006)';element.innerHTML=metroCarSvg(index);element.dataset.metroCar=String(index);element.setAttribute('role','img');element.setAttribute('aria-label',`Orange Line electric car ${index+1}`);
      return new Marker({element,rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(trackRef.current!.path.coordinates[0]).addTo(map);
    });
    let frame=0,previous=0,lastUI=0,lastSave=0,cameraBearing=map.getBearing();
    const tick=(now:number)=>{
      // One requestAnimationFrame drives train, sound and camera. Physics uses
      // elapsed time, capped after backgrounding, while React receives only
      // lightweight 10 Hz telemetry. The Map component stays memoized.
      const seconds=previous?(now-previous)/1000:0;previous=now;
      const track=trackRef.current;if(!track)return;
      const oldDoors=motion.current.doorsOpen;
      if(activeRef.current&&!pausedRef.current&&!document.hidden)motion.current=stepMetro(motion.current,keys.current,seconds,track.path);
      if(oldDoors!==motion.current.doorsOpen&&activeRef.current&&!pausedRef.current)chime();
      update({speedKmh:motion.current.velocity*3.6,traction:keys.current.has('w')||motion.current.automatic,braking:keys.current.has('s'),audible:activeRef.current&&!pausedRef.current&&!document.hidden});
      const sample=sampleMetroTrack(track,motion.current.km);
      // Each EMU car samples its own track chainage and Turf bearing. Small,
      // projected coupling gaps preserve the articulated train around bends.
      const metresPerPixel=156543.03392*Math.cos(sample.position[1]*Math.PI/180)/2**map.getZoom();
      const height=Math.min(90,Math.max(38,20/metresPerPixel));
      const probeKm=Math.min(.02,Math.max(.001,motion.current.km));
      const center=map.project(sample.position),probe=map.project(sampleMetroTrack(track,Math.max(0,motion.current.km-probeKm)).position);
      const pixels=Math.hypot(center.x-probe.x,center.y-probe.y),bounds=markers[0].getElement().getBoundingClientRect();
      const rendered=.92*Math.hypot(bounds.width,bounds.height);
      const spacing=pixels>.01&&rendered>0?probeKm*(rendered+1)/pixels:(height+1)*metresPerPixel/1000;
      metroConsist(track,motion.current.km,spacing).forEach(car=>{const marker=markers[car.index],element=marker.getElement();marker.setLngLat(car.position).setRotation(car.index===4?car.heading+180:car.heading);element.style.visibility=car.visible?'visible':'hidden';element.style.height=height+'px';element.style.width=height*28/76+'px';});
      cameraBearing=smoothBearing(cameraBearing,sample.heading,1-Math.exp(-Math.min(seconds,.1)*6));
      if(followRef.current)map.jumpTo({center:sample.position,bearing:cameraBearing,pitch:48});
      if(now-lastUI>=100){setTelemetry({...motion.current});lastUI=now;}
      if(now-lastSave>=1000){persist();lastSave=now;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);markers.forEach(marker=>marker.remove());silence();};
  },[map,data,chime,update,persist,silence]);
  const path=data?.paths.find(path=>path.direction===direction),indexed=useMemo(()=>path?indexMetroTrack(path):null,[path]);
  const station=path?platformAt(path,telemetry):null,next=path?.stations[telemetry.nextStop];
  const overview=()=>{if(!map||!path)return;unfollow();const xs=path.coordinates.map(c=>c[0]),ys=path.coordinates.map(c=>c[1]);map.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:70,pitch:0,bearing:0,duration:600});};
  const follow=()=>{followRef.current=!followRef.current;setFollowing(followRef.current);if(followRef.current)map?.jumpTo({zoom:17});};
  const reset=()=>{if(!path)return;motion.current=metroDeparture(path,departureId.current);keys.current.clear();pausedRef.current=false;setPaused(false);setTelemetry({...motion.current});persist();};
  const configure=()=>{persist();keys.current.clear();silence();activeRef.current=false;pausedRef.current=false;setActive(false);setPaused(false);if(path)preview(path,departureId.current);};
  const tunnel=indexed?sampleMetroTrack(indexed,telemetry.km).underground:false;
  return <main className="metro-shell" data-driving={active}>
    <header className="metro-header"><Link href="/metro" className="metro-brand"><span><TrainFront size={23}/></span><div><h1>Orange Line</h1><p>LAHORE METRO · ELECTRIC</p></div></Link><nav aria-label="Transport modes"><Link href="/">Road <ArrowUpRight size={13}/></Link><Link href="/rail">Pakistan Rail <ArrowUpRight size={13}/></Link><Link href="/metrobus">Metrobus <ArrowUpRight size={13}/></Link></nav></header>
    <div className="metro-layout">
      <MobileCabPanel speed={telemetry.velocity} active={active} paused={paused} onPause={setPause} onFollow={follow} onSound={toggle} following={following} sound={enabled && started} onOverview={overview} status={telemetry.doorsOpen ? `Doors open | ${telemetry.automatic ? Math.ceil(telemetry.dwellSeconds) + 's dwell' : 'power locked'}` : `${telemetry.automatic ? 'Auto stops' : 'Manual'} | ${next ? Math.max(0, (next.km - telemetry.km) * 1000).toFixed(0) + ' m to platform' : 'Terminal'}`}>
      {path?<MetroCab path={path} motion={telemetry} ready={!!map&&!error} active={active} paused={paused} following={following} stationId={stationId} direction={direction} sound={enabled} soundStarted={started} audioError={audioError} onStation={id=>preview(path,id)} onDirection={value=>{const selected=data!.paths.find(p=>p.direction===value)!;preview(selected,stationId===path.stations[0].id?selected.stations[0].id:stationId);}} onStart={start} onPause={setPause} onReset={reset} onConfigure={configure} onFollow={follow} onAutomatic={automatic} onDoors={doors} onSound={toggle} onChime={announce} onKey={setKey}/>:<aside className="metro-cab"><LoaderCircle className="animate-spin"/> Loading metro cab…</aside>}
      </MobileCabPanel>
      <section className="metro-map-panel" aria-label="Lahore Orange Line map">
        {token&&path&&<MetroMap path={path} attribution={data!.attribution} token={token} onReady={onReady} onFailure={onFailure} onInteraction={unfollow}/>}
        <div className="metro-map-top"><span>{tunnel?'UNDERGROUND SECTION':'ELEVATED LINE'} · 26 STATIONS</span><button onClick={overview} disabled={!map}><MapIcon size={15}/> Line overview</button></div>
        {(!token||error)?<div className="metro-map-message" role="alert"><h2>{!token?'Connect Mapbox':'Metro map unavailable'}</h2><p>{!token?'Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local and restart the server.':error}</p><button onClick={()=>window.location.reload()}>Retry</button></div>:!map&&<div className="metro-map-message" role="status"><LoaderCircle className="animate-spin"/><p>Loading Lahore metro…</p></div>}
        {path&&<div className="metro-journey-strip"><div><span>{station?'AT STATION':'NEXT PLATFORM'}</span><strong>{station?.name??next?.name??path.destination}</strong><p>{station?.underground?'Underground platform':next?.underground?'Approaching underground platform':'Orange Line · Lahore'}</p></div><div className="metro-strip-distance"><strong>{Math.max(0,path.distanceKm-telemetry.km).toFixed(1)} <small>km</small></strong><span>TO {path.destination.toUpperCase()}</span></div><progress aria-label="Metro line progress" max={path.distanceKm} value={telemetry.km}/></div>}
      </section>
    </div>
    {path&&<footer className="metro-route-ribbon" aria-label="Orange Line station sequence">{path.stations.map((s,index)=><div key={s.id} className={`${s.km<telemetry.km-.025?'metro-stop-passed':''} ${station?.id===s.id?'metro-stop-current':''}`}><span>{String(index+1).padStart(2,'0')}</span><strong>{s.name}</strong>{s.underground&&<small>UNDERGROUND</small>}</div>)}</footer>}
    {active && <TouchDpad mode="transit" sessionActive={active} active={active && !paused} onAccelerate={pressed => setKey('w', pressed)} onBrake={pressed => setKey('s', pressed)} upDisabled={telemetry.doorsOpen} onDoors={doors} doorsOpen={telemetry.doorsOpen} doorsDisabled={!station && !telemetry.doorsOpen} onAutomatic={automatic} automaticActive={telemetry.automatic} onHorn={pressed => { if (pressed) announce(); }} hornDisabled={!enabled || !started || paused} />}
  </main>;
}
