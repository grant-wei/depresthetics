import { useRef, useCallback, useEffect } from "react";

const IS_TOUCH =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

/**
 * Web Audio hook for the Pensieve ambient hum + per-photo hover tones.
 * Lazy AudioContext creation (first mouseenter is a user gesture).
 * Skipped entirely on touch devices.
 */
export function usePensieveAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const ambientGainRef = useRef<GainNode | null>(null);
  const ambientSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ambientRunning = useRef(false);

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

  /** Start ambient hum — white noise → lowpass → gain */
  const startAmbient = useCallback(() => {
    if (IS_TOUCH || ambientRunning.current) return;
    const ctx = getCtx();
    if (!ctx) return;

    // White noise buffer (2 seconds, looped)
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

    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    setTimeout(() => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      ambientSourceRef.current = null;
      ambientGainRef.current = null;
      ambientRunning.current = false;
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        ambientSourceRef.current?.stop();
      } catch {
        /* noop */
      }
      ctxRef.current?.close();
    };
  }, []);

  return { startAmbient, stopAmbient, playHoverTone };
}
