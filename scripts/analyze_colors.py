"""Analyze photos for CLIP semantic similarity + color properties.

Extracts per-photo:
  1. CLIP embedding (512-dim) — semantic similarity via cosine distance
  2. Dominant colors (k=3 k-means on RGB pixels)
  3. Brightness (mean luminance, 0-1)
  4. Color temperature (warm/cool, -1 to +1)

Computes top-8 nearest neighbors per photo from CLIP embeddings.
Outputs src/data/colorData.json.

Usage:
    python scripts/analyze_colors.py

Requires: torch, transformers, sklearn, PIL
"""

import csv
import json
import sys
from pathlib import Path

import os
import numpy as np
from PIL import Image

# Prevent OpenMP/MKL threading deadlocks
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

PHOTOS_DIR = Path("C:/Github/art-projects/depresthetics")
CSV_PATH = PHOTOS_DIR / "metadata.csv"
OUT_PATH = Path(__file__).parent.parent / "src" / "data" / "colorData.json"

# Match to_ts.py's deduplication to get correct IDs
ANALYZE_SIZE = 128  # Resize for color analysis (small, fast)
CLIP_SIZE = 224     # CLIP input size
K_NEIGHBORS = 8     # Top neighbors per photo
K_COLORS = 3        # Dominant color clusters


def load_photo_ids() -> list[dict]:
    """Load metadata and compute photo IDs matching to_ts.py logic."""
    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    # Deduplicate by URL (same logic as to_ts.py)
    seen = set()
    unique = []
    for row in rows:
        if row["url"] not in seen:
            seen.add(row["url"])
            unique.append(row)

    result = []
    for i, row in enumerate(unique):
        photo_id = f"{row['year']}_{i:04d}"
        path = PHOTOS_DIR / row["year"] / row["filename"]
        result.append({
            "id": photo_id,
            "path": path,
            "year": row["year"],
            "filename": row["filename"],
        })

    return result


def extract_colors(img: Image.Image) -> dict:
    """Extract dominant colors, brightness, and temperature from an image.

    Uses quantile-based color extraction (no sklearn needed).
    """
    img_small = img.copy()
    img_small.thumbnail((ANALYZE_SIZE, ANALYZE_SIZE), Image.LANCZOS)
    rgb = img_small.convert("RGB")

    pixels = np.array(rgb).reshape(-1, 3).astype(np.float64)

    # Dominant colors via luminance-based quantile splitting (fast, no sklearn)
    lum = 0.299 * pixels[:, 0] + 0.587 * pixels[:, 1] + 0.114 * pixels[:, 2]
    terciles = np.percentile(lum, [33, 66])
    dark = pixels[lum <= terciles[0]]
    mid = pixels[(lum > terciles[0]) & (lum <= terciles[1])]
    light = pixels[lum > terciles[1]]
    centers = []
    for group in [mid, dark, light]:  # mid first (largest visual area)
        if len(group) > 0:
            centers.append(group.mean(axis=0).astype(int).tolist())
        else:
            centers.append([128, 128, 128])

    # Brightness: mean luminance (0-1)
    brightness = float(lum.mean() / 255.0)

    # Color temperature: warm(+1) to cool(-1)
    r_mean = pixels[:, 0].mean()
    b_mean = pixels[:, 2].mean()
    temp_raw = (r_mean - b_mean) / 255.0
    temperature = float(np.clip(temp_raw * 2, -1, 1))

    return {
        "dominantColors": centers,
        "brightness": round(brightness, 3),
        "temperature": round(temperature, 3),
    }


