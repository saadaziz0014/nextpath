import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BusAudio,busAudioInput,busProfile,type BusInput} from '../lib/audio/bus';
import type {BusMotion} from '../lib/bus/motion';
import {audioHarness} from './helpers/audioHarness';
const audible:BusInput={speedKmh:0,traction:false,braking:false,audible:true,doorsOpen:false};
const moving:BusMotion={km:1,velocity:10,doorsOpen:false,dwellSeconds:0,nextStop:2,automatic:true};

test('bus combustion rises under load, drops on shifts, and holds gears across small speed fluctuations',()=>{
  assert.ok(busProfile({...audible,traction:true}).rpm>busProfile(audible).rpm);
  assert.ok(busProfile({...audible,speedKmh:14}).rpm>busProfile({...audible,speedKmh:16}).rpm);
  assert.equal(busProfile({...audible,speedKmh:15.4},1).gear,1);
  const shifted=busProfile({...audible,speedKmh:16},1);assert.equal(shifted.gear,2);
  assert.equal(busProfile({...audible,speedKmh:14},shifted.gear).gear,2);
  assert.equal(busProfile({...audible,speedKmh:12},shifted.gear).gear,1);
  assert.equal(busProfile({...audible,speedKmh:0},6).gear,1);
});

test('idle, rolling, turbo and brake layers respond separately, and doors block engine load',()=>{
  const idle=busProfile(audible),power=busProfile({...audible,speedKmh:40,traction:true}),coast=busProfile({...audible,speedKmh:40}),brake=busProfile({...audible,speedKmh:40,traction:true,braking:true});
  assert.ok(idle.engineGain>0);assert.equal(idle.rollingGain,0);assert.equal(idle.turboGain,0);
  assert.ok(power.engineGain>coast.engineGain);assert.ok(power.turboGain>0);assert.ok(power.intakeGain>0);
  assert.ok(brake.engineGain<coast.engineGain);assert.ok(brake.brakeGain>0);assert.equal(brake.turboGain,0);assert.equal(brake.intakeGain,0);
  assert.ok(power.rollingGain>busProfile({...audible,speedKmh:10}).rollingGain);
  const doors=busProfile({...audible,doorsOpen:true,traction:true});assert.equal(doors.rpm,idle.rpm);assert.equal(doors.engineGain,idle.engineGain);assert.equal(doors.intakeGain,0);
  const silent=busProfile({...audible,speedKmh:60,traction:true,braking:true,audible:false});
  for(const [key,value]of Object.entries(silent))if(key.endsWith('Gain'))assert.equal(value,0);
  for(const speedKmh of [NaN,Infinity,-20,1000])for(const value of Object.values(busProfile({...audible,speedKmh})))assert.ok(Number.isFinite(value));
});

test('automatic bus audio follows acceleration and station braking, rather than the mode flag',()=>{
  assert.equal(busAudioInput(moving,{...moving,velocity:11},new Set(),true).traction,true);
  const brake=busAudioInput(moving,{...moving,velocity:9},new Set(),true);assert.equal(brake.braking,true);assert.equal(brake.traction,false);
  const cruise=busAudioInput(moving,moving,new Set(),true);assert.equal(cruise.braking,false);assert.equal(cruise.traction,false);
  const dwell={...moving,velocity:0,doorsOpen:true};assert.equal(busAudioInput(dwell,dwell,new Set(['w']),true).traction,false);
  const manual=busAudioInput(moving,{...moving,automatic:false},new Set(['w','s']),true);assert.equal(manual.braking,true);assert.equal(manual.traction,false);
  assert.equal(busAudioInput(moving,moving,new Set(),false).audible,false);
});

test('bus noise and harmonic waves are allocated once; repeated updates and horn reuse the graph',async()=>{
  const h=audioHarness(),audio=new BusAudio(h.context);await audio.start();
  const count=h.nodes.length,bufferCount=h.buffers.length;
  for(let i=0;i<600;i++){audio.update({...audible,speedKmh:i%60,traction:true});if(i%100===0)audio.horn();}
  assert.equal(h.nodes.length,count);assert.equal(h.buffers.length,bufferCount);assert.equal(h.buffers.length,1);
  assert.ok(h.nodes.filter(node=>node.kind==='filter').length>0);assert.ok(h.nodes.some(node=>node.kind==='compressor'));
  assert.ok(h.nodes.filter(node=>node.kind==='buffer-source').every(node=>node.loop));
  for(const samples of h.buffers){assert.ok(samples.some(value=>value!==0));assert.ok(samples.every(value=>Number.isFinite(value)&&Math.abs(value)<=1));}
  for(const wave of h.waves){assert.equal(wave.real[0],0);assert.equal(wave.imag[0],0);assert.ok(wave.imag.some(value=>value!==0));}
  await audio.dispose();await audio.dispose();assert.equal(h.closes(),1);
  for(const node of h.nodes){assert.equal(node.disconnects,1);if(node.kind==='oscillator'||node.kind==='buffer-source'){assert.equal(node.starts,1);assert.equal(node.stops,1);}}
  const events=h.parameters.reduce((total,p)=>total+p.events.length,0);audio.update(audible);audio.horn();audio.setVolume(1);await audio.start();
  assert.equal(h.parameters.reduce((total,p)=>total+p.events.length,0),events);assert.equal(h.resumes(),1);
});

test('door and braking air bursts trigger once; mute cancels all scheduled air and horn audio',async()=>{
  const h=audioHarness(),audio=new BusAudio(h.context);
  audio.update({...audible,speedKmh:3,braking:true});h.advance(.1);
  audio.update({...audible,doorsOpen:true});
  const bursts=()=>h.parameters.flatMap(p=>p.events).filter(event=>event.method==='exponential').length;
  assert.ok(bursts()>0);const before=bursts();
  for(let i=0;i<60;i++)audio.update({...audible,doorsOpen:true});assert.equal(bursts(),before);
  h.advance(.1);audio.update(audible);assert.equal(bursts(),before+1);audio.horn();
  assert.ok(h.parameters.some(p=>p.scheduled.some(event=>event.time>h.context.currentTime)));
  audio.update({...audible,audible:false});
  assert.ok(h.parameters.every(p=>p.scheduled.every(event=>event.time<=h.context.currentTime)));
  const master=h.nodes.find(node=>node.kind==='gain'&&node.connections.some(target=>(target as {kind?:string}).kind==='compressor'))!;
  assert.ok(h.nodes.filter(node=>node.kind==='gain'&&node!==master).every(node=>node.gain.value===0));
  const events=h.parameters.reduce((total,p)=>total+p.events.length,0);audio.horn();assert.equal(h.parameters.reduce((total,p)=>total+p.events.length,0),events);
  audio.setVolume(.2);assert.equal(master.gain.value,.2);audio.setVolume(2);assert.equal(master.gain.value,1);audio.setVolume(NaN);assert.equal(master.gain.value,0);
  audio.update({...audible,speedKmh:1,braking:true});h.advance(.1);audio.update({...audible,speedKmh:.1});assert.equal(bursts(),before+2);
  await audio.dispose();
});
