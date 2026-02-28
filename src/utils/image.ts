const BLOB_BASE = "https://qw0bipg9gyrnmqx2.public.blob.vercel-storage.com";

function resolveUrl(url: string): string {
  if (url.startsWith("http")) return url;
  // /photos/2023/file.jpg → https://blob.../photos/2023/file.jpg
  return `${BLOB_BASE}${url}`;
}

function splitUrl(url: string): { base: string; ext: string } {
  const i = url.lastIndexOf(".");
  return { base: url.slice(0, i), ext: url.slice(i) };
}

export function thumbUrl(url: string, width = 600): string {
  const { base, ext } = splitUrl(resolveUrl(url));
  return `${base}.${width}w${ext}`;
}

export function fullUrl(url: string): string {
  return resolveUrl(url);
}

export function srcSet(url: string): string {
  const resolved = resolveUrl(url);
  const { base, ext } = splitUrl(resolved);
  return `${base}.300w${ext} 300w, ${base}.600w${ext} 600w, ${resolved} 1600w`;
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

const DISPOSABLE_LOCATIONS = new Set(["Costa Rica", "Iceland"]);

export function getCamera(location: string, filmStock: string): string | null {
  if (filmStock === "APS" || filmStock === "Kodak Advantix 400") return "Minolta Vectis";
  if (DISPOSABLE_LOCATIONS.has(location)) return "Fujifilm QuickSnap";
  return "Olympus XA2";
}
