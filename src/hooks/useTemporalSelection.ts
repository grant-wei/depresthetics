import { useMemo } from "react";
import type { Photo } from "../types";
import { getBrightness, getTemperature, hasColorData } from "../data/colorData";

/**
 * Builds a temporally-biased queue from visible photos.
 *
 * - Night (8pm-6am): prefer darker/moodier photos (low brightness)
 * - Day: prefer brighter photos
 * - Winter months (Nov-Feb): prefer warm tones
 * - Summer months (May-Aug): prefer cool tones
 *
 * Implemented as a weighted shuffle — subtle bias, not deterministic filtering.
 */
export function useTemporalSelection(photos: Photo[]): string[] {
  return useMemo(() => {
    if (photos.length === 0) return [];

    const now = new Date();
    const hour = now.getHours();
    const month = now.getMonth(); // 0-11

    // Night bias: prefer dark photos (low brightness)
    const isNight = hour >= 20 || hour < 6;
    const brightnessBias = isNight ? -1 : 1; // -1 = prefer dark, +1 = prefer bright

    // Season bias: winter = prefer warm, summer = prefer cool
    const isWinter = month >= 10 || month <= 1;  // Nov-Feb
    const isSummer = month >= 4 && month <= 7;    // May-Aug
    const tempBias = isWinter ? 1 : isSummer ? -1 : 0; // +1 = warm, -1 = cool

    // Score each photo
    const scored = photos.map((photo) => {
      let weight = 1.0;

      if (hasColorData()) {
        const brightness = getBrightness(photo.id);
        const temperature = getTemperature(photo.id);

        // Brightness alignment: how well does this photo match the time of day?
        // brightnessBias=-1 (night): dark photos get bonus
        // brightnessBias=+1 (day): bright photos get bonus
        const brightnessScore = brightnessBias * (brightness - 0.5);
        weight += brightnessScore * 0.3; // Subtle: max +-0.15 weight shift

        // Temperature alignment
        if (tempBias !== 0) {
          const tempScore = tempBias * temperature;
          weight += tempScore * 0.2; // Even subtler: max +-0.2
        }
      }

      // Clamp to prevent negative weights
      weight = Math.max(0.1, weight);

      return { id: photo.id, weight };
    });

    // Weighted shuffle (Efraimidis-Spirakis algorithm)
    // For each item, compute key = random^(1/weight), sort descending
    const keyed = scored.map(({ id, weight }) => ({
      id,
      key: Math.pow(Math.random(), 1 / weight),
    }));

    keyed.sort((a, b) => b.key - a.key);

    return keyed.map((k) => k.id);
  }, [photos]);
}
