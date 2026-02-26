import { useEffect } from "react";

export function useKeyboard(handlers: Record<string, () => void>) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const handler = handlers[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
