import { list } from "@vercel/blob";
import { config } from "dotenv";
config({ path: ".env.local" });

// List ALL blob pathnames and check for prefix patterns
let cursor;
const prefixes = {};
let total = 0;
do {
  const result = await list({ cursor, limit: 1000 });
  for (const blob of result.blobs) {
    total++;
    const prefix = blob.pathname.split("/")[0];
    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
  }
  cursor = result.hasMore ? result.cursor : undefined;
} while (cursor);

console.log(`Total blobs: ${total}`);
console.log("Path prefixes:", prefixes);
