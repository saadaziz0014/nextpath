# Train audio

Rail mode uses a recorded GE V16 7FDL idle loop by WeenyBeany under CC BY 4.0. AGE-30 uses this engine family, but the recording comes from an Australian NR Class locomotive: it is a substitute, not a Pakistan AGE-30 field recording. Playback rate and volume respond to speed and traction up to the existing 90 km/h limit; coasting and S unload the engine. Full throttle is approximated from the idle loop, not a recorded throttle-notch set.

The recording is bundled at public/audio/ge-7fdl-v16-idle.mp3. See public/audio/ATTRIBUTION.txt for source, licensing and modifications. One Web Audio graph fades from procedural combustion fallback to the loaded recording, with low-level turbo and rail noise. Loading/decoding failures retain fallback. No third-party audio request or login is needed while using the app.

Press W, H, or Enable sound to unlock browser audio. Hold H or the on-screen horn button for a sustained horn; keyboard activation of that button produces a short blast. The horn remains an original synthesized approximation, not an authentic AGE-30 recording. Volume and mute affect both engine and horn. Pause, tab hiding, window blur and route changes silence audio. Leaving rail mode aborts pending loading, closes the context and stops sources.

Manual listening checks: enable sound, wait for the Recorded GE 7FDL label, accelerate, coast, brake, use cruise, hold/release H, mute and pause, switch tabs and leave rail mode. Check desktop and touch browsers with autoplay restrictions. Automated tests verify load response, graph reuse, recording lifecycle, fallback and disposal; they do not assess perceived sound quality. Browser listening verification is still outstanding.
