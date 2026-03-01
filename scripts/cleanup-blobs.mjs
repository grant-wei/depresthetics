import { list, del } from "@vercel/blob";
import { config } from "dotenv";
config({ path: ".env.local" });

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log("Listing all blobs...");
  const toDelete = [];
  let cursor;
  let retries = 0;
  do {
    try {
      const result = await list({ cursor, limit: 1000 });
      for (const blob of result.blobs) {
        if (blob.pathname.includes("\\")) {
          toDelete.push(blob.url);
        }
      }
      cursor = result.hasMore ? result.cursor : undefined;
      retries = 0;
    } catch (err) {
      if (err.retryAfter && retries < 5) {
        await sleep((err.retryAfter + 2) * 1000);
        retries++;
      } else throw err;
    }
  } while (cursor);

  console.log(`Found ${toDelete.length} blobs with backslash paths to delete.`);

  // Delete in batches of 100
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    let done = false;
    let attempt = 0;
    while (!done && attempt < 5) {
      try {
        await del(batch);
        done = true;
      } catch (err) {
        if (err.retryAfter) {
          await sleep((err.retryAfter + 2) * 1000);
          attempt++;
        } else throw err;
      }
    }
    console.log(`  Deleted ${Math.min(i + 100, toDelete.length)}/${toDelete.length}`);
  }

  console.log("Cleanup done!");
}

main().catch(console.error);
