'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ElectricAudio, type ElectricInput } from '@/lib/audio/electric';
export function useMetroAudio() {
  const engine=useRef<ElectricAudio|null>(null),mounted=useRef(false),enabledRef=useRef(true);
  const input=useRef<ElectricInput>({speedKmh:0,traction:false,braking:false,audible:false});
  const [enabled,setEnabled]=useState(true),[started,setStarted]=useState(false),[error,setError]=useState('');
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;const old=engine.current;engine.current=null;void old?.dispose().catch(()=>{});};},[]);
  const unlock=useCallback(()=>{if(!enabledRef.current)return;try{engine.current??=new ElectricAudio(new AudioContext());const audio=engine.current;void audio.start().then(()=>{if(mounted.current&&engine.current===audio){setStarted(true);setError('');}}).catch(()=>{if(mounted.current)setError('Use Sound to enable metro audio.');});}catch{setError('Electric sound is unavailable in this browser.');}},[]);
  const update=useCallback((value:ElectricInput)=>{input.current=value;engine.current?.update({...value,audible:value.audible&&enabledRef.current});},[]);
  const silence=useCallback(()=>{engine.current?.update({...input.current,audible:false});},[]);
  const chime=useCallback(()=>{if(enabledRef.current)engine.current?.chime();},[]);
  const toggle=useCallback(()=>{if(!started||!enabledRef.current){enabledRef.current=true;setEnabled(true);unlock();}else{enabledRef.current=false;setEnabled(false);silence();}},[started,unlock,silence]);
  return {enabled,started,error,unlock,update,silence,chime,toggle};
}
