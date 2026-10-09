import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distance } from '@turf/turf';
import { validateMetroDataset, indexMetroTrack, sampleMetroTrack } from '../lib/metro/track';
import { verifyMetroSource } from '../lib/metro/sourceQuality';
import { metroDeparture, stepMetro, toggleMetroDoors, METRO_DWELL_SECONDS } from '../lib/metro/motion';
import { restoreMetroSave, METRO_SAVE_KEY, type MetroSave } from '../lib/metro/persistence';
import { metroConsist, metroCarSvg } from '../lib/metro/consist';
import { electricProfile, ElectricAudio } from '../lib/audio/electric';
import type { Coordinate } from '../lib/routeData';
const data=validateMetroDataset(JSON.parse(readFileSync('public/data/metro/orange-line.json','utf8')));
const source=JSON.parse(readFileSync('data/metro/orange-line.osm.json','utf8')) as {elements:{type:string;tags?:{railway?:string};geometry?:{lat:number;lon:number}[]}[]};

test('Orange Line has two separately sourced tracks, all 26 platforms and two underground stations',()=>{
  verifyMetroSource(data,source.elements.filter(e=>e.type==='way'&&e.tags?.railway==='subway'&&e.geometry).map(e=>e.geometry!.map(p=>[p.lon,p.lat] as Coordinate)));
  const [north,south]=data.paths;
  assert.deepEqual(north.stations.map(s=>s.id),south.stations.map(s=>s.id).reverse());
  assert.deepEqual(north.stations.filter(s=>s.underground).map(s=>s.name),['Anarkali','GPO']);
  assert.notDeepEqual(north.coordinates,[...south.coordinates].reverse());
  assert.ok(north.sections.some(s=>s.underground));
  for(const path of data.paths){const track=indexMetroTrack(path);for(const station of path.stations)assert.ok(distance(sampleMetroTrack(track,station.km).position,station.coordinate)<.000001);}
  const broken=structuredClone(data);broken.paths[0].stations[3].km=-1;assert.throws(()=>validateMetroDataset(broken));
});

test('electric manual power caps at 80 km/h; regenerative braking and open doors block traction',()=>{
  const path=data.paths[0];let state=metroDeparture(path,'ol-1');
  for(let i=0;i<600;i++)state=stepMetro(state,new Set(['w']),.1,path);
  assert.equal(state.velocity*3.6,80);
  const before=state.velocity;state=stepMetro(state,new Set(['w','s']),.1,path);assert.ok(state.velocity<before);
  const origin=metroDeparture(path,'ol-1'),open=toggleMetroDoors(path,origin);assert.equal(open.doorsOpen,true);
  assert.equal(stepMetro(open,new Set(['w']),.1,path).km,origin.km);
  assert.equal(toggleMetroDoors(path,{...origin,velocity:3}).doorsOpen,false);
  assert.equal(toggleMetroDoors(path,{...origin,km:.1}).doorsOpen,false);
  assert.equal(stepMetro(origin,new Set(['w']),100,path).km,stepMetro(origin,new Set(['w']),.1,path).km);
});

test('automatic metro driving visits every platform, dwells, closes doors and completes in both directions',()=>{
  for(const path of data.paths){let state={...metroDeparture(path,path.stations[0].id),automatic:true};const arrivals:string[]=[];
    for(let frame=0;frame<50000;frame++){
      const before=state;state=stepMetro(state,new Set(),.1,path);assert.ok(state.km>=before.km);assert.ok(state.velocity*3.6<=80);
      if(state.doorsOpen&&!before.doorsOpen){const station=path.stations[state.nextStop-1];arrivals.push(station.id);assert.equal(state.km,station.km);assert.equal(state.velocity,0);assert.equal(state.dwellSeconds,METRO_DWELL_SECONDS);}
      if(state.km===path.distanceKm)break;
    }
    assert.deepEqual(arrivals,path.stations.slice(1).map(s=>s.id));assert.equal(state.velocity,0);assert.equal(state.km,path.distanceKm);
  }
});

test('manual braking overrides metro automatic operation, and intermediate departures respect both directions',()=>{
  for(const path of data.paths){const station=path.stations.find(s=>s.name==='GPO')!;const state=metroDeparture(path,station.id);assert.equal(state.km,station.km);
    assert.throws(()=>metroDeparture(path,path.stations.at(-1)!.id));
    const result=stepMetro({...state,velocity:10,automatic:true},new Set(['s']),.1,path);assert.equal(result.automatic,false);assert.ok(result.velocity<10);
  }
});

test('metro progress and doors restore independently from railway saves, with malformed states rejected',()=>{
  assert.notEqual(METRO_SAVE_KEY,'nextpath:rail-journey:v1');
  for(const path of data.paths){const station=path.stations.find(s=>s.name==='Anarkali')!;const m=toggleMetroDoors(path,metroDeparture(path,station.id));
    const value:MetroSave={version:1,fingerprint:data.fingerprint,direction:path.direction,stationId:station.id,motion:m,following:true};
    assert.deepEqual(restoreMetroSave(JSON.stringify(value),data).value.motion,m);
    assert.throws(()=>restoreMetroSave(JSON.stringify({...value,fingerprint:'old'}),data));
    assert.throws(()=>restoreMetroSave(JSON.stringify({...value,motion:{...m,velocity:8}}),data));
    assert.throws(()=>restoreMetroSave(JSON.stringify({...value,motion:{...m,km:-1}}),data));
    assert.throws(()=>restoreMetroSave(JSON.stringify({...value,motion:{...m,nextStop:26}}),data));
  }
});

test('metro formation uses five electric cars with a separate cab silhouette on track bends',()=>{
  const track=indexMetroTrack(data.paths[0]),cars=metroConsist(track,10);
  assert.equal(cars.length,5);assert.ok(cars.every(car=>car.visible));
  assert.ok(cars.some(car=>car.heading!==cars[0].heading));
  assert.ok(metroCarSvg(0).includes('#f97316'));assert.notEqual(metroCarSvg(0),metroCarSvg(1));
  assert.ok(metroConsist(track,0).slice(1).every(car=>!car.visible));
});

test('electric traction sound follows speed and power, and pauses silently without a diesel recording',()=>{
  const low=electricProfile({speedKmh:20,traction:true,braking:false,audible:true}),high=electricProfile({speedKmh:70,traction:true,braking:false,audible:true});assert.ok(high.inverterHz>low.inverterHz);
  assert.ok(electricProfile({speedKmh:20,traction:false,braking:false,audible:true}).inverterGain<low.inverterGain);
  assert.equal(electricProfile({speedKmh:70,traction:true,braking:false,audible:false}).inverterGain,0);
  assert.equal(electricProfile({speedKmh:0,traction:true,braking:false,audible:true}).rollingGain,0);
});

test('electric audio reuses its graph and releases every oscillator on unmount',async()=>{
  let starts=0,stops=0,closed=0,created=0;
  const parameter=()=>({value:0,setTargetAtTime(){},cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}});
  const node=()=>({gain:parameter(),frequency:parameter(),type:'sine',connect(){return this;},disconnect(){},start(){starts++;},stop(){stops++;}});
  const context={currentTime:0,destination:{},createGain:()=>node(),createOscillator:()=>{created++;return node();},resume:async()=>{},close:async()=>{closed++;}};
  const audio=new ElectricAudio(context as unknown as AudioContext);await audio.start();for(let i=0;i<60;i++)audio.update({speedKmh:i,traction:true,braking:false,audible:true});audio.chime();assert.equal(created,4);assert.equal(starts,4);await audio.dispose();await audio.dispose();assert.equal(stops,4);assert.equal(closed,1);
});
