'use client';
import { Gauge, Zap, DoorOpen, DoorClosed, Play, Pause, RotateCcw, LocateFixed, Volume2, VolumeX, Megaphone, ArrowRight, BusFront } from 'lucide-react';
import Link from 'next/link';
import { BUS_NETWORKS, type BusNetwork } from '@/lib/bus/networks';
import { transitJourneyFinished } from '@/lib/transit/stops';
import type { BusMotion } from '@/lib/bus/motion';
import { BUS_BRAKE, platformAt } from '@/lib/bus/motion';
import type { BusDirection, BusPath } from '@/lib/bus/types';
interface Props {network:BusNetwork;path:BusPath;motion:BusMotion;ready:boolean;active:boolean;paused:boolean;following:boolean;stationId:string;direction:BusDirection;sound:boolean;soundStarted:boolean;audioError:string;volume:number;onVolume:(value:number)=>void;onStation:(id:string)=>void;onDirection:(direction:BusDirection)=>void;onStart:()=>void;onPause:()=>void;onReset:()=>void;onConfigure:()=>void;onFollow:()=>void;onAutomatic:()=>void;onDoors:()=>void;onSound:()=>void;onHorn:()=>void;onKey:(key:string,pressed:boolean)=>void}
export default function BusCab(p:Props) {
  const station=platformAt(p.path,p.motion),next=p.path.stations[p.motion.nextStop];
  const finished=p.active&&transitJourneyFinished(p.path,p.motion);
  const eligible=p.path.stations.find(s=>s.id===p.stationId)?.km!==p.path.distanceKm;
  const hold=(key:string)=>({onPointerDown:(event:React.PointerEvent<HTMLButtonElement>)=>{event.currentTarget.setPointerCapture(event.pointerId);p.onKey(key,true);},onPointerUp:()=>p.onKey(key,false),onPointerCancel:()=>p.onKey(key,false),onLostPointerCapture:()=>p.onKey(key,false)});
  return <aside className="bus-cab" aria-label={`${p.network.title} driver cab`}>
    <nav className="bus-network-switch" aria-label="Metrobus networks">{Object.values(BUS_NETWORKS).map(n=><Link key={n.id} href={n.href} aria-current={n.id===p.network.id?'page':undefined}>{n.shortName}</Link>)}</nav>
    <div className="bus-cab-heading"><span className="bus-kicker">DRIVER CONSOLE</span><BusFront size={22}/></div>
    <div className="bus-destination"><span>BOUND FOR</span><h2>{p.path.destination}</h2><p><Zap size={13}/> {p.network.vehicleDescription}</p></div>
    {!p.active?<div className="bus-departure">
      <label htmlFor="bus-direction">Direction</label><select id="bus-direction" value={p.direction} onChange={event=>p.onDirection(event.target.value as BusDirection)}>{p.network.directions.map(d=><option key={d.id} value={d.id}>Towards {d.destination}</option>)}</select>
      <label htmlFor="bus-start">Starting station</label><select id="bus-start" value={p.stationId} onChange={event=>p.onStation(event.target.value)}>{p.path.stations.map(s=><option key={s.id} value={s.id}>{s.name}{s.km===p.path.distanceKm?' · destination':''}</option>)}</select>
      {!eligible&&<p className="bus-hint">Select the other direction to leave this terminal.</p>}
      <button className="bus-primary" disabled={!p.ready||!eligible} onClick={p.onStart}>Enter driver cab <ArrowRight size={17}/></button>
    </div>:<div className="bus-platform-display" aria-live="polite"><span>{finished?'TERMINAL ARRIVAL':station?'AT PLATFORM':'NEXT STATION'}</span><strong>{finished?p.path.destination:station?.name??next?.name??p.path.destination}</strong><p>{p.motion.doorsOpen?(p.motion.automatic&&!finished?`Doors open · ${Math.ceil(p.motion.dwellSeconds)}s dwell`:'Doors open · traction interlocked'):next?`${Math.max(0,(next.km-p.motion.km)*1000).toFixed(0)} m ahead`:'Journey complete'}</p></div>}
    <div className="bus-speedometer"><div className="bus-speed-arc" style={{'--bus-speed':`${Math.min(78,p.motion.velocity*3.6/60*78)}%`} as React.CSSProperties}><div><strong>{(p.motion.velocity*3.6).toFixed(0)}</strong><span>km/h</span></div></div><p><Gauge size={14}/> 60 km/h simulation limit</p></div>
    <div className="bus-system-status"><span className={p.motion.doorsOpen?'bus-status-warning':'bus-status-good'}>{p.motion.doorsOpen?<DoorOpen size={14}/>:<DoorClosed size={14}/>} {p.motion.doorsOpen?'DOORS OPEN':'DOORS CLOSED'}</span><span>{p.motion.automatic?'AUTO STOPS':'MANUAL DRIVE'}</span></div>
    <div className="bus-traction-buttons"><button {...hold('w')} disabled={!p.ready||!p.active||p.paused||p.motion.doorsOpen||finished} className="bus-traction"><Zap size={18}/> W · Accelerate</button><button {...hold('s')} disabled={!p.ready||!p.active||p.paused} className="bus-brake">S · Brake</button></div>
    <p className="bus-hint">Hold W to accelerate, S to brake. Release to coast. Braking distance ≈ {(p.motion.velocity**2/(2*BUS_BRAKE)).toFixed(0)} m.</p>
    <div className="bus-action-grid"><button disabled={!p.active||p.paused||!station} aria-pressed={p.motion.doorsOpen} onClick={p.onDoors}>{p.motion.doorsOpen?<DoorClosed size={17}/>:<DoorOpen size={17}/>} O · {p.motion.doorsOpen?'Close doors':'Open doors'}</button><button disabled={!p.active} aria-keyshortcuts="T" aria-pressed={p.motion.automatic} onClick={p.onAutomatic}><Gauge size={17}/> T · {p.motion.automatic?'Manual drive':'Auto stops'}</button><button disabled={!p.active} onClick={p.onPause}>{p.paused?<Play size={17}/>:<Pause size={17}/>} {p.paused?'Resume':'Pause'}</button><button disabled={!p.ready} aria-pressed={p.following} onClick={p.onFollow}><LocateFixed size={17}/> {p.following?'Following':'Follow cab'}</button></div>
    <p className="bus-hint">T switches Manual / Auto stops, including while paused. Auto opens doors for 12 seconds. In manual mode, brake with S and use O for doors. W/S overrides auto driving; power needs closed doors.</p>
    <div className="bus-utility"><button onClick={p.onSound}>{p.sound?<Volume2 size={16}/>:<VolumeX size={16}/>} {!p.soundStarted||!p.sound?'Enable sound':'Mute'}</button><button disabled={!p.active||p.paused||!p.sound} onClick={p.onHorn}><Megaphone size={16}/> H · Horn</button><button disabled={!p.active} aria-label="Reset bus journey" onClick={p.onReset}><RotateCcw size={16}/></button></div>
    <div className="bus-volume"><label htmlFor="bus-volume">Sound volume</label><input id="bus-volume" type="range" min="0" max="100" value={Math.round(p.volume*100)} aria-valuetext={Math.round(p.volume*100)+'%'} onChange={event=>p.onVolume(Number(event.target.value)/100)}/><output htmlFor="bus-volume">{Math.round(p.volume*100)}%</output></div>
    {p.audioError&&<p className="bus-hint" role="status">{p.audioError}</p>}
    <p className="bus-hint">Layered bus engine, gear shifts, tyre rumble and air brakes.</p>
    {p.active&&<button className="bus-new-trip" onClick={p.onConfigure}>Choose a new bus journey</button>}
    <p className="bus-save-note">Bus progress saves separately. Refresh restores paused.</p>
  </aside>;
}
