import { useEffect, useRef } from "react";

/**
 * Scroll-driven reveal system.
 * - `.reveal` elements fade in when entering viewport, fade out when leaving.
 * - `.reveal-once` elements fade in once and stay visible.
 *
 * Uses a MutationObserver to detect dynamically added elements (infinite scroll)
 * and registers them with the appropriate IntersectionObserver.
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

    // Register all current elements
    function observeAll() {
      el!.querySelectorAll(".reveal:not(.revealed)").forEach((child) => {
        biObserver.observe(child);
      });
      el!.querySelectorAll(".reveal-once:not(.revealed)").forEach((child) => {
        onceObserver.observe(child);
      });
    }

    observeAll();

    // Watch for dynamically added elements (infinite scroll chunks)
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          // Check if the added node itself is a reveal target
          if (node.classList.contains("reveal") && !node.classList.contains("revealed")) {
            biObserver.observe(node);
          }
          if (node.classList.contains("reveal-once") && !node.classList.contains("revealed")) {
            onceObserver.observe(node);
          }

          // Check children of the added node
          node.querySelectorAll?.(".reveal:not(.revealed)").forEach((child) => {
            biObserver.observe(child);
          });
          node.querySelectorAll?.(".reveal-once:not(.revealed)").forEach((child) => {
            onceObserver.observe(child);
          });
        }
      }
    });

    mutationObserver.observe(el, { childList: true, subtree: true });

    return () => {
      biObserver.disconnect();
      onceObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return ref;
}
