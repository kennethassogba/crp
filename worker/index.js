import { snapshotAt, momentum, position, HOUR } from "../lib/strategy.mjs";
import { MODELS } from "../lib/models.mjs";
import { stateValue, tick } from "./jobs.js";
import { discovery, GUIDE, LINKS, TOOLS } from "./discovery.js";

const headers = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  Link: LINKS,
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
async function assetJSON(env, request, path) {
  const r = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
  if (!r.ok) throw new Error("Published dataset missing");
  return r.json();
}
async function decisions(env) {
  const data = await env.DB.prepare(
    "SELECT * FROM runs ORDER BY snapshot_at DESC,model LIMIT 600",
  ).all();
  return data.results.map(({ snapshot, decision, usage, result, ...r }) => ({
    ...r,
    snapshot: JSON.parse(snapshot),
    decision: decision ? JSON.parse(decision) : null,
    usage: usage ? JSON.parse(usage) : null,
    result: result ? JSON.parse(result) : null,
  }));
}
async function current(env, request) {
  const stored = await stateValue(env, "market");
  const market = stored ?? (await assetJSON(env, request, "/data/market.json"));
  const at = market.to;
  const snapshot = snapshotAt(market, at);
  const rows = await decisions(env);
  const budget = await env.DB.prepare(
    "SELECT * FROM budget WHERE id=1",
  ).first();
  return {
    asOf: at,
    collectedAt: market.collectedAt,
    stale: Date.now() - at > 2 * HOUR,
    source: market.source,
    configured: Boolean(env.OPENAI_API_KEY),
    snapshot,
    reference: {
      ...momentum(snapshot),
      ...position(momentum(snapshot), snapshot),
    },
    models: MODELS.map(
      ({ input, output, maxOutput, effort, endpoint, ...m }) => m,
    ),
    decisions: rows,
    budget,
    scheduler: await stateValue(env, "scheduler"),
    prices: Object.fromEntries(
      Object.entries(market.assets).map(([k, s]) => [
        k,
        s.bars.slice(-24 * 30),
      ]),
    ),
  };
}
async function mcp(request, env) {
  if (request.method === "GET")
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (request.method !== "POST")
    return json({ error: "Use POST for MCP." }, 405);
  if (Number(request.headers.get("content-length") || 0) > 8192)
    return json({ error: "Request exceeds 8 KB." }, 413);
  const text = await request.text();
  if (text.length > 8192) return json({ error: "Request exceeds 8 KB." }, 413);
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Invalid JSON" },
      },
      400,
    );
  }
  const { id, method, params } = msg;
  if (id === undefined) return new Response(null, { status: 202, headers });
  let result;
  if (method === "initialize")
    result = {
      protocolVersion: "2025-11-25",
      capabilities: { tools: {} },
      serverInfo: { name: "crp", version: "1.0.0" },
    };
  else if (method === "ping") result = {};
  else if (method === "tools/list") result = { tools: TOOLS };
  else if (
    method === "tools/call" &&
    ["get_daily_decisions", "get_backtest"].includes(params?.name)
  ) {
    const data =
      params.name === "get_backtest"
        ? await assetJSON(env, request, "/data/backtest.json")
        : await current(env, request);
    result = {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data,
    };
  } else
    return json(
      {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: "Method or tool not found" },
      },
      200,
    );
  return json({ jsonrpc: "2.0", id, result });
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === "/mcp") return await mcp(request, env);
      if (!["GET", "HEAD"].includes(request.method))
        return json({ error: "This API is read-only." }, 405);
      const d = await discovery(path);
      if (d)
        return new Response(
          request.method === "HEAD"
            ? null
            : typeof d.body === "string"
              ? d.body
              : JSON.stringify(d.body),
          {
            headers: {
              ...headers,
              "Content-Type": d.type ?? "application/json",
              "Cache-Control": "public, max-age=300",
            },
          },
        );
      if (
        path === "/" &&
        (request.headers.get("Accept") ?? "").includes("text/markdown")
      )
        return new Response(request.method === "HEAD" ? null : GUIDE, {
          headers: {
            ...headers,
            "Content-Type": "text/markdown",
            Vary: "Accept",
          },
        });
      if (path === "/api/state") return json(await current(env, request));
      if (path === "/api/decisions")
        return json({ decisions: await decisions(env) });
      if (path === "/api/backtest")
        return json(await assetJSON(env, request, "/data/backtest.json"));
      if (path.startsWith("/api/"))
        return json({ error: "Endpoint not found. Read /openapi.json." }, 404);
      const response = await env.ASSETS.fetch(
        path === "/"
          ? new Request(new URL("/index.html", request.url), request)
          : request,
      );
      const next = new Response(response.body, response);
      Object.entries(headers).forEach(([k, v]) => next.headers.set(k, v));
      if (path === "/") {
        next.headers.set("Cache-Control", "no-store");
        next.headers.set("Vary", "Accept");
      }
      if (!["localhost", "127.0.0.1"].includes(new URL(request.url).hostname))
        next.headers.set(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        );
      return next;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "request_failed",
          path,
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      return json(
        {
          error:
            "Data is temporarily unavailable. Retry shortly or open the published dataset.",
          dataset: "/data/backtest.json",
        },
        503,
      );
    }
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      tick(env).catch((error) =>
        console.error(
          JSON.stringify({
            event: "scheduled_failed",
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        ),
      ),
    );
  },
};
