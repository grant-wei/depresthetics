interface GridToggleProps {
  active: boolean;
  onToggle: () => void;
}

export function GridToggle({ active, onToggle }: GridToggleProps) {
  return (
    <button
      className={`grid-toggle ${active ? "grid-toggle--active" : ""}`}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={active ? "Switch to pensieve view" : "Switch to grid view"}
    >
      {active ? (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="5" />
            <circle cx="7" cy="7" r="2" />
          </svg>
          pensieve
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="4.5" height="4.5" rx="0.5" />
            <rect x="8.5" y="1" width="4.5" height="4.5" rx="0.5" />
            <rect x="1" y="8.5" width="4.5" height="4.5" rx="0.5" />
            <rect x="8.5" y="8.5" width="4.5" height="4.5" rx="0.5" />
          </svg>
          all photos
        </>
      )}
    </button>
  );
}
