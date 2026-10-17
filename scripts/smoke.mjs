import assert from "node:assert/strict";
const base = process.env.CRP_URL ?? "https://crp.keff.uk";
for (const path of [
  "/",
  "/manifest.webmanifest",
  "/sw.js",
  "/social-card.png",
  "/icon-192.png",
  "/api/state",
  "/api/backtest",
  "/api/decisions",
  "/openapi.json",
  "/index.md",
  "/robots.txt",
  "/.well-known/api-catalog",
  "/.well-known/mcp/server-card.json",
  "/.well-known/agent-skills/index.json",
]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
  console.log(`${r.status} ${path}`);
}
const state = await (await fetch(base + "/api/state")).json();
assert.ok(state.budget.cap <= 15);
assert.equal(state.models.length, 5);
assert.ok(state.asOf > 0);
const markdown = await fetch(base + "/", {
  headers: { Accept: "text/markdown" },
});
assert.ok(markdown.headers.get("content-type").includes("text/markdown"));
const mcp = await (
  await fetch(base + "/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  })
).json();
assert.equal(mcp.result.tools.length, 2);
const forbidden = await fetch(base + "/api/state", { method: "POST" });
assert.equal(forbidden.status, 405);
console.log(
  JSON.stringify({
    configured: state.configured,
    decisions: state.decisions.length,
    budget: state.budget,
    stale: state.stale,
  }),
);