def compute_clip_embeddings(photo_list: list[dict]) -> np.ndarray:
    """Compute CLIP embeddings for all photos. Returns (N, 512) array."""
    # Import here so color-only mode doesn't need torch
    import torch
    from transformers import CLIPModel, CLIPProcessor

    print("Loading CLIP model (clip-vit-base-patch32)...")
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    model.eval()

    embeddings = []
    batch_size = 16

    for batch_start in range(0, len(photo_list), batch_size):
        batch = photo_list[batch_start:batch_start + batch_size]
        images = []

        for entry in batch:
            try:
                img = Image.open(entry["path"]).convert("RGB")
                images.append(img)
            except Exception as e:
                print(f"  ERROR loading {entry['path'].name}: {e}", file=sys.stderr)
                # Use a blank image as fallback
                images.append(Image.new("RGB", (CLIP_SIZE, CLIP_SIZE), (128, 128, 128)))

        inputs = processor(images=images, return_tensors="pt", padding=True)

        with torch.no_grad():
            outputs = model.get_image_features(**inputs)
            # transformers 5.x returns BaseModelOutputWithPooling, not a tensor
            if not isinstance(outputs, torch.Tensor):
                outputs = outputs.image_embeds if hasattr(outputs, "image_embeds") else outputs[1]
            # Normalize embeddings
            normed = outputs / outputs.norm(dim=-1, keepdim=True)
            embeddings.append(normed.cpu().numpy())

        done = min(batch_start + batch_size, len(photo_list))
        if done % 100 < batch_size or done == len(photo_list):
            print(f"  CLIP embeddings: {done}/{len(photo_list)}")

    return np.vstack(embeddings)


def compute_neighbors(embeddings: np.ndarray, k: int = K_NEIGHBORS) -> list[list[int]]:
    """Compute top-k nearest neighbors for each photo via cosine similarity."""
    # Embeddings are already normalized, so dot product = cosine similarity
    print("Computing similarity matrix...")
    sim = embeddings @ embeddings.T

    neighbors = []
    for i in range(len(sim)):
        # Zero out self-similarity
        sim[i, i] = -1
        # Top-k indices
        top_k = np.argsort(-sim[i])[:k]
        neighbors.append(top_k.tolist())

    return neighbors


def main():
    photo_list = load_photo_ids()
    print(f"Found {len(photo_list)} photos")

    # Phase 1: Color analysis
    print("\nPhase 1: Extracting colors, brightness, temperature...")
    color_data = {}

    for i, entry in enumerate(photo_list):
        try:
            img = Image.open(entry["path"])
            colors = extract_colors(img)
            color_data[entry["id"]] = colors
        except Exception as e:
            print(f"  ERROR analyzing {entry['filename']}: {e}", file=sys.stderr)
            color_data[entry["id"]] = {
                "dominantColors": [[128, 128, 128], [64, 64, 64], [192, 192, 192]],
                "brightness": 0.5,
                "temperature": 0.0,
            }

        if (i + 1) % 25 == 0 or i == 0:
            print(f"  Colors: {i + 1}/{len(photo_list)}")

    # Phase 2: CLIP embeddings + neighbors
    print("\nPhase 2: Computing CLIP embeddings...")
    embeddings = compute_clip_embeddings(photo_list)

    print("\nPhase 3: Computing nearest neighbors...")
    neighbor_indices = compute_neighbors(embeddings)

    # Merge neighbors into color_data
    id_list = [entry["id"] for entry in photo_list]
    for i, entry in enumerate(photo_list):
        neighbor_ids = [id_list[j] for j in neighbor_indices[i]]
        color_data[entry["id"]]["neighbors"] = neighbor_ids

    # Write output
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(color_data, f, separators=(",", ":"))

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"\nWritten to {OUT_PATH}")
    print(f"  {len(color_data)} entries, {size_kb:.1f} KB")

    # Spot check
    sample_id = id_list[0]
    sample = color_data[sample_id]
    print(f"\nSample ({sample_id}):")
    print(f"  Colors: {sample['dominantColors']}")
    print(f"  Brightness: {sample['brightness']}")
    print(f"  Temperature: {sample['temperature']}")
    print(f"  Neighbors: {sample['neighbors'][:3]}...")


if __name__ == "__main__":
    main()
