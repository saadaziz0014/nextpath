'use client';
import { Gauge, Zap, DoorOpen, DoorClosed, Play, Pause, RotateCcw, LocateFixed, Volume2, VolumeX, Bell, ArrowRight, TrainFront } from 'lucide-react';
import { transitJourneyFinished } from '@/lib/transit/stops';
import type { MetroMotion } from '@/lib/metro/motion';
import { METRO_BRAKE, platformAt } from '@/lib/metro/motion';
import type { MetroDirection, MetroPath } from '@/lib/metro/types';
interface Props {path:MetroPath;motion:MetroMotion;ready:boolean;active:boolean;paused:boolean;following:boolean;stationId:string;direction:MetroDirection;sound:boolean;soundStarted:boolean;audioError:string;onStation:(id:string)=>void;onDirection:(direction:MetroDirection)=>void;onStart:()=>void;onPause:()=>void;onReset:()=>void;onConfigure:()=>void;onFollow:()=>void;onAutomatic:()=>void;onDoors:()=>void;onSound:()=>void;onChime:()=>void;onKey:(key:string,pressed:boolean)=>void}
export default function MetroCab(p:Props) {
  const station=platformAt(p.path,p.motion),next=p.path.stations[p.motion.nextStop];
  const finished=p.active&&transitJourneyFinished(p.path,p.motion);
  const eligible=p.path.stations.find(s=>s.id===p.stationId)?.km!==p.path.distanceKm;
  const hold=(key:string)=>({onPointerDown:(event:React.PointerEvent<HTMLButtonElement>)=>{event.currentTarget.setPointerCapture(event.pointerId);p.onKey(key,true);},onPointerUp:()=>p.onKey(key,false),onPointerCancel:()=>p.onKey(key,false),onLostPointerCapture:()=>p.onKey(key,false)});
  return <aside className="metro-cab" aria-label="Orange Line metro cab">
    <div className="metro-cab-heading"><span className="metro-kicker">DRIVER CONSOLE</span><TrainFront size={22}/></div>
    <div className="metro-destination"><span>BOUND FOR</span><h2>{p.path.destination}</h2><p><Zap size={13}/> Electric multiple unit · 5 cars</p></div>
    {!p.active?<div className="metro-departure">
      <label htmlFor="metro-direction">Direction</label><select id="metro-direction" value={p.direction} onChange={event=>p.onDirection(event.target.value as MetroDirection)}><option value="dera-gujran">Towards Dera Gujran</option><option value="ali-town">Towards Ali Town</option></select>
      <label htmlFor="metro-start">Starting platform</label><select id="metro-start" value={p.stationId} onChange={event=>p.onStation(event.target.value)}>{p.path.stations.map(s=><option key={s.id} value={s.id}>{s.name}{s.km===p.path.distanceKm?' · destination':''}</option>)}</select>
      {!eligible&&<p className="metro-hint">Select the other direction to leave this terminal.</p>}
      <button className="metro-primary" disabled={!p.ready||!eligible} onClick={p.onStart}>Enter driver cab <ArrowRight size={17}/></button>
    </div>:<div className="metro-platform-display" aria-live="polite"><span>{finished?'TERMINAL ARRIVAL':station?'AT PLATFORM':'NEXT STATION'}</span><strong>{finished?p.path.destination:station?.name??next?.name??p.path.destination}</strong><p>{p.motion.doorsOpen?(p.motion.automatic&&!finished?`Doors open · ${Math.ceil(p.motion.dwellSeconds)}s dwell`:'Doors open · traction interlocked'):next?`${Math.max(0,(next.km-p.motion.km)*1000).toFixed(0)} m ahead`:'Journey complete'}</p></div>}
    <div className="metro-speedometer"><div className="metro-speed-arc" style={{'--metro-speed':`${Math.min(78,p.motion.velocity*3.6/80*78)}%`} as React.CSSProperties}><div><strong>{(p.motion.velocity*3.6).toFixed(0)}</strong><span>km/h</span></div></div><p><Gauge size={14}/> 80 km/h limit</p></div>
    <div className="metro-system-status"><span className={p.motion.doorsOpen?'metro-status-warning':'metro-status-good'}>{p.motion.doorsOpen?<DoorOpen size={14}/>:<DoorClosed size={14}/>} {p.motion.doorsOpen?'DOORS OPEN':'DOORS CLOSED'}</span><span>{p.motion.automatic?'ATO ACTIVE':'MANUAL DRIVE'}</span></div>
    <div className="metro-traction-buttons"><button {...hold('w')} disabled={!p.ready||!p.active||p.paused||p.motion.doorsOpen||finished} className="metro-traction"><Zap size={18}/> W · Power</button><button {...hold('s')} disabled={!p.ready||!p.active||p.paused} className="metro-brake">S · Brake</button></div>
    <p className="metro-hint">Hold W to power, S to brake. Release to coast. Braking distance ≈ {(p.motion.velocity**2/(2*METRO_BRAKE)).toFixed(0)} m.</p>
    <div className="metro-action-grid"><button disabled={!p.active||p.paused||!station} aria-pressed={p.motion.doorsOpen} onClick={p.onDoors}>{p.motion.doorsOpen?<DoorClosed size={17}/>:<DoorOpen size={17}/>} O · {p.motion.doorsOpen?'Close doors':'Open doors'}</button><button disabled={!p.active} aria-keyshortcuts="T" aria-pressed={p.motion.automatic} onClick={p.onAutomatic}><Gauge size={17}/> T · {p.motion.automatic?'Manual drive':'Auto stops'}</button><button disabled={!p.active} onClick={p.onPause}>{p.paused?<Play size={17}/>:<Pause size={17}/>} {p.paused?'Resume':'Pause'}</button><button disabled={!p.ready} aria-pressed={p.following} onClick={p.onFollow}><LocateFixed size={17}/> {p.following?'Following':'Follow cab'}</button></div>
    <p className="metro-hint">T switches Manual / Auto stops, including while paused. Auto opens doors for 12 seconds. In manual mode, brake with S and use O for doors. W/S overrides auto driving; power needs closed doors.</p>
    <div className="metro-utility"><button onClick={p.onSound}>{p.sound?<Volume2 size={16}/>:<VolumeX size={16}/>} {!p.soundStarted||!p.sound?'Enable sound':'Mute'}</button><button disabled={!p.active||p.paused||!p.sound} onClick={p.onChime}><Bell size={16}/> H · Chime</button><button disabled={!p.active} aria-label="Reset metro journey" onClick={p.onReset}><RotateCcw size={16}/></button></div>
    {p.audioError&&<p className="metro-hint" role="status">{p.audioError}</p>}
    <p className="metro-hint">Synthesized inverter and rolling sound · no diesel engine.</p>
    {p.active&&<button className="metro-new-trip" onClick={p.onConfigure}>Choose a new metro journey</button>}
    <p className="metro-save-note">Metro progress saves separately. Refresh restores paused.</p>
  </aside>;
}
