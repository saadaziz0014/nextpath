interface AudioEvent { method:string;value?:number;time:number }
interface MockParameter {
  value:number;events:AudioEvent[];scheduled:AudioEvent[];
  cancelScheduledValues(time:number):void;
  setValueAtTime(value:number,time:number):void;
  setTargetAtTime(value:number,time:number):void;
  linearRampToValueAtTime(value:number,time:number):void;
  exponentialRampToValueAtTime(value:number,time:number):void;
}
interface MockNode {
  kind:string;type:string;gain:MockParameter;frequency:MockParameter;Q:MockParameter;
  threshold:MockParameter;knee:MockParameter;ratio:MockParameter;attack:MockParameter;release:MockParameter;
  starts:number;stops:number;disconnects:number;connections:unknown[];loop:boolean;buffer:unknown;wave:unknown;
  connect(target:unknown):unknown;disconnect():void;start():void;stop():void;setPeriodicWave(wave:unknown):void;
}

/** Web Audio test double records graph/resource ownership and scheduled events.
 * It intentionally does not claim to render or assess audible sound quality. */
export function audioHarness() {
  const parameters:MockParameter[]=[];
  function parameter(value=0):MockParameter {
    const result:MockParameter={value,events:[],scheduled:[],
      cancelScheduledValues(time:number){this.scheduled=this.scheduled.filter(event=>event.time<time);this.events.push({method:'cancel',time});},
      setValueAtTime(value:number,time:number){this.value=value;const e={method:'set',value,time};this.events.push(e);this.scheduled.push(e);},
      setTargetAtTime(value:number,time:number){this.value=value;const e={method:'target',value,time};this.events.push(e);this.scheduled.push(e);},
      linearRampToValueAtTime(value:number,time:number){this.value=value;const e={method:'linear',value,time};this.events.push(e);this.scheduled.push(e);},
      exponentialRampToValueAtTime(value:number,time:number){this.value=value;const e={method:'exponential',value,time};this.events.push(e);this.scheduled.push(e);},
    };parameters.push(result);return result;
  }
  const nodes:MockNode[]=[],waves:{real:Float32Array;imag:Float32Array}[]=[],buffers:Float32Array[]=[];
  function node(kind:string):MockNode {
    const result:MockNode={kind,type:'sine',gain:parameter(),frequency:parameter(),Q:parameter(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter(),
      starts:0,stops:0,disconnects:0,connections:[] as unknown[],loop:false,buffer:null as unknown,wave:null as unknown,
      connect(target:unknown){this.connections.push(target);return target;},disconnect(){this.disconnects++;},start(){this.starts++;},stop(){this.stops++;},setPeriodicWave(wave:unknown){this.wave=wave;},
    };nodes.push(result);return result;
  }
  let resumes=0,closes=0;
  const context={currentTime:0,sampleRate:48000,destination:{kind:'destination'},
    createGain:()=>node('gain'),createOscillator:()=>node('oscillator'),createBufferSource:()=>node('buffer-source'),createBiquadFilter:()=>node('filter'),createDynamicsCompressor:()=>node('compressor'),
    createPeriodicWave:(real:Float32Array,imag:Float32Array)=>{const wave={real,imag};waves.push(wave);return wave;},
    createBuffer:(_channels:number,length:number)=>{const samples=new Float32Array(length);buffers.push(samples);return {getChannelData:()=>samples};},
    resume:async()=>{resumes++;},close:async()=>{closes++;},
  };
  return {context:context as unknown as AudioContext,nodes,waves,buffers,parameters,
    advance:(seconds:number)=>{context.currentTime+=seconds;},resumes:()=>resumes,closes:()=>closes};
}
