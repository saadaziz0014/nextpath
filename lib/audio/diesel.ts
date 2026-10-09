import { RAIL_MAX_KMH } from '../rail/physics';

export interface DieselInput { speedKmh: number; throttle: boolean; braking: boolean; active: boolean; paused: boolean }
/** Diesel RPM follows engine load as well as speed: releasing traction must
 * unload the engine even while the locomotive continues coasting quickly. */
export function dieselTargets(input: DieselInput) {
  const speed = Math.max(0, Math.min(1, (Number.isFinite(input.speedKmh) ? input.speedKmh : 0) / RAIL_MAX_KMH));
  const traction = input.throttle && !input.braking;
  const load = traction ? .3 + .7 * speed : .08 + .12 * speed;
  return {
    audible: input.active && !input.paused,
    recordingRate: .85 + load * .9,
    recordingGain: .3 + load * .2,
    firingHz: 32 + load * 54,
    engineGain: .1 + load * .13,
    turboHz: 750 + load * 1900,
    turboGain: .006 + load * .026,
    exhaustHz: 300 + load * 1500,
    exhaustGain: .035 + load * .065,
    rollingGain: speed * speed * .06,
  };
}

/** Recorded GE 7FDL V16 engine-family substitute with procedural fallback.
 * This is not an AGE-30 field recording. One graph handles engine and horn. */
export class DieselAudio {
  private context: AudioContext;
  private recorded: AudioBufferSourceNode | null = null;
  private recordingGain: GainNode;
  private loading: Promise<boolean> | null = null;
  private fetchController = new AbortController();
  private lastInput: DieselInput = {speedKmh:0,throttle:false,braking:false,active:false,paused:false};
  private master: GainNode;
  private engine: GainNode;
  private exhaust: GainNode;
  private rolling: GainNode;
  private turbo: GainNode;
  private horn: GainNode;
  private firing: OscillatorNode;
  private whistle: OscillatorNode;
  private exhaustFilter: BiquadFilterNode;
  private sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private hornSources = new Set<string>();
  private hornTimer: ReturnType<typeof setTimeout> | null = null;
  private enabled = true;
  private volume = .4;
  private audible = false;
  private disposed = false;
  private lastUpdate = -Infinity;

