import { useRef, useCallback, useEffect, useState } from "react";

interface UsePullOptions {
  enabled: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onStart: () => void;
  onComplete: () => void;
  onRelease: () => void;
  /** Called with progress 0→1 (throttled — ~every 4 frames for audio) */
  onProgress?: (progress: number) => void;
}

const PULL_DURATION = 2000; // ms to reach 1.0
const HOLD_THRESHOLD = 200; // ms before desktop mousedown becomes a pull
const TOUCH_THRESHOLD = 500; // ms before touch becomes pull
const SPRINGBACK_DURATION = 300; // ms for ease-out decay
const PROGRESS_THROTTLE = 4; // report progress every N frames

export function usePull({
  enabled,
  containerRef,
  onStart,
  onComplete,
  onRelease,
  onProgress,
}: UsePullOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const pulling = useRef(false);
  const startTime = useRef(0);
  const rafId = useRef(0);
  const holdTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef(0);
  const completedRef = useRef(false);
  const frameCount = useRef(0);

  // Set CSS var directly on DOM — bypasses React renders
  const setCssProgress = useCallback(
    (value: number) => {
      containerRef.current?.style.setProperty("--pull-progress", String(value));
    },
    [containerRef],
  );

  const cancelTimers = useCallback(() => {
    if (holdTimerId.current) {
      clearTimeout(holdTimerId.current);
      holdTimerId.current = null;
    }
    if (touchTimerId.current) {
      clearTimeout(touchTimerId.current);
      touchTimerId.current = null;
    }
  }, []);

  const stopPull = useCallback(() => {
    pulling.current = false;
    setIsPulling(false);
    if (rafId.current) cancelAnimationFrame(rafId.current);
    cancelTimers();
  }, [cancelTimers]);

  // rAF loop: tick progress 0→1
  const tick = useCallback(() => {
    if (!pulling.current) return;

    const elapsed = performance.now() - startTime.current;
    const progress = Math.min(elapsed / PULL_DURATION, 1);
    progressRef.current = progress;

    // CSS var every frame (cheap — just opacity on an overlay)
    setCssProgress(progress);

    // Zustand/audio update throttled
    frameCount.current++;
    if (frameCount.current % PROGRESS_THROTTLE === 0) {
      onProgress?.(progress);
    }

    if (progress >= 1) {
      completedRef.current = true;
      stopPull();
      onProgress?.(1);
      onComplete();
      return;
    }

    rafId.current = requestAnimationFrame(tick);
  }, [setCssProgress, onProgress, onComplete, stopPull]);

  const beginPull = useCallback(() => {
    pulling.current = true;
    completedRef.current = false;
    progressRef.current = 0;
    frameCount.current = 0;
    startTime.current = performance.now();
    setIsPulling(true);
    onStart();
    rafId.current = requestAnimationFrame(tick);
  }, [onStart, tick]);

  // Spring-back: ease-out decay from current progress to 0
  const springBack = useCallback(() => {
    const fromProgress = progressRef.current;
    if (fromProgress <= 0) {
      setCssProgress(0);
      onProgress?.(0);
      return;
    }

    const decayStart = performance.now();
    const decayLoop = () => {
      const elapsed = performance.now() - decayStart;
      const t = Math.min(elapsed / SPRINGBACK_DURATION, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const value = fromProgress * (1 - eased);

      setCssProgress(value);

      if (t < 1) {
        rafId.current = requestAnimationFrame(decayLoop);
      } else {
        setCssProgress(0);
        onProgress?.(0);
      }
    };
    rafId.current = requestAnimationFrame(decayLoop);
  }, [setCssProgress, onProgress]);

  const releasePull = useCallback(() => {
    // Cancel pending hold timer — mouseup before threshold = normal click
    cancelTimers();

    if (!pulling.current && !isPulling) return;
    stopPull();

    if (!completedRef.current) {
      springBack();
      onRelease();
    }
  }, [isPulling, cancelTimers, stopPull, springBack, onRelease]);

  // Desktop: mousedown → wait HOLD_THRESHOLD → then start pull
  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!enabled || e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-neighbor-id], .lightbox, .filter-drawer, .grid-toggle, .gallery__filter-btn, .pensieve-gallery__thread-depth")) return;

      // Don't start pull immediately — wait for sustained hold
      holdTimerId.current = setTimeout(() => {
        holdTimerId.current = null;
        beginPull();
      }, HOLD_THRESHOLD);
    },
    [enabled, beginPull],
  );

  const onMouseUp = useCallback(() => {
    releasePull();
  }, [releasePull]);

  // Touch: touchstart → 500ms timer → pull begins
  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-neighbor-id], .lightbox, .filter-drawer, .grid-toggle, .gallery__filter-btn, .pensieve-gallery__thread-depth")) return;

      touchTimerId.current = setTimeout(() => {
        touchTimerId.current = null;
        e.preventDefault();
        beginPull();
      }, TOUCH_THRESHOLD);
    },
    [enabled, beginPull],
  );

  const onTouchEnd = useCallback(() => {
    releasePull();
  }, [releasePull]);

  const onTouchMove = useCallback(() => {
    // Finger moved — cancel pending pull
    cancelTimers();
  }, [cancelTimers]);

  // Attach listeners
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchmove", onTouchMove);

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchmove", onTouchMove);
      stopPull();
    };
  }, [enabled, containerRef, onMouseDown, onMouseUp, onTouchStart, onTouchEnd, onTouchMove, stopPull]);

  return { isPulling };
}
