import { useEffect, useRef } from "react";

/**
 * Scroll-driven reveal system.
 * - `.reveal` elements fade in when entering viewport, fade out when leaving.
 * - `.reveal-once` elements fade in once and stay visible.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Bidirectional observer: elements fade in/out as they enter/leave
    const biObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("revealed");
          } else {
            (entry.target as HTMLElement).classList.remove("revealed");
          }
        }
      },
      { threshold: 0.15, rootMargin: "-5% 0px -5% 0px" },
    );

    // One-shot observer: elements fade in once and stay
    const onceObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("revealed");
            onceObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -60px 0px" },
    );

    const biElements = el.querySelectorAll(".reveal");
    const onceElements = el.querySelectorAll(".reveal-once");

    biElements.forEach((child) => biObserver.observe(child));
    onceElements.forEach((child) => onceObserver.observe(child));

    return () => {
      biObserver.disconnect();
      onceObserver.disconnect();
    };
  }, []);

  return ref;
}
