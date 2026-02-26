import { Link, useLocation } from "react-router-dom";
import { useScrollDirection } from "../hooks/useScrollDirection";

export function Header() {
  const location = useLocation();
  const scrollDir = useScrollDirection();
  const isHome = location.pathname === "/";

  const modeClass = isHome ? "header--home" : "header--default";
  const visibleClass = !isHome || scrollDir === "up" ? "header--visible" : "";

  return (
    <header className={`header ${modeClass} ${visibleClass}`}>
      <Link to="/" className="header__wordmark">
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
