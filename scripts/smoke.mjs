import assert from "node:assert/strict";
const base = process.env.CRP_URL ?? "https://fin.keff.uk";
for (const path of [
  "/",
  "/manifest.webmanifest",
  "/sw.js",
  "/social-card.png",
  "/icon-192.png",
  "/api/state",
  "/api/crp/comparison",
  "/api/warrants/comparison",
  "/api/warrants/portfolio",
  "/warrants/experience/",
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
assert.equal(state.models.length, 3);
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
assert.equal(mcp.result.tools.length, 5);
for (const name of [
  "get_crp_comparison",
  "get_warrant_catalog",
  "get_warrant_experiment",
]) {
  const r = await (
    await fetch(base + "/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: name,
        method: "tools/call",
        params: { name, arguments: {} },
      }),
    })
  ).json();
  assert.ok(r.result?.structuredContent, name);
  if (name === "get_crp_comparison") {
    assert.equal(r.result.structuredContent.capital, 1000);
    assert.equal(r.result.structuredContent.models.length, 3);
    assert.equal(r.result.structuredContent.fxIncluded, false);
  } else if (name === "get_warrant_experiment") {
    const expected = await (
      await fetch(base + "/api/warrants/portfolio")
    ).json();
    assert.deepEqual(r.result.structuredContent, expected);
    assert.equal(expected.capital, 1000);
    assert.equal(expected.positions.length, 1);
    assert.equal(expected.positions[0].quantity, 689);
  } else assert.ok(r.result.structuredContent.products.length > 0);
}
const invalidTool = await (
  await fetch(base + "/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_crp_comparison", arguments: { budget: 1000 } },
    }),
  })
).json();
assert.equal(invalidTool.error.code, -32602);
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
