import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {metroDeparture, stepMetro, toggleMetroAutomatic, toggleMetroDoors} from '../lib/metro/motion';
import {busDeparture, stepBus, toggleBusAutomatic, toggleBusDoors} from '../lib/bus/motion';
import {validateMetroDataset} from '../lib/metro/track';
import {validateBusDataset} from '../lib/bus/track';
import {restoreMetroSave, type MetroSave} from '../lib/metro/persistence';
import {restoreBusSave, type BusSave} from '../lib/bus/persistence';
import {transitCommand} from '../lib/transit/controls';
import {transitJourneyFinished, type TransitMotion} from '../lib/transit/stops';

interface Path {distanceKm:number;stations:{id:string;km:number}[]}
interface Operations<P> {
  departure:(path:P,id:string)=>TransitMotion;
  step:(state:TransitMotion,keys:ReadonlySet<string>,seconds:number,path:P)=>TransitMotion;
  automatic:(path:P,state:TransitMotion)=>TransitMotion;
  doors:(path:P,state:TransitMotion)=>TransitMotion;
  save:(state:TransitMotion,path:P)=>void;
}
const idle=new Set<string>();
const delta=[1/144,1/60,1/30];

function checkService<P extends Path>(label:string,paths:P[],op:Operations<P>) {
  test(`${label}: enabling auto in the final 25 metres keeps the upcoming platform`,()=>{
    for(const path of paths){const origin=op.departure(path,path.stations[0].id),target=path.stations[1];
      let state=op.automatic(path,{...origin,km:target.km-.02,velocity:3});
      assert.equal(state.nextStop,1);
      for(let frame=0;frame<4000&&!state.doorsOpen;frame++){const before=state;state=op.step(state,idle,delta[frame%delta.length],path);assert.ok(state.km>=before.km);}
      assert.equal(state.km,target.km);assert.equal(state.velocity,0);assert.equal(state.doorsOpen,true);assert.equal(state.nextStop,2);assert.equal(state.dwellSeconds,12);op.save(state,path);
    }
  });

  test(`${label}: a platform passed manually or a stale auto cursor never snaps backwards`,()=>{
    for(const path of paths){const origin=op.departure(path,path.stations[0].id),target=path.stations[1];
      const passed={...origin,km:target.km+.01,velocity:3};
      const automatic=op.automatic(path,passed);assert.equal(automatic.nextStop,2);
      for(const state of [automatic,{...passed,automatic:true}]){const after=op.step(state,idle,.1,path);assert.ok(after.km>=state.km);assert.equal(after.doorsOpen,false);assert.equal(after.nextStop,2);op.save(after,path);}
    }
  });

  test(`${label}: manual boarding is restorable immediately and auto does not stop at that platform twice`,()=>{
    for(const path of paths){const origin=op.departure(path,path.stations[0].id),target=path.stations[1];
      const open=op.doors(path,{...origin,km:target.km-.01,velocity:.02});
      assert.equal(open.velocity,0);assert.equal(open.doorsOpen,true);assert.equal(open.nextStop,2);op.save(open,path);
      let state=op.automatic(path,open);assert.equal(state.dwellSeconds,12);op.save(state,path);
      for(let frame=0;frame<4000&&state.doorsOpen;frame++)state=op.step(state,idle,delta[frame%delta.length],path);
      assert.equal(state.doorsOpen,false);assert.equal(state.dwellSeconds,0);
      const startKm=state.km;
      for(let frame=0;frame<500;frame++){state=op.step(state,idle,.01,path);assert.equal(state.doorsOpen,false);}
      assert.ok(state.km>startKm);assert.equal(state.nextStop,2);
    }
  });

  test(`${label}: mode switching during dwell preserves the door interlock and S overrides auto`,()=>{
    for(const path of paths){const origin=op.departure(path,path.stations[0].id),target=path.stations[1];
      const arrived={...origin,km:target.km,doorsOpen:true,dwellSeconds:6,nextStop:2,automatic:true};
      const power=op.step(arrived,new Set(['w']),.1,path);assert.equal(power.automatic,true);assert.equal(power.velocity,0);assert.ok(power.dwellSeconds<6);
      const manual=op.automatic(path,arrived);assert.equal(manual.automatic,false);assert.equal(manual.dwellSeconds,0);assert.equal(manual.doorsOpen,true);op.save(manual,path);
      const waiting=op.step(manual,new Set(['w']),.1,path);assert.equal(waiting.km,manual.km);assert.equal(waiting.doorsOpen,true);
      const closed=op.doors(path,waiting);assert.equal(closed.doorsOpen,false);assert.ok(op.step(closed,new Set(['w']),.1,path).km>closed.km);
      const auto=op.automatic(path,manual);assert.equal(auto.dwellSeconds,12);
      const brake=op.step(auto,new Set(['s']),.1,path);assert.equal(brake.automatic,false);assert.equal(brake.dwellSeconds,0);assert.equal(brake.doorsOpen,true);op.save(brake,path);
    }
  });

  test(`${label}: T remains selected when a previously held throttle key repeats`,()=>{
    for(const path of paths){let state=op.departure(path,path.stations[0].id);const keys=new Set<string>();
      const press=(key:string,repeat=false)=>{const command=transitCommand({key,repeat});if(command==='w'||command==='s')keys.add(command);if(command==='t'){keys.clear();state=op.automatic(path,state);}};
      press('w');state=op.step(state,keys,.1,path);assert.ok(state.velocity>0);
      press('t');press('w',true);press('t',true);state=op.step(state,keys,.1,path);assert.equal(state.automatic,true);assert.equal(keys.size,0);
      press('s');state=op.step(state,keys,.1,path);assert.equal(state.automatic,false);
    }
  });

  test(`${label}: boarding at the terminal completes the trip without an endless dwell`,()=>{
    for(const path of paths){const origin=op.departure(path,path.stations[0].id),terminal=path.stations.at(-1)!;
      const near={...origin,km:terminal.km-.01,nextStop:path.stations.length-1};
      assert.equal(transitJourneyFinished(path,near),false);
      const open=op.doors(path,near);assert.equal(transitJourneyFinished(path,open),true);op.save(open,path);
      const auto=op.automatic(path,open),after=op.step(auto,idle,.1,path);
      assert.equal(transitJourneyFinished(path,after),true);assert.equal(after.doorsOpen,true);assert.equal(after.velocity,0);op.save(after,path);
    }
  });

  test(`${label}: variable frame times stop once at every platform and leave terminal doors open`,()=>{
    for(const path of paths){let state=op.automatic(path,op.departure(path,path.stations[0].id));const visited:number[]=[];
      for(let frame=0;frame<500000;frame++){const before=state;state=op.step(state,idle,delta[frame%delta.length],path);assert.ok(state.km>=before.km);
        if(state.doorsOpen&&!before.doorsOpen){visited.push(state.nextStop-1);assert.equal(state.km,path.stations[state.nextStop-1].km);assert.equal(state.velocity,0);}
        if(state.km===path.distanceKm)break;
      }
      assert.deepEqual(visited,path.stations.slice(1).map((_,index)=>index+1));assert.equal(state.km,path.distanceKm);assert.equal(state.doorsOpen,true);assert.equal(state.velocity,0);op.save(state,path);
      const later=op.step(state,idle,.1,path);assert.equal(later.km,state.km);assert.equal(later.doorsOpen,true);
    }
  });
}
const metro=validateMetroDataset(JSON.parse(readFileSync('public/data/metro/orange-line.json','utf8')));
checkService('Orange Line',metro.paths,{departure:metroDeparture,step:stepMetro,automatic:toggleMetroAutomatic,doors:toggleMetroDoors,
  save:(motion,path)=>{const value:MetroSave={version:1,fingerprint:metro.fingerprint,direction:path.direction,stationId:path.stations[0].id,motion,following:true};assert.deepEqual(restoreMetroSave(JSON.stringify(value),metro).value.motion,motion);}});
for(const city of ['lahore','islamabad','peshawar','multan'] as const){
  const data=validateBusDataset(JSON.parse(readFileSync(`public/data/bus/${city==='peshawar'?'peshawar-brt':city+'-metrobus'}.json`,'utf8')));
  checkService(`${city} Metrobus`,data.paths,{departure:busDeparture,step:stepBus,automatic:toggleBusAutomatic,doors:toggleBusDoors,
    save:(motion,path)=>{const value:BusSave={version:1,fingerprint:data.fingerprint,direction:path.direction,stationId:path.stations[0].id,motion,following:true};assert.deepEqual(restoreBusSave(JSON.stringify(value),data).value.motion,motion);}});
}

test('transit shortcuts use T for mode, ignore repeats and preserve browser modifier shortcuts',()=>{
  assert.equal(transitCommand({key:'T',repeat:false}),'t');
  assert.equal(transitCommand({key:'a',repeat:false}),null);
  assert.equal(transitCommand({key:'t',repeat:true}),null);
  for(const modifier of ['ctrlKey','altKey','metaKey'])assert.equal(transitCommand({key:'w',repeat:false,[modifier]:true}),null);
});
