import { useRef, useCallback, useEffect } from "react";

const IS_TOUCH =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

/**
 * Web Audio hook for Pensieve audio.
 *
 * Homepage: ambient hum (white noise → lowpass → gain) + per-photo hover tones.
 * Gallery: deeper gallery ambient (55Hz drone + 110Hz harmonic + LFO breathing)
 *          with interactive response to pull progress and thread depth.
 *
 * Lazy AudioContext creation (first user gesture).
 * Skipped entirely on touch devices.
 */
export function usePensieveAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  // Homepage ambient
  const ambientGainRef = useRef<GainNode | null>(null);
  const ambientSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ambientRunning = useRef(false);

  // Gallery ambient
  const galleryDroneRef = useRef<OscillatorNode | null>(null);
  const galleryDroneGainRef = useRef<GainNode | null>(null);
  const galleryHarmonicRef = useRef<OscillatorNode | null>(null);
  const galleryHarmonicGainRef = useRef<GainNode | null>(null);
  const galleryLfoRef = useRef<OscillatorNode | null>(null);
  const galleryRunning = useRef(false);

  /** Create or reuse AudioContext */
  const getCtx = useCallback((): AudioContext | null => {
    if (IS_TOUCH) return null;
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  // ─── Homepage ambient ───

  /** Start ambient hum — white noise → lowpass → gain */
  const startAmbient = useCallback(() => {
    if (IS_TOUCH || ambientRunning.current) return;
    const ctx = getCtx();
    if (!ctx) return;

    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 150;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 1.5);

    source.connect(lp).connect(gain).connect(ctx.destination);
    source.start();

    ambientSourceRef.current = source;
    ambientGainRef.current = gain;
    ambientRunning.current = true;
  }, [getCtx]);

  /** Fade out ambient hum over 1 second, then stop */
  const stopAmbient = useCallback(() => {
    if (!ambientRunning.current) return;
    const ctx = ctxRef.current;
    const gain = ambientGainRef.current;
    const source = ambientSourceRef.current;
    if (!ctx || !gain || !source) return;

    // Clear flag immediately so startAmbient can restart during fade-out
    ambientRunning.current = false;

    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    setTimeout(() => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      ambientSourceRef.current = null;
      ambientGainRef.current = null;
    }, 1100);
  }, []);

  /** Play a short sine tone — frequency varies by photo index */
  const playHoverTone = useCallback(
    (index: number) => {
      if (IS_TOUCH) return;
      const ctx = getCtx();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 200 + index * 12;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);

      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    },
    [getCtx],
  );

  // ─── Gallery ambient ───

  /**
   * Start gallery ambient — deeper, more submerged than homepage.
   * - Base drone: ~55Hz sine
   * - Harmonic layer: ~110Hz sine, very quiet, responds to pull
   * - LFO: 0.1Hz slow oscillation on harmonic amplitude
   */
  const startGalleryAmbient = useCallback(() => {
    if (IS_TOUCH || galleryRunning.current) return;
    const ctx = getCtx();
    if (!ctx) return;

    // Base drone — 55Hz sine
    const drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 55;

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0, ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.012, ctx.currentTime + 2);

    drone.connect(droneGain).connect(ctx.destination);

    // Harmonic layer — 110Hz sine, very quiet
    const harmonic = ctx.createOscillator();
    harmonic.type = "sine";
    harmonic.frequency.value = 110;

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0, ctx.currentTime);
    harmonicGain.gain.linearRampToValueAtTime(0.004, ctx.currentTime + 2);

    // LFO breathing on harmonic — 0.1Hz
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.1;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.003; // Modulation depth

    lfo.connect(lfoGain).connect(harmonicGain.gain);
    harmonic.connect(harmonicGain).connect(ctx.destination);

    // Start all
    drone.start();
    harmonic.start();
    lfo.start();

    galleryDroneRef.current = drone;
    galleryDroneGainRef.current = droneGain;
    galleryHarmonicRef.current = harmonic;
    galleryHarmonicGainRef.current = harmonicGain;
    galleryLfoRef.current = lfo;
    galleryRunning.current = true;
  }, [getCtx]);

  /** Fade out gallery ambient over 1.5 seconds */
  const stopGalleryAmbient = useCallback(() => {
    if (!galleryRunning.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;

    // Clear flag immediately so startGalleryAmbient can restart during fade-out
    galleryRunning.current = false;

    const t = ctx.currentTime;

    if (galleryDroneGainRef.current) {
      galleryDroneGainRef.current.gain.linearRampToValueAtTime(0, t + 1.5);
    }
    if (galleryHarmonicGainRef.current) {
      galleryHarmonicGainRef.current.gain.linearRampToValueAtTime(0, t + 1.5);
    }

    setTimeout(() => {
      try {
        galleryDroneRef.current?.stop();
        galleryHarmonicRef.current?.stop();
        galleryLfoRef.current?.stop();
      } catch {
        /* already stopped */
      }
      galleryDroneRef.current = null;
      galleryDroneGainRef.current = null;
      galleryHarmonicRef.current = null;
      galleryHarmonicGainRef.current = null;
      galleryLfoRef.current = null;
    }, 1600);
  }, []);

  /**
   * Shift drone frequency by thread depth.
   * +3Hz per level — subtle rising tension.
   */
  const setThreadDepth = useCallback((depth: number) => {
    if (!galleryRunning.current || !galleryDroneRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    galleryDroneRef.current.frequency.linearRampToValueAtTime(
      55 + depth * 3,
      ctx.currentTime + 0.5,
    );
  }, []);

  /**
   * Set pull progress (0-1).
   * Increases harmonic volume as you pull deeper.
   */
  const setPullProgress = useCallback((progress: number) => {
    if (!galleryRunning.current || !galleryHarmonicGainRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    // Base harmonic gain 0.004, pull adds up to 0.02
    const targetGain = 0.004 + progress * 0.02;
    galleryHarmonicGainRef.current.gain.linearRampToValueAtTime(
      targetGain,
      ctx.currentTime + 0.05,
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        ambientSourceRef.current?.stop();
        galleryDroneRef.current?.stop();
        galleryHarmonicRef.current?.stop();
        galleryLfoRef.current?.stop();
      } catch {
        /* noop */
      }
      ctxRef.current?.close();
    };
  }, []);

  return {
    // Homepage
    startAmbient,
    stopAmbient,
    playHoverTone,
    // Gallery
    startGalleryAmbient,
    stopGalleryAmbient,
    setThreadDepth,
    setPullProgress,
  };
}
