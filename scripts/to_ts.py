"""Convert metadata.csv + quality_scores.csv -> src/data/photos.ts

Usage:
    python scripts/to_ts.py

Reads from art-projects/depresthetics/metadata.csv
         art-projects/depresthetics/quality_scores.csv
Writes to  src/data/photos.ts
"""

import csv
import json
from pathlib import Path

PHOTOS_DIR = Path("C:/Github/art-projects/depresthetics")
CSV_PATH = PHOTOS_DIR / "metadata.csv"
QUALITY_PATH = PHOTOS_DIR / "quality_scores.csv"
OUT_PATH = Path(__file__).parent.parent / "src" / "data" / "photos.ts"

HIDE_THRESHOLD = 15  # Score below this = junk frame, hidden by default


def orientation(w: int, h: int) -> str:
    if w == 0 or h == 0:
        return "landscape"
    ratio = w / h
    if ratio > 1.1:
        return "landscape"
    elif ratio < 0.9:
        return "portrait"
    return "square"


def main():
    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    # Load quality scores
    quality = {}
    if QUALITY_PATH.exists():
        with open(QUALITY_PATH, encoding="utf-8") as f:
            for qr in csv.DictReader(f):
                key = (qr["year"], qr["filename"])
                quality[key] = float(qr["quality_score"])
        print(f"Loaded {len(quality)} quality scores")

    # Deduplicate by URL
    seen = set()
    unique = []
    for row in rows:
        if row["url"] not in seen:
            seen.add(row["url"])
            unique.append(row)

    photos = []
    hidden_count = 0
    for i, row in enumerate(unique):
        w = int(row["width"]) if row["width"] else 0
        h = int(row["height"]) if row["height"] else 0
        ar = round(w / h, 3) if h > 0 else 1.5

        key = (row["year"], row["filename"])
        score = quality.get(key, 100)
        is_hidden = score < HIDE_THRESHOLD
        if is_hidden:
            hidden_count += 1

        photos.append({
            "id": f"{row['year']}_{i:04d}",
            "url": row["url"],
            "filename": row["filename"],
            "year": row["year"],
            "location": row["location"],
            "filmStock": row["film_stock"],
            "devDate": row["dev_date"],
            "width": w,
            "height": h,
            "orientation": orientation(w, h),
            "aspectRatio": ar,
            "hidden": is_hidden,
        })

    # Generate TypeScript
    lines = [
        'import type { Photo } from "../types";',
        "",
        "export const photos: Photo[] = ",
    ]

    json_str = json.dumps(photos, indent=2, ensure_ascii=False)
    lines.append(json_str + ";")

    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")

    # Stats
    visible = [p for p in photos if not p["hidden"]]
    years = set(p["year"] for p in visible)
    locations = set(p["location"] for p in visible if p["location"])
    films = set(p["filmStock"] for p in visible if p["filmStock"])
    print(f"Generated {OUT_PATH}")
    print(f"  {len(photos)} total photos ({hidden_count} hidden, {len(visible)} visible)")
    print(f"  {len(years)} years: {sorted(years)}")
    print(f"  {len(locations)} locations")
    print(f"  {len(films)} film stocks")
    print(f"  File size: {OUT_PATH.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
