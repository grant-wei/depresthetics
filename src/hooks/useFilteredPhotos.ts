import { useMemo } from "react";
import { photos } from "../data/photos";
import { useFilterStore } from "../store";
import type { Photo } from "../types";

export function useFilteredPhotos(): Photo[] {
  const { years, locations, filmStocks } = useFilterStore();

  return useMemo(() => {
    return photos.filter((p) => {
      if (p.hidden) return false;
      if (years.length > 0 && !years.includes(p.year)) return false;
      if (locations.length > 0 && !locations.includes(p.location)) return false;
      if (filmStocks.length > 0 && !filmStocks.includes(p.filmStock))
        return false;
      return true;
    });
  }, [years, locations, filmStocks]);
}

export function useAvailableFilters(): {
  years: string[];
  locations: string[];
  filmStocks: string[];
} {
  const { years, locations, filmStocks } = useFilterStore();

  return useMemo(() => {
    // Filter photos based on current selections to show only available options
    const visible = photos.filter((p) => !p.hidden);
    const baseFiltered = visible.filter((p) => {
      if (years.length > 0 && !years.includes(p.year)) return false;
      return true;
    });

    const afterLocation = baseFiltered.filter((p) => {
      if (locations.length > 0 && !locations.includes(p.location)) return false;
      return true;
    });

    const availableYears = [...new Set(visible.map((p) => p.year))].sort();

    // Sort locations and film stocks by frequency (most photos first)
    function sortByFrequency(items: string[]): string[] {
      const counts = new Map<string, number>();
      for (const item of items) {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => key);
    }

    const availableLocations = sortByFrequency(
      baseFiltered.map((p) => p.location).filter(Boolean),
    );
    const availableFilmStocks = sortByFrequency(
      afterLocation.map((p) => p.filmStock).filter(Boolean),
    );

    return {
      years: availableYears,
      locations: availableLocations,
      filmStocks: availableFilmStocks,
    };
  }, [years, locations, filmStocks]);
}
