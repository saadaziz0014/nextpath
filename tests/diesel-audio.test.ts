import { test } from 'node:test';
import { RAIL_MAX_KMH } from '../lib/rail/physics';
import assert from 'node:assert/strict';
import { dieselTargets, DieselAudio, type DieselInput } from '../lib/audio/diesel';
const base: DieselInput = { speedKmh: 0, throttle: false, braking: false, active: true, paused: false };
test('diesel traction builds with speed and unloads while coasting or braking', () => {
  const idle = dieselTargets(base);
  const starting = dieselTargets({ ...base, throttle: true });
  const full = dieselTargets({ ...base, throttle: true, speedKmh: 90 });
  const coast = dieselTargets({ ...base, speedKmh: 90 });
  assert.ok(idle.firingHz < starting.firingHz && starting.firingHz < full.firingHz);
  assert.ok(coast.engineGain < full.engineGain);
  assert.deepEqual(dieselTargets({ ...base, speedKmh: 90, throttle: true, braking: true }), coast);
  assert.equal(idle.rollingGain, 0);
  assert.ok(full.rollingGain > 0);
});
test('inactive and paused trains are silent; invalid and excess speed are bounded', () => {
  assert.equal(dieselTargets({ ...base, paused: true }).audible, false);
  assert.equal(dieselTargets({ ...base, active: false }).audible, false);
  for (const speedKmh of [NaN, Infinity, -10]) assert.deepEqual(dieselTargets({ ...base, speedKmh }), dieselTargets(base));
  assert.deepEqual(dieselTargets({ ...base, speedKmh: 900 }), dieselTargets({ ...base, speedKmh: RAIL_MAX_KMH }));
});
test('audio reuses one graph and releases all sources and its context on disposal', async () => {
  let created = 0, stopped = 0, closed = 0;
  const parameter = () => ({ value: 0, cancelScheduledValues() {}, setTargetAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, gain: parameter(), frequency: parameter(), Q: parameter(), start() {}, stop() { stopped++; }, setPeriodicWave() {} });
  const context = {
    sampleRate: 100, currentTime: 0, state: 'suspended', destination: {},
    createGain: node, createBiquadFilter: node,
    createDynamicsCompressor: () => ({ ...node(), threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter() }),
    createOscillator: () => { created++; return node(); },
    createBufferSource: () => { created++; return node(); },
    createPeriodicWave() {}, createBuffer: () => ({ getChannelData: () => new Float32Array(300) }),
    async resume() { this.state = 'running'; }, async close() { closed++; },
  };
  const audio = new DieselAudio(context as unknown as AudioContext);
  await audio.start();
  audio.update(base);
  const count = created;
  for (let i = 0; i < 100; i++) { audio.setHorn('keyboard', true); audio.setHorn('keyboard', false); audio.update({ ...base, speedKmh: i }); }
  assert.equal(created, count);
  audio.blast(); audio.setEnabled(false); audio.update({ ...base, paused: true });
  await audio.dispose(); await audio.dispose();
  assert.equal(stopped, count); assert.equal(closed, 1);
});

test('recorded engine loads once, responds to load and disposes with the shared graph', async (t) => {
  let fetches=0, sources=0, stopped=0;
  const parameter=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(value:number){this.value=value;}});
  const node=()=>({connect(){},disconnect(){},gain:parameter(),frequency:parameter(),Q:parameter(),playbackRate:parameter(),start(){},stop(){stopped++;},setPeriodicWave(){}});
  let recording:ReturnType<typeof node>|undefined;
  const context={sampleRate:100,currentTime:0,state:'running',destination:{},createGain:node,createBiquadFilter:node,
    createDynamicsCompressor:()=>({...node(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter()}),
    createOscillator:()=>{sources++;return node();},createBufferSource:()=>{sources++;recording=node();return recording;},
    createPeriodicWave(){},createBuffer:()=>({getChannelData:()=>new Float32Array(300)}),
    async decodeAudioData(){return {};},async resume(){},async close(){}};
  t.mock.method(globalThis,'fetch',async()=>{fetches++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};});
  const audio=new DieselAudio(context as unknown as AudioContext);
  audio.update(base);
  const first=audio.loadRecording();assert.equal(first,audio.loadRecording());
  assert.equal(await first,true);assert.equal(fetches,1);
  const idleRate=recording!.playbackRate.value;
  context.currentTime=1;audio.update({...base,speedKmh:90,throttle:true});
  assert.ok(recording!.playbackRate.value>idleRate);
  await audio.dispose();assert.equal(stopped,sources);
});
test('recording network failure keeps fallback and disposal during decoding starts no late source', async (t) => {
  const parameter=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(){}});
  const node=()=>({connect(){},disconnect(){},gain:parameter(),frequency:parameter(),Q:parameter(),start(){},stop(){},setPeriodicWave(){}});
  let sources=0, resolveDecode:(value:unknown)=>void=()=>{};
  const context={sampleRate:100,currentTime:0,state:'running',destination:{},createGain:node,createBiquadFilter:node,
    createDynamicsCompressor:()=>({...node(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter()}),
    createOscillator:node,createBufferSource:()=>{sources++;return node();},createPeriodicWave(){},
    createBuffer:()=>({getChannelData:()=>new Float32Array(300)}),
    decodeAudioData:()=>new Promise(resolve=>{resolveDecode=resolve;}),async resume(){},async close(){}};
  const failure=t.mock.method(globalThis,'fetch',async()=>{throw new Error('offline');});
  const fallback=new DieselAudio(context as unknown as AudioContext);
  assert.equal(await fallback.loadRecording(),false);fallback.update(base);await fallback.dispose();
  failure.mock.restore();
  t.mock.method(globalThis,'fetch',async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}));
  const audio=new DieselAudio(context as unknown as AudioContext),before=sources;
  const loading=audio.loadRecording();
  await new Promise(resolve=>setTimeout(resolve,0));
  await audio.dispose();resolveDecode({});
  assert.equal(await loading,false);assert.equal(sources,before);
});
