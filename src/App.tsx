import { useRef, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Home } from "./pages/Home";
import { Gallery } from "./pages/Gallery";
import { About } from "./pages/About";

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/photos" element={<Gallery />} />
          <Route path="/about" element={<About />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
