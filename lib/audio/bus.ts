import type { BusMotion } from '../bus/motion';

export interface BusInput {
  speedKmh: number;
  traction: boolean;
  braking: boolean;
  audible: boolean;
  doorsOpen?: boolean;
}
const SHIFT_SPEEDS = [0, 15, 27, 38, 48, 57];
const GEAR_RATIOS = [3.8, 2.6, 1.75, 1.25, 1, .8];

/** Audio follows the actual controller output. Auto mode alone does not imply
 * throttle: station braking and door dwell must sound different from powering. */
export function busAudioInput(before: BusMotion, after: BusMotion, keys: ReadonlySet<string>, audible: boolean): BusInput {
  const braking = keys.has('s') || (after.automatic && after.velocity < before.velocity - .000001);
  return {
    speedKmh: after.velocity * 3.6,
    braking,
    traction: !after.doorsOpen && !braking && (keys.has('w') || (after.automatic && after.velocity > before.velocity + .000001)),
    doorsOpen: after.doorsOpen,
    audible,
  };
}

/** Generic bus tuning, rather than a recording of a particular fleet model.
 * The firing frequency models a six-cylinder four-stroke engine (3 pulses/rev).
 * Gear hysteresis prevents pitch flutter near a shift while speed fluctuates. */
export function busProfile(input: BusInput, previousGear?: number) {
  const speedKmh = Math.max(0, Math.min(60, Number.isFinite(input.speedKmh) ? input.speedKmh : 0));
  let index = SHIFT_SPEEDS.findLastIndex(speed => speedKmh >= speed);
  if (typeof previousGear === 'number' && Number.isInteger(previousGear) && previousGear >= 1 && previousGear <= GEAR_RATIOS.length) {
    index = previousGear - 1;
    while (index < SHIFT_SPEEDS.length - 1 && speedKmh >= SHIFT_SPEEDS[index + 1] + .75) index++;
    while (index > 0 && speedKmh < SHIFT_SPEEDS[index] - 2) index--;
  }
  const power = input.traction && !input.braking && !input.doorsOpen;
  const moving = speedKmh > .05;
  const rpm = Math.min(2450, Math.max(720, speedKmh * 38 * GEAR_RATIOS[index]) + (power ? 240 : 0));
  return {
    speedKmh, rpm, gear: index + 1,
    engineHz: rpm / 20,
    engineCutoff: power ? 1150 : input.braking ? 520 : 760,
    engineGain: input.audible ? (power ? .085 : input.braking ? .022 : moving ? .048 : .036) : 0,
    bassGain: input.audible ? (power ? .048 : .032) : 0,
    turboHz: 520 + speedKmh * 16 + (power ? 260 : 0),
    turboGain: input.audible && moving && power ? .012 * speedKmh / 60 : 0,
    rollingHz: 120 + speedKmh * 3,
    rollingGain: input.audible && moving ? .002 + speedKmh / 60 * .006 : 0,
    intakeGain: input.audible && power ? .001 + speedKmh / 60 * .002 : 0,
    brakeGain: input.audible && moving && input.braking ? .002 + speedKmh / 60 * .003 : 0,
  };
}

/** Persistent Web Audio graph: rounded combustion pulses, low engine body,
 * turbo, filtered road/intake/air noise, pneumatic transients and a bus horn.
 * No network audio, per-frame audio-node creation or locomotive assets. */
export class BusAudio {
  private master: GainNode;
  private engine: OscillatorNode;
  private bass: OscillatorNode;
  private turbo: OscillatorNode;
  private engineFilter: BiquadFilterNode;
  private roadFilter: BiquadFilterNode;
  private engineGain: GainNode;
  private bassGain: GainNode;
  private turboGain: GainNode;
  private rollingGain: GainNode;
  private intakeGain: GainNode;
  private brakeGain: GainNode;
  private airGain: GainNode;
  private toneGains: GainNode[] = [];
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private previous: BusInput | null = null;
  private gear = 1;
  private audible = false;
  private disposed = false;

