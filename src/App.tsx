import { useRef, useCallback, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Home } from "./pages/Home";
import { Gallery } from "./pages/Gallery";
import { About } from "./pages/About";

/* Fade wrapper — skips fade for plunge transitions (/ <-> /photos) */
function AnimatedRoutes() {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [fadeClass, setFadeClass] = useState("page-fade");
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === displayLocation.pathname) return;

    const from = prevPath.current;
    const to = location.pathname;

    // Plunge transitions are handled by Home.tsx / Header.tsx — skip fade
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
    <div className={fadeClass}>
      <Routes location={displayLocation}>
        <Route path="/" element={<Home />} />
        <Route path="/photos" element={<Gallery />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </div>
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
