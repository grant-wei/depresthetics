"""Score photo quality using image analysis.

Metrics:
  1. Sharpness  — Laplacian variance (edge energy). Low = blurry/soft.
  2. Contrast   — Std dev of luminance. Low = flat/washed out.
  3. Exposure   — Mean luminance distance from midpoint. Extreme = over/underexposed.
  4. Detail     — Entropy of luminance histogram. Low = featureless/blank.

Each metric is normalized to 0-100 across the collection, then combined
into a weighted composite score. Photos are classified into tiers:
  A (top 30%)  — show by default
  B (30-60%)   — show by default
  C (60-85%)   — hide by default (can reveal with filter)
  D (bottom 15%) — always hidden

Outputs quality_scores.csv alongside metadata.csv.
"""

import csv
import math
import sys
from pathlib import Path
from PIL import Image, ImageFilter, ImageStat

PHOTOS_DIR = Path("C:/Github/art-projects/depresthetics")
CSV_PATH = PHOTOS_DIR / "metadata.csv"
OUT_PATH = PHOTOS_DIR / "quality_scores.csv"

# Analysis at this size (fast, normalizes resolution differences)
ANALYZE_SIZE = 512


def analyze(img_path: Path) -> dict:
    """Compute quality metrics for a single image."""
    try:
        img = Image.open(img_path)
    except Exception as e:
        print(f"  ERROR reading {img_path.name}: {e}", file=sys.stderr)
        return {"sharpness": 0, "contrast": 0, "exposure": 50, "detail": 0}

    # Resize for consistent analysis
    img.thumbnail((ANALYZE_SIZE, ANALYZE_SIZE), Image.LANCZOS)
    gray = img.convert("L")

    # 1. Sharpness — variance of Laplacian (edge detection)
    laplacian = gray.filter(ImageFilter.Kernel(
        size=(3, 3),
        kernel=[-1, -1, -1, -1, 8, -1, -1, -1, -1],
        scale=1,
        offset=128,
    ))
    lap_stat = ImageStat.Stat(laplacian)
    sharpness = lap_stat.var[0]  # Higher = sharper

    # 2. Contrast — standard deviation of luminance
    gray_stat = ImageStat.Stat(gray)
    contrast = gray_stat.stddev[0]  # Higher = more contrast

    # 3. Exposure — how far mean luminance is from ideal midpoint (128)
    mean_lum = gray_stat.mean[0]
    # 0 = perfect exposure, 100 = extremely over/underexposed
    exposure_penalty = abs(mean_lum - 128) / 128 * 100

    # 4. Detail — entropy of luminance histogram (information content)
    histogram = gray.histogram()
    total = sum(histogram)
    entropy = 0
    for count in histogram:
        if count > 0:
            p = count / total
            entropy -= p * math.log2(p)
    # Max entropy for 256 bins is 8.0
    detail = (entropy / 8.0) * 100

    return {
        "sharpness": sharpness,
        "contrast": contrast,
        "exposure_penalty": exposure_penalty,
        "detail": detail,
    }


def normalize(values: list[float]) -> list[float]:
    """Normalize to 0-100 range."""
    if not values:
        return values
    lo, hi = min(values), max(values)
    if hi == lo:
        return [50.0] * len(values)
    return [(v - lo) / (hi - lo) * 100 for v in values]


def main():
    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"Analyzing {len(rows)} photos...")

    # Analyze all photos
    results = []
    for i, row in enumerate(rows):
        path = PHOTOS_DIR / row["year"] / row["filename"]
        metrics = analyze(path)
        metrics["filename"] = row["filename"]
        metrics["year"] = row["year"]
        results.append(metrics)

        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(rows)}...")

    # Normalize each metric to 0-100
    sharpness_raw = [r["sharpness"] for r in results]
    contrast_raw = [r["contrast"] for r in results]
    exposure_raw = [r["exposure_penalty"] for r in results]
    detail_raw = [r["detail"] for r in results]

    sharpness_norm = normalize(sharpness_raw)
    contrast_norm = normalize(contrast_raw)
    exposure_norm = normalize(exposure_raw)
    detail_norm = normalize(detail_raw)

    # Composite score (weighted)
    # Sharpness matters most for film. Exposure penalty is inverted (lower penalty = better).
    for i, r in enumerate(results):
        r["sharpness_score"] = round(sharpness_norm[i], 1)
        r["contrast_score"] = round(contrast_norm[i], 1)
        r["exposure_score"] = round(100 - exposure_norm[i], 1)  # Invert: good exposure = high
        r["detail_score"] = round(detail_norm[i], 1)

        composite = (
            r["sharpness_score"] * 0.35
            + r["contrast_score"] * 0.25
            + r["exposure_score"] * 0.20
            + r["detail_score"] * 0.20
        )
        r["quality_score"] = round(composite, 1)

    # Sort by score to compute percentile tiers
    scored = sorted(results, key=lambda r: r["quality_score"], reverse=True)
    n = len(scored)
    for rank, r in enumerate(scored):
        pct = rank / n * 100
        if pct < 30:
            r["tier"] = "A"
        elif pct < 60:
            r["tier"] = "B"
        elif pct < 85:
            r["tier"] = "C"
        else:
            r["tier"] = "D"

    # Write output
    fieldnames = [
        "year", "filename", "quality_score", "tier",
        "sharpness_score", "contrast_score", "exposure_score", "detail_score",
    ]
    # Sort by year + filename for stable output
    results.sort(key=lambda r: (r["year"], r["filename"]))

    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(results)

    # Stats
    tiers = {}
    for r in results:
        tiers[r["tier"]] = tiers.get(r["tier"], 0) + 1

    print(f"\nResults written to {OUT_PATH}")
    print(f"\nTier distribution:")
    for t in ["A", "B", "C", "D"]:
        count = tiers.get(t, 0)
        pct = count / n * 100
        label = {
            "A": "show (top quality)",
            "B": "show (good)",
            "C": "hidden (mediocre)",
            "D": "hidden (poor)",
        }[t]
        print(f"  {t}: {count:>4} ({pct:.0f}%) — {label}")

    # Show score range per tier
    for t in ["A", "B", "C", "D"]:
        tier_scores = [r["quality_score"] for r in results if r["tier"] == t]
        if tier_scores:
            print(f"  {t} score range: {min(tier_scores):.1f} – {max(tier_scores):.1f}")


if __name__ == "__main__":
    main()
