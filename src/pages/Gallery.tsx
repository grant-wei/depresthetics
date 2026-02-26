import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFilterStore } from "../store";
import { useFilteredPhotos } from "../hooks/useFilteredPhotos";
import { FilterBar } from "../components/FilterBar";
import { PhotoStream } from "../components/PhotoStream";

export function Gallery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { years, locations, filmStocks, setYears, setLocations, setFilmStocks } = useFilterStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sync URL params → store on mount
  useEffect(() => {
    const urlYears = searchParams.get("year")?.split(",").filter(Boolean) ?? [];
    const urlLocations = searchParams.get("location")?.split(",").filter(Boolean) ?? [];
    const urlFilmStocks = searchParams.get("film")?.split(",").filter(Boolean) ?? [];

    if (urlYears.length > 0) setYears(urlYears);
    if (urlLocations.length > 0) setLocations(urlLocations);
    if (urlFilmStocks.length > 0) setFilmStocks(urlFilmStocks);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync store → URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (years.length > 0) params.set("year", years.join(","));
    if (locations.length > 0) params.set("location", locations.join(","));
    if (filmStocks.length > 0) params.set("film", filmStocks.join(","));

    setSearchParams(params, { replace: true });
  }, [years, locations, filmStocks, setSearchParams]);

  const filtered = useFilteredPhotos();
  const hasFilters = years.length > 0 || locations.length > 0 || filmStocks.length > 0;

  return (
    <main className="gallery">
      <div className="gallery__header">
        <span className="gallery__count">{filtered.length} photos</span>
        <button
          className={`gallery__filter-btn ${hasFilters ? "gallery__filter-btn--active" : ""}`}
          onClick={() => setDrawerOpen(true)}
        >
          filter
        </button>
      </div>

      <FilterBar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <PhotoStream photos={filtered} />
    </main>
  );
}
