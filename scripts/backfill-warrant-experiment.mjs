import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { recordWarrantQuotes } from "../lib/warrant-experiment.mjs";
const path = "public/research/snapshot.json";
const data = JSON.parse(await readFile(path, "utf8"));
if (data.warrantExperiment)
  throw Error("Archive exists; refusing to reset entries");
const commits = execFileSync(
  "git",
  ["log", "--reverse", "--format=%H", "--", path],
  { encoding: "utf8" },
)
  .trim()
  .split("\n");
let archive;
for (const commit of commits) {
  const historical = JSON.parse(
    execFileSync("git", ["show", `${commit}:${path}`], {
      encoding: "utf8",
      maxBuffer: 10_000_000,
    }),
  );
  archive = recordWarrantQuotes(archive, historical.products);
}
data.warrantExperiment = recordWarrantQuotes(archive, data.products);
await writeFile(path, JSON.stringify(data));
console.log(
  `Archived ${data.warrantExperiment.contracts.length} contracts from ${commits.length} committed snapshots`,
);
