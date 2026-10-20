import { compareWarrants } from "../lib/warrant-experiment.mjs";
import { snapshotAt, momentum, position, HOUR } from "../lib/strategy.mjs";
import { MODELS } from "../lib/models.mjs";
import { compareCrp } from "../lib/crp-performance.mjs";
import { stateValue, setState, tick } from "./jobs.js";
import { discovery, GUIDE, LINKS, TOOLS } from "./discovery.js";
import { fetchJSON } from "../lib/market.mjs";
import { collectKraken } from "../lib/kraken.mjs";
import { legacyRedirect, htmlEntry } from "../lib/site-routing.mjs";

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
    comparison: {
      ...compareCrp(MODELS, rows, market),
      stale: Date.now() - at > 2 * HOUR,
      collectedAt: market.collectedAt,
    },
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
  if (
    !msg ||
    Array.isArray(msg) ||
    typeof msg !== "object" ||
    msg.jsonrpc !== "2.0" ||
    typeof msg.method !== "string"
  )
    return json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid JSON-RPC request" },
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
      serverInfo: { name: "fin", version: "1.1.0" },
    };
  else if (method === "ping") result = {};
  else if (method === "tools/list") result = { tools: TOOLS };
  else if (
    method === "tools/call" &&
    TOOLS.some((tool) => tool.name === params?.name)
  ) {
    if (
      params.arguments !== undefined &&
      (params.arguments === null ||
        typeof params.arguments !== "object" ||
        Array.isArray(params.arguments) ||
        Object.keys(params.arguments).length)
    )
      return json({
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "This tool accepts no arguments." },
      });
    const data =
      params.name === "get_backtest"
        ? await assetJSON(env, request, "/data/backtest.json")
        : params.name === "get_warrant_experiment"
          ? compareWarrants(
              await assetJSON(env, request, "/research/snapshot.json"),
            )
          : params.name === "get_warrant_catalog"
            ? await assetJSON(env, request, "/research/snapshot.json")
            : params.name === "get_crp_comparison"
              ? (await current(env, request)).comparison
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
    const url = new URL(request.url);
    const path = url.pathname;
    const redirect = legacyRedirect(url);
    if (redirect) return Response.redirect(redirect, 308);
    if (
      [
        "/crp",
        "/crp/modeles",
        "/crp/historique",
        "/crp/methode",
        "/donnees",
        "/warrants",
        "/warrants/experience",
        "/warrants/methode",
        "/warrants/suivi",
      ].includes(path)
    )
      return Response.redirect(new URL(path + "/" + url.search, url).href, 308);
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
        return new Response(
          request.method === "HEAD"
            ? null
            : "# fin — Projets finance\n\nWarrants : https://fin.keff.uk/warrants/\nMéthode : https://fin.keff.uk/research/protocole.md\nDonnées : https://fin.keff.uk/research/snapshot.json\nCRP : https://fin.keff.uk/crp/\nComparaison base 100 EUR : https://fin.keff.uk/api/crp/comparison\nAPI : https://fin.keff.uk/openapi.json\nMCP : https://fin.keff.uk/mcp\nGuide agent : https://fin.keff.uk/index.md\n\nRecherche exploratoire, cotations horodatées, aucun ordre transmis.\n",
          {
            headers: {
              ...headers,
              "Content-Type": "text/markdown",
              Vary: "Accept",
            },
          },
        );
      if (path === "/api/state") return json(await current(env, request));
      if (path === "/api/crp/comparison")
        return json((await current(env, request)).comparison);
      if (path === "/api/source-health") {
        const cached = await caches.default.match(request);
        if (cached) return cached;
        const checks = await Promise.all(
          [
            ["Binance", "https://fapi.binance.com/fapi/v1/time"],
            ["OKX", "https://www.okx.com/api/v5/public/time"],
            [
              "Kraken Futures",
              "https://futures.kraken.com/derivatives/api/v3/tickers",
            ],
          ].map(async ([source, url]) => {
            try {
              const result = await fetchJSON(url);
              return {
                source,
                ok: true,
                keys: Object.keys(result),
                at: Date.now(),
              };
            } catch (error) {
              return {
                source,
                ok: false,
                error: error.message,
                at: Date.now(),
              };
            }
          }),
        );
        let live;
        try {
          const market = await collectKraken(10);
          live = {
            ok: true,
            source: market.source,
            to: market.to,
            assets: Object.fromEntries(
              Object.entries(market.assets).map(([asset, s]) => [
                asset,
                {
                  bars: s.bars.length,
                  marks: s.marks.length,
                  funding: s.funding.length,
                },
              ]),
            ),
          };
        } catch (error) {
          live = { ok: false, error: error.message };
        }
        const response = json({ checks, live });
        response.headers.set("Cache-Control", "public, max-age=600");
        await caches.default.put(request, response.clone());
        return response;
      }
      if (path === "/api/warrants/comparison")
        return json(
          compareWarrants(
            await assetJSON(env, request, "/research/snapshot.json"),
          ),
        );
      if (path === "/api/decisions")
        return json({ decisions: await decisions(env) });
      if (path === "/api/backtest")
        return json(await assetJSON(env, request, "/data/backtest.json"));
      if (path.startsWith("/api/"))
        return json({ error: "Endpoint not found. Read /openapi.json." }, 404);
      const response = await env.ASSETS.fetch(
        htmlEntry(path)
          ? new Request(new URL(htmlEntry(path), request.url), request)
          : request,
      );
      const financePage = [
        "/crp/",
        "/crp/modeles/",
        "/crp/historique/",
        "/crp/methode/",
        "/donnees/",
        "/warrants/",
        "/warrants/experience/",
        "/warrants/methode/",
        "/warrants/suivi/",
      ].includes(path);
      const titles = {
        "/crp/": "CRP · Fin",
        "/crp/modeles/": "CRP · Fin",
        "/crp/historique/": "Historique CRP · Fin",
        "/crp/methode/": "Règles CRP · Fin",
        "/donnees/": "Données · Fin",
        "/warrants/": "Warrants · fin",
        "/warrants/experience/": "Warrants · simulation 100 € · Fin",
        "/warrants/methode/": "Méthode de recherche · fin",
        "/warrants/suivi/": "Suivi de recherche · fin",
      };
      const rendered =
        financePage && response.ok
          ? new HTMLRewriter()
              .on('link[rel="canonical"]', {
                element(el) {
                  el.setAttribute("href", "https://fin.keff.uk" + path);
                },
              })
              .on('meta[property="og:url"]', {
                element(el) {
                  el.setAttribute("content", "https://fin.keff.uk" + path);
                },
              })
              .on('meta[property="og:title"]', {
                element(el) {
                  el.setAttribute("content", titles[path]);
                },
              })
              .on("title", {
                element(el) {
                  el.setInnerContent(titles[path]);
                },
              })
              .transform(response)
          : response;
      const next = new Response(rendered.body, rendered);
      Object.entries(headers).forEach(([k, v]) => next.headers.set(k, v));
      if (
        path === "/research/snapshot.json" ||
        ["/index.html", "/crp.html"].includes(htmlEntry(path))
      ) {
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
      tick(env).catch(async (error) => {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          JSON.stringify({
            event: "scheduled_failed",
            error: message,
          }),
        );
        await setState(env, "scheduler", {
          at: Date.now(),
          status: "failed",
          error: message,
        });
      }),
    );
  },
};
