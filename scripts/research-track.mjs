import { readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { advanceTracker } from "../lib/warrant-tracker.mjs";
const input = "public/research/snapshot.json",
  output = "public/research/tracker.json";
const raw = await readFile(input, "utf8"),
  data = JSON.parse(raw);
let previous;
try {
  previous = JSON.parse(await readFile(output, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const at = new Date().toISOString(),
  next = advanceTracker(previous, data, at);
const batch = next.batches.find((b) => b.at === at);
if (batch) batch.inputSha256 = createHash("sha256").update(raw).digest("hex");
await writeFile(output + ".tmp", JSON.stringify(next));
await rename(output + ".tmp", output);
console.log(
  JSON.stringify({
    at,
    selected: batch?.ids.length ?? 0,
    total: next.positions.length,
    closed: next.positions.filter((p) => p.exit).length,
    eligible: next.scan?.eligible,
  }),
);