  constructor(private readonly context: AudioContext) {
    const track = <T extends AudioNode>(node: T): T => { this.nodes.push(node); return node; };
    const oscillator = () => {
      const node = track(context.createOscillator()); this.sources.push(node); return node;
    };
    const gain = () => { const node = track(context.createGain()); node.gain.value = 0; return node; };
    const filter = (type: BiquadFilterType, hz: number, q = .5) => {
      const node = track(context.createBiquadFilter()); node.type = type; node.frequency.value = hz; node.Q.value = q; return node;
    };
    this.master = gain(); this.master.gain.value = .45;
    const compressor = track(context.createDynamicsCompressor());
    compressor.threshold.value = -16; compressor.knee.value = 18; compressor.ratio.value = 3;
    compressor.attack.value = .006; compressor.release.value = .14;
    this.master.connect(compressor).connect(context.destination);

    // A rich harmonic wave provides a clear, musical synthetic engine tone.
    const engineWave = context.createPeriodicWave(new Float32Array(9), new Float32Array([0, 1, .72, .52, .36, .22, .14, .08, .04]));
    this.engine = oscillator(); this.engine.setPeriodicWave(engineWave);
    this.bass = oscillator(); this.bass.type = 'sine';
    this.turbo = oscillator(); this.turbo.type = 'sine';
    this.engineFilter = filter('lowpass', 760);
    this.engineGain = gain(); this.bassGain = gain(); this.turboGain = gain();
    this.engine.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.bass.connect(this.bassGain).connect(this.master);
    this.turbo.connect(this.turboGain).connect(this.master);

    // Allocate a single noise loop once, then colour it into subtle background air/road layers.
    const buffer = context.createBuffer(1, Math.round(context.sampleRate * 2), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const noise = track(context.createBufferSource()); noise.buffer = buffer; noise.loop = true;
    this.sources.push(noise);
    this.roadFilter = filter('lowpass', 160);
    const intakeFilter = filter('bandpass', 1500, .7), airFilter = filter('bandpass', 1900, .45);
    this.rollingGain = gain(); this.intakeGain = gain(); this.brakeGain = gain(); this.airGain = gain();
    noise.connect(this.roadFilter).connect(this.rollingGain).connect(this.master);
    noise.connect(intakeFilter).connect(this.intakeGain).connect(this.master);
    noise.connect(airFilter); airFilter.connect(this.brakeGain).connect(this.master); airFilter.connect(this.airGain).connect(this.master);

    const hornWave = context.createPeriodicWave(new Float32Array(5), new Float32Array([0, 1, .35, .15, .06]));
    const hornFilter = filter('lowpass', 1400);
    hornFilter.connect(this.master);
    for (const hz of [185, 233]) {
      const tone = oscillator(), level = gain(); tone.setPeriodicWave(hornWave); tone.frequency.value = hz;
      tone.connect(level).connect(hornFilter); this.toneGains.push(level);
    }
    // All sources stay running at zero gain when silent. Updates automate the
    // existing graph; repeated W, T, H or Sound never creates another engine.
    this.sources.forEach(source => source.start());
  }

  start(): Promise<void> { return this.disposed ? Promise.resolve() : this.context.resume(); }
  setVolume(value: number) {
    if (!this.disposed) this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)), this.context.currentTime, .04);
  }
  update(input: BusInput) {
    if (this.disposed) return;
    const p = busProfile(input, this.gear), now = this.context.currentTime;
    this.gear = p.gear; this.audible = input.audible;
    // Slew frequencies and filter/gain changes to avoid clicks on gearbox shifts
    // or instant keyboard transitions. Combustion stays audible at station idle.
    this.engine.frequency.setTargetAtTime(p.engineHz, now, .12);
    this.bass.frequency.setTargetAtTime(p.engineHz, now, .12);
    this.turbo.frequency.setTargetAtTime(p.turboHz, now, .2);
    this.engineFilter.frequency.setTargetAtTime(p.engineCutoff, now, .1);
    this.roadFilter.frequency.setTargetAtTime(p.rollingHz, now, .15);
    for (const [node, value] of [[this.engineGain, p.engineGain], [this.bassGain, p.bassGain], [this.turboGain, p.turboGain], [this.rollingGain, p.rollingGain], [this.intakeGain, p.intakeGain], [this.brakeGain, p.brakeGain]] as const) {
      node.gain.setTargetAtTime(value, now, input.audible ? .06 : .01);
    }
    if (!input.audible) {
      // Cancel scheduled horn/door bursts as well as continuous engine layers.
      for (const node of [...this.toneGains, this.airGain]) { node.gain.cancelScheduledValues(now); node.gain.setTargetAtTime(0, now, .01); }
    } else if (this.previous?.audible) {
      if (!!input.doorsOpen !== !!this.previous.doorsOpen) this.airRelease(input.doorsOpen ? .55 : .32);
      else if (this.previous.braking && this.previous.speedKmh > .3 && p.speedKmh <= .3) this.airRelease(.28);
    }
    this.previous = { ...input, speedKmh: p.speedKmh };
  }
  private airRelease(seconds: number) {
    const now = this.context.currentTime, level = this.airGain.gain;
    level.cancelScheduledValues(now); level.setValueAtTime(0, now);
    level.linearRampToValueAtTime(.055, now + .025);
    level.exponentialRampToValueAtTime(.0001, now + seconds);
    level.setValueAtTime(0, now + seconds + .01);
  }
  horn() {
    if (this.disposed || !this.audible) return;
    const now = this.context.currentTime;
    for (const node of this.toneGains) {
      node.gain.cancelScheduledValues(now); node.gain.setValueAtTime(0, now);
      node.gain.linearRampToValueAtTime(.085, now + .035);
      node.gain.setValueAtTime(.085, now + .25);
      node.gain.linearRampToValueAtTime(0, now + .48);
    }
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.sources.forEach(source => source.stop()); this.nodes.forEach(node => node.disconnect());
    this.sources = []; this.nodes = [];
    await this.context.close();
  }
}
