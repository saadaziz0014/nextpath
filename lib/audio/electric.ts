export interface ElectricInput { speedKmh:number; traction:boolean; braking:boolean; audible:boolean }
export function electricProfile(input:ElectricInput) {
  const speed=Math.max(0,Math.min(80,Number.isFinite(input.speedKmh)?input.speedKmh:0));
  const moving=input.audible&&speed>.05;
  return { inverterHz:180+speed*14,rollingHz:42+speed*1.4,inverterGain:moving?(input.traction?.027:input.braking?.018:.008):0,rollingGain:moving?.01+speed/80*.022:0 };
}
/** A separate synthesized electric traction/inverter graph. No diesel sample,
 * combustion pulses or locomotive audio is loaded by Metro mode. */
export class ElectricAudio {
  private master:GainNode;
  private inverter:OscillatorNode;
  private rolling:OscillatorNode;
  private inverterGain:GainNode;
  private rollingGain:GainNode;
  private tones:OscillatorNode[]=[];
  private toneGains:GainNode[]=[];
  private disposed=false;
  constructor(private context:AudioContext) {
    this.master=context.createGain();this.master.gain.value=.4;this.master.connect(context.destination);
    this.inverter=context.createOscillator();this.inverter.type='triangle';
    this.rolling=context.createOscillator();this.rolling.type='sine';
    this.inverterGain=context.createGain();this.rollingGain=context.createGain();
    this.inverterGain.gain.value=0;this.rollingGain.gain.value=0;
    this.inverter.connect(this.inverterGain).connect(this.master);this.rolling.connect(this.rollingGain).connect(this.master);
    this.inverter.start();this.rolling.start();
    for(const hz of [660,880]) {const oscillator=context.createOscillator(),gain=context.createGain();oscillator.frequency.value=hz;gain.gain.value=0;oscillator.connect(gain).connect(this.master);oscillator.start();this.tones.push(oscillator);this.toneGains.push(gain);}
  }
  start(){return this.context.resume();}
  setVolume(value:number){if(!this.disposed)this.master.gain.setTargetAtTime(Math.max(0,Math.min(1,Number.isFinite(value)?value:0)),this.context.currentTime,.04);}
  update(input:ElectricInput) {
    if(this.disposed)return;const p=electricProfile(input),now=this.context.currentTime;
    this.inverter.frequency.setTargetAtTime(p.inverterHz,now,.08);this.rolling.frequency.setTargetAtTime(p.rollingHz,now,.08);
    this.inverterGain.gain.setTargetAtTime(p.inverterGain,now,.05);this.rollingGain.gain.setTargetAtTime(p.rollingGain,now,.05);
    if(!input.audible)this.toneGains.forEach(gain=>{gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(0,now,.01);});
  }
  chime(){if(this.disposed)return;const now=this.context.currentTime;this.toneGains.forEach((gain,index)=>{gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.07,now+.01+index*.16);gain.gain.linearRampToValueAtTime(0,now+.16+index*.16);});}
  async dispose(){if(this.disposed)return;this.disposed=true;for(const oscillator of [this.inverter,this.rolling,...this.tones]){oscillator.stop();oscillator.disconnect();}for(const gain of [this.master,this.inverterGain,this.rollingGain,...this.toneGains])gain.disconnect();await this.context.close();}
}
