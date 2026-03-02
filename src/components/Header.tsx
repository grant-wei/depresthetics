import { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { useScrollDirection } from "../hooks/useScrollDirection";
import { TransitionCtx } from "../App";

export function Header() {
  const location = useLocation();
  const { startTransition } = useContext(TransitionCtx);
  const scrollDir = useScrollDirection();
  const isHome = location.pathname === "/";

  const modeClass = isHome ? "header--home" : "header--default";
  const visibleClass = !isHome || scrollDir === "up" ? "header--visible" : "";

  function handleWordmarkClick(e: React.MouseEvent) {
    if (location.pathname !== "/") {
      e.preventDefault();
      startTransition("/", "up");
    }
  }

  return (
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
  );
}
