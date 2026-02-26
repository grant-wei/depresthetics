import { create } from "zustand";
import type { Filters } from "./types";

interface FilterState extends Filters {
  setYears: (years: string[]) => void;
  setLocations: (locations: string[]) => void;
  setFilmStocks: (filmStocks: string[]) => void;
  toggleYear: (year: string) => void;
  toggleLocation: (location: string) => void;
  toggleFilmStock: (filmStock: string) => void;
  clearAll: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  years: [],
  locations: [],
  filmStocks: [],
  setYears: (years) => set({ years }),
  setLocations: (locations) => set({ locations }),
  setFilmStocks: (filmStocks) => set({ filmStocks }),
  toggleYear: (year) =>
    set((state) => ({
      years: state.years.includes(year)
        ? state.years.filter((y) => y !== year)
        : [...state.years, year],
    })),
  toggleLocation: (location) =>
    set((state) => ({
      locations: state.locations.includes(location)
        ? state.locations.filter((l) => l !== location)
        : [...state.locations, location],
    })),
  toggleFilmStock: (filmStock) =>
    set((state) => ({
      filmStocks: state.filmStocks.includes(filmStock)
        ? state.filmStocks.filter((f) => f !== filmStock)
        : [...state.filmStocks, filmStock],
    })),
  clearAll: () => set({ years: [], locations: [], filmStocks: [] }),
}));
