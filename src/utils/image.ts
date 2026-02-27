const WIDTHS = [300, 600, 1024, 1600];

export function srcSet(url: string): string {
  return WIDTHS.map((w) => `${url}?w=${w} ${w}w`).join(", ");
}

export function sizes(role: "feature" | "pair" | "dense" | "solo"): string {
  switch (role) {
    case "feature":
      return "(max-width: 768px) 100vw, 90vw";
    case "pair":
      return "(max-width: 768px) 100vw, 45vw";
    case "dense":
      return "(max-width: 768px) 100vw, 30vw";
    case "solo":
      return "(max-width: 768px) 100vw, 60vw";
  }
}

export function thumbUrl(url: string, width = 600): string {
  return `${url}?w=${width}`;
}

export function fullUrl(url: string): string {
  return `${url}?w=1600`;
}

const DISPOSABLE_LOCATIONS = new Set(["Costa Rica", "Iceland"]);

export function getCamera(location: string, filmStock: string): string | null {
  if (filmStock === "APS" || filmStock === "Kodak Advantix 400") return "Minolta Vectis";
  if (DISPOSABLE_LOCATIONS.has(location)) return "Fujifilm QuickSnap";
  return "Olympus XA2";
}
