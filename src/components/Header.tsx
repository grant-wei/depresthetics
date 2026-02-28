import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useScrollDirection } from "../hooks/useScrollDirection";

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const scrollDir = useScrollDirection();
  const isHome = location.pathname === "/";
  const [surfacing, setSurfacing] = useState(false);

  const modeClass = isHome ? "header--home" : "header--default";
  const visibleClass = !isHome || scrollDir === "up" ? "header--visible" : "";

  function handleWordmarkClick(e: React.MouseEvent) {
    // Reverse plunge: from /photos → / with white veil
    if (location.pathname === "/photos") {
      e.preventDefault();
      setSurfacing(true);
      setTimeout(() => {
        navigate("/");
        setSurfacing(false);
      }, 800);
    }
  }

  return (
    <>
      {surfacing && <div className="surface-veil" />}
      <header className={`header ${modeClass} ${visibleClass}`}>
        <Link
          to="/"
          className="header__wordmark"
          onClick={handleWordmarkClick}
        >
          depresthetics
        </Link>
        <nav className="header__nav">
          <Link
            to="/photos"
            className={`header__link ${location.pathname === "/photos" ? "header__link--active" : ""}`}
          >
            photos
          </Link>
          <Link
            to="/about"
            className={`header__link ${location.pathname === "/about" ? "header__link--active" : ""}`}
          >
            about
          </Link>
        </nav>
      </header>
    </>
  );
}
