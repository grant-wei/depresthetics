import { put, list } from "@vercel/blob";
import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";
import pLimit from "p-limit";
import { config } from "dotenv";

config({ path: ".env.local" });

const CONCURRENCY = 3;
const MAX_RETRIES = 5;
const limit = pLimit(CONCURRENCY);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function listAllBlobs() {
  const map = {};
  let cursor;
  let retries = 0;
  do {
    try {
      const result = await list({ cursor, limit: 1000 });
      for (const blob of result.blobs) {
        map[blob.pathname] = blob.url;
      }
      cursor = result.hasMore ? result.cursor : undefined;
      retries = 0;
    } catch (err) {
      if (err.retryAfter && retries < MAX_RETRIES) {
        const wait = (err.retryAfter + 2) * 1000;
        console.log(`  Rate limited listing blobs, waiting ${wait / 1000}s...`);
        await sleep(wait);
        retries++;
      } else {
        throw err;
      }
    }
  } while (cursor !== undefined);
  return map;
}

async function uploadWithRetry(file, pathname) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const data = readFileSync(file);
      const blob = await put(pathname, data, {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: false,
      });
      return blob.url;
    } catch (err) {
      if (err.retryAfter && attempt < MAX_RETRIES - 1) {
        const wait = (err.retryAfter + 2) * 1000;
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Missing BLOB_READ_WRITE_TOKEN. Run: npx vercel env pull .env.local");
    process.exit(1);
  }

  console.log("Checking existing blobs...");
  const existingMap = await listAllBlobs();
  const existingPaths = new Set(Object.keys(existingMap));
  console.log(`Found ${existingPaths.size} already uploaded.`);

  const files = await glob("public/photos/{2023,2024,2025}/*.jpg");
  console.log(`Found ${files.length} local files.`);

  // Debug: show sample paths
  const sampleLocal = files.slice(0, 2).map(f => f.replace(/^public[\\/]/, "").replace(/\\/g, "/"));
  const sampleBlob = [...existingPaths].slice(0, 2);
  console.log("Sample LOCAL normalized:", sampleLocal);
  console.log("Sample BLOB pathnames:", sampleBlob);

  const toUpload = files.filter((f) => {
    const pathname = f.replace(/^public[\\/]/, "").replace(/\\/g, "/");
    return !existingPaths.has(pathname);
  });

  console.log(`Uploading ${toUpload.length} new files (skipping ${files.length - toUpload.length})...`);

  let done = 0;
  let failed = 0;

  const tasks = toUpload.map((file) =>
    limit(async () => {
      const pathname = file.replace(/^public[\\/]/, "").replace(/\\/g, "/");
      try {
        const url = await uploadWithRetry(file, pathname);
        existingMap[pathname] = url;
        done++;
        if (done % 50 === 0 || done === toUpload.length) {
          console.log(`  ${done}/${toUpload.length} uploaded...`);
        }
      } catch (err) {
        failed++;
        console.error(`  FAILED: ${pathname} — ${err.message}`);
      }
    })
  );

  await Promise.all(tasks);
  console.log(`\nDone! ${done} uploaded, ${failed} failed.`);

  if (failed > 0) {
    console.log("Re-run this script to retry failed uploads.");
  }

  // Build complete URL map
  console.log("Building complete URL map...");
  const fullMap = await listAllBlobs();
  writeFileSync("scripts/blob-url-map.json", JSON.stringify(fullMap, null, 2));
  console.log(`Wrote URL map with ${Object.keys(fullMap).length} entries to scripts/blob-url-map.json`);
}

main().catch(console.error);
