import assert from "node:assert/strict";
const base = process.env.FIN_URL ?? "http://127.0.0.1:5185";
for (const path of [
  "/",
  "/positions/",
  "/resultats/",
  "/methode/",
  "/manifest.webmanifest",
  "/research/tracker.json",
  "/research/protocole.md",
  "/openapi.json",
]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
}
for (const path of [
  "/crp/",
  "/api/state",
  "/api/crp/comparison",
  "/api/decisions",
  "/data/market.json",
])
  assert.equal((await fetch(base + path)).status, 410, path);
const view = await (await fetch(base + "/api/warrants/tracker")).json();
assert.equal(view.rule.capital, 1000);
assert.ok(Array.isArray(view.positions));
assert.ok(view.series.underlying);
const mcp = async (method, params) =>
  await (
    await fetch(base + "/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })
  ).json();
const tools = (await mcp("tools/list")).result.tools;
assert.equal(tools.length, 4);
for (const t of tools) {
  assert.ok(t.annotations.readOnlyHint);
  const r = await mcp("tools/call", { name: t.name, arguments: {} });
  assert.ok(r.result.structuredContent, t.name);
}
assert.ok(
  (
    await mcp("tools/call", {
      name: tools[0].name,
      arguments: { budget: 3000 },
    })
  ).error,
);
assert.equal(
  (await fetch(base + "/api/warrants/tracker", { method: "POST" })).status,
  405,
);
console.log(
  JSON.stringify({
    routes: 8,
    retired: 5,
    mcp: tools.length,
    selected: view.stats.selected,
    closed: view.stats.closed,
  }),
);
