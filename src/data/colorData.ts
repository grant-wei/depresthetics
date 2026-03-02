import colorDataJson from "./colorData.json";

export interface ColorEntry {
  dominantColors: [number, number, number][];
  brightness: number;
  temperature: number;
  neighbors: string[];
}

type ColorDataMap = Record<string, ColorEntry>;

const colorData: ColorDataMap = colorDataJson as unknown as ColorDataMap;

/** Check if color data has been generated */
export function hasColorData(): boolean {
  return Object.keys(colorData).length > 0;
}

/** Get the full color entry for a photo ID */
export function getColorEntry(id: string): ColorEntry | null {
  return colorData[id] ?? null;
}

/** Get top-8 semantically similar neighbors for a photo */
export function getNeighbors(id: string): string[] {
  return colorData[id]?.neighbors ?? [];
}

/** Get brightness (0-1, 0=dark, 1=bright) */
export function getBrightness(id: string): number {
  return colorData[id]?.brightness ?? 0.5;
}

/** Get color temperature (-1=cool/blue, +1=warm/red) */
export function getTemperature(id: string): number {
  return colorData[id]?.temperature ?? 0;
}

/** Get dominant colors as RGB triples */
export function getDominantColors(id: string): [number, number, number][] {
  return colorData[id]?.dominantColors ?? [[128, 128, 128]];
}
