import { trackerView } from "../lib/warrant-tracker.mjs";
import { discovery, GUIDE, LINKS, TOOLS } from "./discovery.js";
import { legacyRedirect, htmlEntry } from "../lib/site-routing.mjs";
const headers = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  Link: LINKS,
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
async function assetJSON(env, request, path) {
  const r = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
  if (!r.ok) throw Error("Published data unavailable");
  return r.json();
}
async function dataFor(name, env, request) {
  if (name === "get_warrant_catalog")
    return assetJSON(env, request, "/research/snapshot.json");
  const view = trackerView(
    await assetJSON(env, request, "/research/tracker.json"),
  );
  const market = await assetJSON(env, request, "/research/snapshot.json");
  view.series = {
    underlying: market.assets,
    warrant: Object.fromEntries(
      (market.warrantExperiment?.contracts ?? [])
        .filter((c) =>
          view.positions.some((p) => p.product.isin === c.product.isin),
        )
        .map((c) => [
          c.product.isin,
          c.quotes.map((q) => ({ at: q.at, value: q.bid })),
        ]),
    ),
  };
  if (name === "get_warrant_results")
    return { asOf: view.asOf, rule: view.rule, stats: view.stats };
  if (name === "get_warrant_selections")
    return {
      asOf: view.asOf,
      scan: view.scan,
      batches: view.batches,
      positions: view.positions.filter(
        (p) => p.day === view.batches.at(-1)?.day,
      ),
    };
  return view;
}
async function mcp(request, env) {
  if (request.method !== "POST") return json({ error: "POST required" }, 405);
  if (Number(request.headers.get("content-length")) > 8192)
    return json({ error: "Request too large" }, 413);
  const text = await request.text();
  if (text.length > 8192) return json({ error: "Request too large" }, 413);
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
  if (
    !msg ||
    Array.isArray(msg) ||
    msg.jsonrpc !== "2.0" ||
    typeof msg.method !== "string"
  )
    return json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid request" },
      },
      400,
    );
  const { id, method, params } = msg;
  if (id === undefined) return new Response(null, { status: 202, headers });
  let result;
  if (method === "initialize")
    result = {
      protocolVersion: "2025-11-25",
      capabilities: { tools: {} },
      serverInfo: { name: "fin-warrants", version: "2.0.0" },
    };
  else if (method === "ping") result = {};
  else if (method === "tools/list") result = { tools: TOOLS };
  else if (
    method === "tools/call" &&
    TOOLS.some((t) => t.name === params?.name)
  ) {
    if (
      params.arguments !== undefined &&
      (!params.arguments ||
        Array.isArray(params.arguments) ||
        typeof params.arguments !== "object" ||
        Object.keys(params.arguments).length)
    )
      return json({
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "No arguments accepted" },
      });
    const data = await dataFor(params.name, env, request);
    result = {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data,
    };
  } else
    return json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method or tool not found" },
    });
  return json({ jsonrpc: "2.0", id, result });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url),
      path = url.pathname,
      redirect = legacyRedirect(url);
    if (redirect) return Response.redirect(redirect, 308);
    if (["/positions", "/resultats", "/methode"].includes(path))
      return Response.redirect(new URL(path + "/" + url.search, url).href, 308);
    try {
      if (path === "/mcp") return await mcp(request, env);
      if (!["GET", "HEAD"].includes(request.method))
        return json({ error: "Lecture seule" }, 405);
      // Removed product: no database read, paid call or legacy static fallback.
      if (
        path.startsWith("/crp") ||
        path.startsWith("/api/crp") ||
        [
          "/api/state",
          "/api/decisions",
          "/api/backtest",
          "/api/source-health",
        ].includes(path) ||
        path.startsWith("/data/")
      )
        return json({ error: "CRP a été retiré." }, 410);
      const d = discovery(path);
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
              "Cache-Control": "public,max-age=300",
            },
          },
        );
      if (
        path === "/" &&
        (request.headers.get("accept") ?? "").includes("text/markdown")
      )
        return new Response(GUIDE, {
          headers: {
            ...headers,
            "Content-Type": "text/markdown",
            Vary: "Accept",
          },
        });
      const api = {
        "/api/warrants/tracker": "get_warrant_positions",
        "/api/warrants/selections": "get_warrant_selections",
        "/api/warrants/positions": "get_warrant_positions",
        "/api/warrants/results": "get_warrant_results",
      };
      if (api[path]) return json(await dataFor(api[path], env, request));
      if (path.startsWith("/api/"))
        return json({ error: "Endpoint inconnu. /openapi.json" }, 404);
      const response = await env.ASSETS.fetch(
        htmlEntry(path)
          ? new Request(new URL("/index.html", url), request)
          : request,
      );
      const next = new Response(response.body, response);
      Object.entries(headers).forEach(([k, v]) => next.headers.set(k, v));
      if (path.startsWith("/research/") || htmlEntry(path))
        next.headers.set("Cache-Control", "no-store");
      if (!["localhost", "127.0.0.1"].includes(url.hostname))
        next.headers.set(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        );
      return next;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "data_unavailable",
          path,
          error: error.message,
        }),
      );
      return json(
        {
          error: "Données indisponibles. Réessayer.",
          dataset: "/research/tracker.json",
        },
        503,
      );
    }
  },
};
