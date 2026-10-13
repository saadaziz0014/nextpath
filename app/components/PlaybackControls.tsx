'use client';

import { Pause, Play, RotateCcw, LocateFixed, Car, Film } from 'lucide-react';
import { SPEED_OPTIONS, type PlaybackSpeed } from '@/lib/routeData';
import type { DrivingRoute } from '@/lib/routes';
import type { Turn } from '@/lib/roadNetwork';
import type { DriveKey } from '@/lib/driving';
import type { SimulationMode } from '@/app/hooks/useVehicleSimulation';
import type { RoadLevel } from '@/lib/roadLevel';
import RoadLevelIndicator from './RoadLevelIndicator';
interface Props {
  freeDriving: boolean; turnLocked: boolean;
  roadLevel: RoadLevel | null;
  pendingTurn: Turn | null; junctionHint: string; roadName: string; roadsReady: boolean; onStraight: () => void;
  mode: SimulationMode; active: boolean; speed: PlaybackSpeed; ready: boolean; following: boolean;
  route: DrivingRoute | null; speedKmh: number; traveledKm: number; remainingKm: number | null; progress: number; arrived: boolean; position: [number, number];
  onMode: (mode: SimulationMode) => void; onToggle: () => void; onReset: () => void;
  onSpeed: (speed: PlaybackSpeed) => void; onFollow: () => void; onKey: (key: DriveKey, pressed: boolean) => void;
}
function DriveButton({ driveKey, label, disabled, onKey }: { driveKey: DriveKey; label: string; disabled: boolean; onKey: Props['onKey'] }) {
  return <button disabled={disabled} aria-label={label} className="h-9 w-12 touch-none select-none rounded-lg border border-slate-600 bg-slate-800 text-sm font-bold text-slate-200 hover:border-sky-400 active:bg-sky-500 active:text-slate-950 disabled:opacity-40"
    onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onKey(driveKey, true); }}
    onPointerUp={() => onKey(driveKey, false)} onPointerCancel={() => onKey(driveKey, false)} onLostPointerCapture={() => onKey(driveKey, false)}
    onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); onKey(driveKey, true); } }}
    onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') onKey(driveKey, false); }}
    onBlur={() => onKey(driveKey, false)}>{driveKey.toUpperCase()}</button>;
}
export default function PlaybackControls(props: Props) {
  const { mode, active, speed, ready, following, route, speedKmh, traveledKm, remainingKm, progress, arrived, position, onMode, onToggle, onReset, onSpeed, onFollow, onKey, freeDriving, turnLocked, pendingTurn, junctionHint, roadName, roadsReady, onStraight } = props;
  return <section aria-label="Driving controls" className="glass absolute bottom-10 left-3 right-3 z-10 rounded-2xl p-4 sm:left-6 sm:right-auto sm:w-96">
    <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-950/60 p-1">
      <button aria-pressed={mode === 'drive'} onClick={() => onMode('drive')} className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold ${mode === 'drive' ? 'bg-slate-700 text-sky-300' : 'text-slate-400'}`}><Car size={16} />Manual drive</button>
      <button disabled={!route} aria-pressed={mode === 'playback'} onClick={() => onMode('playback')} className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold disabled:opacity-30 ${mode === 'playback' ? 'bg-slate-700 text-sky-300' : 'text-slate-400'}`}><Film size={16} />Route playback</button>
    </div>
    <div className="mb-3 flex items-center justify-between gap-3">
      <div><p className="text-xs text-slate-400">{!route && !freeDriving ? 'Choose free drive or build a route' : arrived ? 'Destination reached' : mode === 'drive' ? !roadsReady ? 'Loading connected roads…' : active ? 'You are at the wheel' : 'Driving paused' : active ? 'Following the road' : 'Playback paused'}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{Math.abs(speedKmh).toFixed(0)} <span className="text-xs font-normal text-slate-400">km/h {speedKmh < -.5 && '· reverse'}</span></p></div>
      <div className="text-right" aria-label="Distance covered"><p className="text-xs text-slate-400">Distance covered</p><p className="mt-1 text-2xl font-semibold tabular-nums text-sky-300">{traveledKm.toFixed(2)} <span className="text-xs font-normal text-slate-400">km</span></p>{remainingKm !== null && <p className="mt-1 text-[11px] text-slate-400">{remainingKm < 1 ? `${Math.round(remainingKm * 1000)} m` : `${remainingKm.toFixed(1)} km`} to destination <span className="text-[10px]">{mode === 'drive' ? '(direct)' : '(road)'}</span></p>}</div>
    </div>
    {mode === 'drive' && props.roadLevel && <RoadLevelIndicator level={props.roadLevel} />}
    <div className="mb-3 flex items-center gap-2">
      <button disabled={!ready} onClick={onToggle} aria-label={active ? mode === 'drive' ? 'Pause driving' : 'Pause playback' : mode === 'drive' ? 'Resume driving' : 'Play route'} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-400 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-40">{active ? <Pause size={16} /> : <Play size={16} />}{active ? 'Pause' : 'Resume'}</button>
      <button disabled={!ready} onClick={onReset} aria-label="Reset vehicle to start" className="rounded-xl border border-slate-600 p-2.5 disabled:opacity-40"><RotateCcw size={18} /></button>
      <button disabled={!ready} onClick={onFollow} aria-label="Follow car from behind" aria-pressed={following} className={`flex items-center gap-1.5 rounded-xl border p-2.5 text-xs disabled:opacity-40 ${following ? 'border-sky-400 text-sky-300' : 'border-slate-600 text-slate-400'}`}><LocateFixed size={18} /><span>Follow car</span></button>
    </div>
    {mode === 'drive' ? <div className="flex items-center justify-between gap-4"><div className="text-[11px] leading-5 text-slate-400"><p><b className="text-slate-200">W</b> accelerate · <b className="text-slate-200">S</b> brake / reverse</p><p className="text-sky-300">{turnLocked ? 'Turn selected · A / D locked until junction passed' : 'A / D: choose turn · Enter: straight'}</p><p className="text-slate-500">Hold W / S to drive.</p></div><div className="grid grid-cols-3 gap-1"><div /><DriveButton driveKey="w" label="Accelerate (hold W)" disabled={!ready || !active} onKey={onKey} /><div />{(['a', 's', 'd'] as const).map(key => <DriveButton key={key} driveKey={key} label={key === 'a' ? 'Choose left turn (A)' : key === 'd' ? 'Choose right turn (D)' : 'Brake or reverse (hold S)'} disabled={!ready || !active || (turnLocked && key !== 's')} onKey={onKey} />)}</div></div> : <div>
      <div className="mb-2 flex justify-between text-xs text-slate-400"><span>Route completion</span><span>{progress.toFixed(1)}%</span></div><div role="progressbar" aria-label="Route completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(progress.toFixed(1))} className="h-1.5 overflow-hidden rounded-full bg-slate-700"><div className="h-full bg-sky-400" style={{ width: `${progress}%` }} /></div>
      <label htmlFor="speed" className="mt-3 flex justify-between text-xs text-slate-400">Playback speed<span>{speed}× · 60 km/h base</span></label><input id="speed" className="mt-2 w-full accent-sky-400" type="range" min={0} max={3} step={1} value={SPEED_OPTIONS.indexOf(speed)} onChange={event => onSpeed(SPEED_OPTIONS[Number(event.target.value)])} aria-valuetext={`${speed} times speed`} />
    </div>}
    {mode === 'drive' && (route || freeDriving) && <div className="mt-3 border-t border-slate-700 pt-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="text-sky-300">Next turn: {pendingTurn ?? 'follow road'}</span><button disabled={!ready || !active || turnLocked} onClick={onStraight} className="rounded border border-slate-600 px-2 py-1 text-slate-300 disabled:opacity-40">Follow road</button></div><p role="status" className="mt-1 text-slate-400">{roadsReady ? junctionHint : 'Loading connected roads…'}</p>{roadName && <p className="mt-1 truncate text-slate-500">{roadName}</p>}</div>}
    <p className="mt-3 text-[10px] tabular-nums text-slate-500">{position[1].toFixed(6)}, {position[0].toFixed(6)} · {freeDriving ? 'Free drive · connected roads' : route ? 'Connected roads only' : 'Choose free drive or plan a route'}</p>
  </section>;
}