  constructor(context: AudioContext) {
    this.context = context;
    this.master = context.createGain(); this.master.gain.value = 0;
    // Gentle compression keeps the engine + horn mix from overloading output.
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 12;
    compressor.ratio.value = 6; compressor.attack.value = .008; compressor.release.value = .18;
    this.master.connect(compressor); compressor.connect(context.destination);
    const gain = (amount: number) => { const node = context.createGain(); node.gain.value = amount; node.connect(this.master); return node; };
    this.recordingGain = gain(0);
    this.engine = gain(0); this.exhaust = gain(0); this.rolling = gain(0); this.turbo = gain(0); this.horn = gain(0);
    const oscillator = (frequency: number, output: AudioNode, type: OscillatorType = 'sine') => {
      const node = context.createOscillator(); node.type = type; node.frequency.value = frequency; node.connect(output); node.start(); this.sources.push(node); return node;
    };
    // Harmonic combustion rumble: dense firing cycles, not steam chuff pulses.
    this.firing = oscillator(32, this.engine);
    const real = new Float32Array(25), imaginary = new Float32Array(25);
    for (let harmonic = 1; harmonic < imaginary.length; harmonic++) imaginary[harmonic] = Math.exp(-harmonic / 5) / Math.sqrt(harmonic);
    this.firing.setPeriodicWave(context.createPeriodicWave(real, imaginary));
    this.whistle = oscillator(750, this.turbo, 'triangle');
    const noiseBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    let low = 0;
    for (let i = 0; i < samples.length; i++) { low = .96 * low + .04 * (Math.random() * 2 - 1); samples[i] = low * 3; }
    const noise = context.createBufferSource(); noise.buffer = noiseBuffer; noise.loop = true;
    this.exhaustFilter = context.createBiquadFilter(); this.exhaustFilter.type = 'lowpass'; this.exhaustFilter.frequency.value = 400;
    noise.connect(this.exhaustFilter); this.exhaustFilter.connect(this.exhaust);
    const railFilter = context.createBiquadFilter(); railFilter.type = 'bandpass'; railFilter.frequency.value = 1400; railFilter.Q.value = .5;
    noise.connect(railFilter); railFilter.connect(this.rolling); noise.start(); this.sources.push(noise);
    // Original multi-tone compressed-air horn approximation. These are artistic
    // frequencies, not a claim about the fitted AGE-30 horn or its tuning.
    const hornFilter = context.createBiquadFilter(); hornFilter.type = 'lowpass'; hornFilter.frequency.value = 2600; hornFilter.connect(this.horn);
    for (const frequency of [247, 311, 370]) {
      const voice = context.createGain(); voice.gain.value = .14; voice.connect(hornFilter);
      oscillator(frequency, voice, 'sawtooth');
    }
  }
  /** Fetch once from our own static assets. The fallback keeps playing while
   * decoding, and fades away after the recording is ready. Aborting on unmount
   * prevents late decoding from starting an orphaned source. */
  loadRecording(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const response = await fetch('/audio/ge-7fdl-v16-idle.mp3', {signal:this.fetchController.signal});
        if (!response.ok) return false;
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        if (this.disposed) return false;
        const source = this.context.createBufferSource();
        source.buffer = buffer; source.loop = true;
        source.connect(this.recordingGain); source.start();
        this.sources.push(source); this.recorded = source;
        this.lastUpdate = -Infinity; this.update(this.lastInput);
        return true;
      } catch { return false; }
    })();
    return this.loading;
  }
  async start() { if (!this.disposed && this.context.state !== 'running') await this.context.resume(); }
  private target(parameter: AudioParam, value: number, seconds = .25) {
    // Smooth all changes in audio time; no clicks on acceleration or mute.
    const now = this.context.currentTime;
    parameter.cancelScheduledValues(now); parameter.setTargetAtTime(value, now, seconds);
  }
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) this.stopHorn(); this.mix(); }
  setVolume(volume: number) { this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0)); this.mix(); }
  private mix() { if (!this.disposed) this.target(this.master.gain, this.enabled && this.audible ? this.volume : 0, .04); }
  update(input: DieselInput) {
    if (this.disposed) return;
    this.lastInput = input;
    const targets = dieselTargets(input);
    if (this.audible !== targets.audible) { this.audible = targets.audible; if (!this.audible) this.stopHorn(); this.mix(); }
    // Called from the existing animation loop, but schedule only at 20 Hz.
    const now = this.context.currentTime;
    if (now - this.lastUpdate < .05) return; this.lastUpdate = now;
    this.target(this.firing.frequency, targets.firingHz, .5);
    this.target(this.engine.gain, this.recorded ? 0 : targets.engineGain, .4);
    if (this.recorded) {
      // A single idle recording is pitch/rate adapted under load. This is an
      // approximation of revving, not a recorded AGE-30 notch-by-notch soundset.
      this.target(this.recorded.playbackRate, targets.recordingRate, .7);
      this.target(this.recordingGain.gain, targets.recordingGain, .4);
    }
    this.target(this.whistle.frequency, targets.turboHz, .7);
    this.target(this.turbo.gain, this.recorded ? targets.turboGain * .3 : targets.turboGain, .5);
    this.target(this.exhaustFilter.frequency, targets.exhaustHz, .4);
    this.target(this.exhaust.gain, this.recorded ? targets.exhaustGain * .15 : targets.exhaustGain, .3);
    this.target(this.rolling.gain, targets.rollingGain, .3);
  }
  setHorn(source: string, pressed: boolean) {
    if (this.disposed) return;
    if (pressed && this.enabled && this.audible) this.hornSources.add(source); else this.hornSources.delete(source);
    this.target(this.horn.gain, this.hornSources.size ? .55 : 0, pressed ? .045 : .1);
  }
  blast() {
    if (this.hornTimer) clearTimeout(this.hornTimer);
    this.setHorn('accessible', true);
    this.hornTimer = setTimeout(() => { this.setHorn('accessible', false); this.hornTimer = null; }, 650);
  }
  stopHorn() {
    this.hornSources.clear(); if (this.hornTimer) clearTimeout(this.hornTimer); this.hornTimer = null;
    if (!this.disposed) this.target(this.horn.gain, 0, .06);
  }
  async dispose() {
    if (this.disposed) return;
    this.stopHorn(); this.disposed = true; this.fetchController.abort();
    for (const source of this.sources) { source.stop(); source.disconnect(); }
    this.master.disconnect(); await this.context.close();
  }
}
