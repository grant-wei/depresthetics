import { useFilterStore } from "../store";
import { useAvailableFilters } from "../hooks/useFilteredPhotos";

interface PillGroupProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}

function PillGroup({ label, options, selected, onToggle }: PillGroupProps) {
  if (options.length === 0) return null;

  return (
    <div className="filter-group">
      <span className="filter-group__label">{label}</span>
      <div className="filter-group__pills">
        {options.map((opt) => (
          <button
            key={opt}
            className={`pill ${selected.includes(opt) ? "pill--active" : ""}`}
            onClick={() => onToggle(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

interface FilterBarProps {
  open: boolean;
  onClose: () => void;
}

export function FilterBar({ open, onClose }: FilterBarProps) {
  const { years, locations, filmStocks, toggleYear, toggleLocation, toggleFilmStock, clearAll } =
    useFilterStore();
  const available = useAvailableFilters();

  const hasFilters = years.length > 0 || locations.length > 0 || filmStocks.length > 0;

  return (
    <>
      {/* Overlay */}
      <div
        className={`filter-drawer-overlay ${open ? "filter-drawer-overlay--open" : ""}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`filter-drawer ${open ? "filter-drawer--open" : ""}`}>
        <div className="filter-drawer__header">
          <span className="filter-drawer__title">filters</span>
          <button className="filter-drawer__close" onClick={onClose}>
            &times;
          </button>
        </div>

        <PillGroup
          label="Year"
          options={available.years}
          selected={years}
          onToggle={toggleYear}
        />
        <PillGroup
          label="Location"
          options={available.locations}
          selected={locations}
          onToggle={toggleLocation}
        />
        <PillGroup
          label="Film"
          options={available.filmStocks}
          selected={filmStocks}
          onToggle={toggleFilmStock}
        />

        {hasFilters && (
          <button className="filter-drawer__clear" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>
    </>
  );
}
