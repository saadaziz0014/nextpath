'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BusAudio, type BusInput } from '@/lib/audio/bus';
export function useBusAudio() {
  const engine=useRef<BusAudio|null>(null),mounted=useRef(false),enabledRef=useRef(true),volumeRef=useRef(.45);
  const input=useRef<BusInput>({speedKmh:0,traction:false,braking:false,audible:false});
  const [enabled,setEnabled]=useState(true),[started,setStarted]=useState(false),[error,setError]=useState(''),[volume,setVolumeState]=useState(.45);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;const old=engine.current;engine.current=null;void old?.dispose().catch(()=>{});};},[]);
  const unlock=useCallback(()=>{if(!enabledRef.current)return;try{if(!engine.current){engine.current=new BusAudio(new AudioContext());engine.current.setVolume(volumeRef.current);}const audio=engine.current;void audio.start().then(()=>{if(mounted.current&&engine.current===audio){setStarted(true);setError('');}}).catch(()=>{if(mounted.current)setError('Use Sound to enable bus audio.');});}catch{setError('Bus sound is unavailable in this browser.');}},[]);
  const update=useCallback((value:BusInput)=>{input.current=value;engine.current?.update({...value,audible:value.audible&&enabledRef.current});},[]);
  const silence=useCallback(()=>{engine.current?.update({...input.current,audible:false});},[]);
  const horn=useCallback(()=>{if(enabledRef.current)engine.current?.horn();},[]);
  const toggle=useCallback(()=>{if(!started||!enabledRef.current){enabledRef.current=true;setEnabled(true);unlock();}else{enabledRef.current=false;setEnabled(false);silence();}},[started,unlock,silence]);
  const setVolume=useCallback((value:number)=>{const safe=Math.max(0,Math.min(1,Number.isFinite(value)?value:0));volumeRef.current=safe;setVolumeState(safe);engine.current?.setVolume(safe);},[]);
  return {enabled,started,error,volume,setVolume,unlock,update,silence,horn,toggle};
}
