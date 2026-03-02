import { useRef, useCallback, useState, useEffect, createContext } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Home } from "./pages/Home";
import { Gallery } from "./pages/Gallery";
import { About } from "./pages/About";

/* ========================================
   Plunge transitions — "diving in / surfacing"

   Instead of a flat black cut, the departing page zooms forward + blurs
   (like falling into the pensieve), and the arriving page rises into view.
   ======================================== */

type PlungePhase = "idle" | "plunge-out" | "swap" | "plunge-in";
type PlungeDir = "down" | "up"; // down = Home→Gallery, up = Gallery→Home

interface TransitionContext {
  startTransition: (to: string, dir?: PlungeDir) => void;
}

export const TransitionCtx = createContext<TransitionContext>({
  startTransition: () => {},
});

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const cursorRef = useRef<HTMLDivElement>(null);
  const [displayLocation, setDisplayLocation] = useState(location);
  const [fadeClass, setFadeClass] = useState("page-fade");

  /* --- Plunge state --- */
  const [phase, setPhase] = useState<PlungePhase>("idle");
  const [dir, setDir] = useState<PlungeDir>("down");
  const pendingNav = useRef<string | null>(null);
  const plungeActive = useRef(false);

  const startTransition = useCallback(
    (to: string, direction: PlungeDir = "down") => {
      if (phase !== "idle") return;
      pendingNav.current = to;
      plungeActive.current = true;
      setDir(direction);
      setPhase("plunge-out");
    },
    [phase],
  );

  /* Drive the plunge state machine */
  useEffect(() => {
    if (phase === "plunge-out") {
      const timer = setTimeout(() => {
        if (pendingNav.current) {
          navigate(pendingNav.current);
          pendingNav.current = null;
        }
        setPhase("swap");
      }, 900);
      return () => clearTimeout(timer);
    }

    if (phase === "swap") {
      const raf = requestAnimationFrame(() => {
        setPhase("plunge-in");
      });
      return () => cancelAnimationFrame(raf);
    }

    if (phase === "plunge-in") {
      const timer = setTimeout(() => {
        setPhase("idle");
        plungeActive.current = false;
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [phase, navigate]);

  /* Handle non-plunge route changes (Gallery <-> About, etc.) */
  useEffect(() => {
    if (location.pathname === displayLocation.pathname) return;

    if (plungeActive.current) {
      setDisplayLocation(location);

      return;
    }

    // Simple crossfade for non-plunge
    setFadeClass("page-fade page-fade--out");

    const timer = setTimeout(() => {
      setDisplayLocation(location);
      setFadeClass("page-fade page-fade--in");

    }, 300);

    return () => clearTimeout(timer);
  }, [location, displayLocation.pathname]);

  /* Build the CSS class for plunge effect */
  let plungeClass = "";
  if (phase === "plunge-out") {
    plungeClass = dir === "down" ? "plunge plunge--dive-out" : "plunge plunge--surface-out";
  } else if (phase === "swap") {
    plungeClass = dir === "down" ? "plunge plunge--dive-out" : "plunge plunge--surface-out";
  } else if (phase === "plunge-in") {
    plungeClass = dir === "down" ? "plunge plunge--dive-in" : "plunge plunge--surface-in";
  }

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
    <TransitionCtx.Provider value={{ startTransition }}>
      <div
        className="app custom-cursor-area"
        onMouseMove={onMouseMove}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="custom-cursor" ref={cursorRef} />
        <Header />
        <div className={`${fadeClass} ${plungeClass}`}>
          <Routes location={displayLocation}>
            <Route path="/" element={<Home />} />
            <Route path="/photos" element={<Gallery />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </TransitionCtx.Provider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
