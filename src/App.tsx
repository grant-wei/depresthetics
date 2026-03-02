import { useRef, useCallback, useState, useEffect, createContext } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Home } from "./pages/Home";
import { Gallery } from "./pages/Gallery";
import { About } from "./pages/About";

/* ========================================
   Shared transition veil
   Lives at App level so it persists across route changes.
   ======================================== */

type VeilPhase = "idle" | "fade-in" | "opaque" | "fade-out";

interface TransitionContext {
  startTransition: (to: string, duration?: number) => void;
}

export const TransitionCtx = createContext<TransitionContext>({
  startTransition: () => {},
});

function TransitionVeil({
  phase,
  duration,
}: {
  phase: VeilPhase;
  duration: number;
}) {
  if (phase === "idle") return null;

  const opacity = phase === "fade-in" ? 1 : phase === "opaque" ? 1 : 0;

  return (
    <div
      className="transition-veil"
      style={{
        opacity,
        transitionDuration: phase === "fade-in" ? `${duration}ms` : "400ms",
      }}
    />
  );
}

/* Fade wrapper — skips fade for plunge transitions (/ <-> /photos) */
function AnimatedRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [fadeClass, setFadeClass] = useState("page-fade");
  const prevPath = useRef(location.pathname);

  /* --- Veil state --- */
  const [veilPhase, setVeilPhase] = useState<VeilPhase>("idle");
  const [veilDuration, setVeilDuration] = useState(800);
  const pendingNav = useRef<string | null>(null);

  const startTransition = useCallback(
    (to: string, duration = 800) => {
      if (veilPhase !== "idle") return;
      pendingNav.current = to;
      setVeilDuration(duration);
      setVeilPhase("fade-in");
    },
    [veilPhase],
  );

  /* Drive the veil state machine */
  useEffect(() => {
    if (veilPhase === "fade-in") {
      // Wait for fade-in to complete, then navigate
      const timer = setTimeout(() => {
        setVeilPhase("opaque");
        if (pendingNav.current) {
          navigate(pendingNav.current);
          pendingNav.current = null;
        }
      }, veilDuration);
      return () => clearTimeout(timer);
    }

    if (veilPhase === "opaque") {
      // Give the new page a frame to render, then fade out
      const timer = setTimeout(() => {
        setVeilPhase("fade-out");
      }, 80);
      return () => clearTimeout(timer);
    }

    if (veilPhase === "fade-out") {
      const timer = setTimeout(() => {
        setVeilPhase("idle");
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [veilPhase, veilDuration, navigate]);

  /* Handle non-plunge route changes (e.g. Gallery <-> About) */
  useEffect(() => {
    if (location.pathname === displayLocation.pathname) return;

    const from = prevPath.current;
    const to = location.pathname;

    // Plunge transitions are handled by the veil — just swap immediately
    const isPlunge =
      (from === "/" && to === "/photos") ||
      (from === "/photos" && to === "/");

    if (isPlunge) {
      setDisplayLocation(location);
      prevPath.current = to;
      return;
    }

    // Fade out → swap → fade in
    setFadeClass("page-fade page-fade--out");

    const timer = setTimeout(() => {
      setDisplayLocation(location);
      setFadeClass("page-fade page-fade--in");
      prevPath.current = to;
    }, 300);

    return () => clearTimeout(timer);
  }, [location, displayLocation.pathname]);

  return (
    <TransitionCtx.Provider value={{ startTransition }}>
      <TransitionVeil phase={veilPhase} duration={veilDuration} />
      <div className={fadeClass}>
        <Routes location={displayLocation}>
          <Route path="/" element={<Home />} />
          <Route path="/photos" element={<Gallery />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </div>
    </TransitionCtx.Provider>
  );
}

export function App() {
  const cursorRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (cursorRef.current) {
      cursorRef.current.style.left = `${e.clientX}px`;
      cursorRef.current.style.top = `${e.clientY}px`;
    }
  }, []);

  const onMouseEnter = useCallback(() => {
    cursorRef.current?.classList.add("custom-cursor--visible");
  }, []);

  const onMouseLeave = useCallback(() => {
    cursorRef.current?.classList.remove("custom-cursor--visible");
  }, []);

  return (
    <BrowserRouter>
      <div
        className="app custom-cursor-area"
        onMouseMove={onMouseMove}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="custom-cursor" ref={cursorRef} />
        <Header />
        <AnimatedRoutes />
        <Footer />
      </div>
    </BrowserRouter>
  );
}
