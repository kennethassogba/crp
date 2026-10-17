import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
const batch = JSON.parse(await readFile("data/private/seed.json", "utf8"));
let count = 0;
for (const root of [
  ".wrangler/state/v3/d1",
  "dist/crp_keff/.wrangler/state/v3/d1",
]) {
  let files = [];
  try {
    files = await readdir(root, { recursive: true });
  } catch {
    continue;
  }
  for (const file of files.filter(
    (f) => f.endsWith(".sqlite") && !f.endsWith("metadata.sqlite"),
  )) {
    const db = new DatabaseSync(`${root}/${file}`);
    for (const q of batch) db.prepare(q.sql).run(...(q.params ?? []));
    db.close();
    count++;
  }
}
console.log(`Seeded ${count} local databases`);
