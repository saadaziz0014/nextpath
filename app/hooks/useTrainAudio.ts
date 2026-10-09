'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DieselAudio, type DieselInput } from '@/lib/audio/diesel';

/** Create audio only inside a user gesture, respecting browser autoplay rules.
 * Animation updates are imperative and never cause React renders. */
export function useTrainAudio() {
  const engine = useRef<DieselAudio | null>(null);
  const input = useRef<DieselInput>({ speedKmh: 0, throttle: false, braking: false, active: false, paused: false });
  const enabledRef = useRef(true), volumeRef = useRef(.4), mounted = useRef(false);
  const [enabled, setEnabled] = useState(true);
  const [started, setStarted] = useState(false);
  const [volume, setVolumeState] = useState(.4);
  const [recordingReady, setRecordingReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; const old = engine.current; engine.current = null; void old?.dispose().catch(() => {}); };
  }, []);
  const unlock = useCallback(() => {
    if (!enabledRef.current) return null;
    try {
      if (!engine.current) {
        engine.current = new DieselAudio(new AudioContext());
        engine.current.setVolume(volumeRef.current);
        const created = engine.current;
        void created.loadRecording().then(ready => {
          if (mounted.current && engine.current === created) setRecordingReady(ready);
        });
      }
      const audio = engine.current;
      audio.update(input.current);
      // Resume synchronously from the gesture. Releasing H before this promise
      // resolves still releases its gain, so autoplay delays cannot stick it on.
      void audio.start().then(() => {
        if (mounted.current && engine.current === audio) { setStarted(true); setError(''); }
      }).catch(() => { if (mounted.current) setError('Audio could not start. Try Enable sound again.'); });
      return audio;
    } catch { setError('Web Audio is unavailable in this browser.'); return null; }
  }, []);
  const update = useCallback((value: DieselInput) => { input.current = value; engine.current?.update(value); }, []);
  const horn = useCallback((source: string, pressed: boolean) => {
    const audio = pressed ? unlock() : engine.current;
    audio?.setHorn(source, pressed);
  }, [unlock]);
  const blast = useCallback(() => { unlock()?.blast(); }, [unlock]);
  const stopHorn = useCallback(() => { engine.current?.stopHorn(); }, []);
  const silence = useCallback(() => {
    input.current = { ...input.current, paused: true };
    engine.current?.update(input.current);
  }, []);
  const toggle = useCallback(() => {
    // A locked context needs an enable gesture before this becomes a mute button.
    if (!started || !enabledRef.current) {
      enabledRef.current = true; setEnabled(true); engine.current?.setEnabled(true); unlock();
    } else { enabledRef.current = false; setEnabled(false); engine.current?.setEnabled(false); }
  }, [started, unlock]);
  const setVolume = useCallback((value: number) => {
    volumeRef.current = Math.max(0, Math.min(1, value)); setVolumeState(volumeRef.current); engine.current?.setVolume(volumeRef.current);
  }, []);
  return { enabled, started, volume, error, recordingReady, unlock, update, horn, blast, stopHorn, silence, toggle, setVolume };
}
