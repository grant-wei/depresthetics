import { useLocation } from "react-router-dom";

export function Footer() {
  const location = useLocation();

  // No footer on the home page film experience
  if (location.pathname === "/") return null;

  return (
    <footer className="footer">
      <span>&copy; 2025 depresthetics</span>
    </footer>
  );
}
