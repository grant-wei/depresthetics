import { glob } from "glob";
import sharp from "sharp";
import pLimit from "p-limit";
import { existsSync } from "fs";
import path from "path";

const WIDTHS = [300, 600];
const QUALITY = { 300: 75, 600: 80 };
const CONCURRENCY = 8;

const limit = pLimit(CONCURRENCY);

const files = await glob("public/photos/{2023,2024,2025}/*.jpg", {
  ignore: ["**/*.300w.jpg", "**/*.600w.jpg"],
});

console.log(`Found ${files.length} source images`);

let created = 0;
let skipped = 0;

const tasks = files.flatMap((file) =>
  WIDTHS.map((w) =>
    limit(async () => {
      const ext = path.extname(file);
      const base = file.slice(0, -ext.length);
      const out = `${base}.${w}w${ext}`;

      if (existsSync(out)) {
        skipped++;
        return;
      }

      await sharp(file)
        .resize({ width: w, withoutEnlargement: true })
        .jpeg({ quality: QUALITY[w], mozjpeg: true })
        .toFile(out);

      created++;
    })
  )
);

await Promise.all(tasks);
console.log(`Done — created ${created}, skipped ${skipped} (already exist)`);
