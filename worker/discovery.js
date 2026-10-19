const HOME = "https://fin.keff.uk";
export const LINKS = `<${HOME}/index.md>; rel="alternate"; type="text/markdown", <${HOME}/openapi.json>; rel="service-desc", <${HOME}/.well-known/api-catalog>; rel="api-catalog", <${HOME}/.well-known/mcp/server-card.json>; rel="mcp-server-card", <${HOME}/.well-known/agent-skills/index.json>; rel="agent-skills"`;
export const GUIDE = `# CRP\n\nBTC and ETH daily paper positions and model comparison. Public market data; no exchange account connected.\n\n## Read\nGET /api/state returns the latest market snapshot, model decisions, settlement records, budget, freshness and scheduler status. GET /api/backtest returns the 90-day deterministic historical benchmark. GET /api/decisions returns the decision journal. These endpoints never invoke a paid model.\n\n## Strategy\nLong BTC, long ETH or cash. Isolated leverage 1x or 2x. Stop distance is max(1%, 2 times hourly ATR14). Position size limits estimated stop loss plus execution fees to 2% of equity. Funding and price gaps may add losses. Daily snapshot at 08:00 UTC, entry at 09:00 UTC after the response is recorded, exit 24 hours later or earlier at stop. The initial live observation may use the current full hour and enter one hour later. A late response is excluded from performance.\n\n## Evidence\nHistorical rule benchmarks are separate from historical LLM replays and from prospective model results. Missing and failed model responses are never substituted with rule-based decisions. No expected return or confidence is guaranteed. Daily observations use Kraken Futures public trade, mark, index and hourly funding data. Archived backtests use Binance. Neither source requires account authentication. Non-cash positions cannot settle against another venue. Kraken funding uses published USD payments per base unit; Binance funding uses its published mark price and rate. Costs are assumptions: 0.05% taker fee and 0.02% slippage each side, plus subsequent observed funding. Hourly bars approximate execution; the liquidation model uses fixed 0.5% maintenance margin.\n\n## Automation and cost\nScheduled server jobs collect market data and record one position per model per day. No public endpoint creates a trade, calls a provider, changes a budget or places an exchange order. The lifetime provider budget is USD 15, reserved atomically before every request. Unknown request costs keep their reservation.\n\n## Models\nGPT-6 Luna, GPT-6 Luna via Decisions, GPT-5.6 Terra, GPT-6 Sol and GPT-6 Astra. Responses and API usage are recorded. A configured secret is required for model calls. Provider errors and missing credentials remain visible.\n\n## Links\nApplication: https://fin.keff.uk/crp/\nRepository: https://github.com/kennethassogba/crp\nOpenAPI: ${HOME}/openapi.json\nMCP: ${HOME}/mcp\nMethod: ${HOME}/method.md\n`;
export const TOOLS = [
  {
    name: "get_daily_decisions",
    description:
      "Read recorded BTC/ETH paper decisions, source freshness and provider budget. Never places an order.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_backtest",
    description:
      "Read deterministic historical benchmark results and assumptions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];
export async function discovery(path) {
  const skill = `---\nname: read-positions\ndescription: Read CRP paper positions and evaluation evidence.\n---\n\n${GUIDE}`;
  if (["/index.md", "/llms.txt", "/method.md"].includes(path))
    return { body: GUIDE, type: "text/markdown; charset=utf-8" };
  if (path === "/skills/read-positions/SKILL.md")
    return {
      body: skill,
      type: "text/markdown; charset=utf-8",
    };
  if (path === "/.well-known/agent-skills/index.json") {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(skill));
    const digest = 'sha256:' + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
    return {
      body: {
        $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
        skills: [
          {
            name: "read-positions",
            type: 'skill-md',
            description: "Read CRP paper positions and evaluation evidence.",
            url: `${HOME}/skills/read-positions/SKILL.md`,
            digest,
          },
        ],
      },
    };
  }
  if (path === "/.well-known/api-catalog")
    return {
      body: {
        linkset: [
          {
            anchor: HOME,
            "service-desc": [
              {
                href: `${HOME}/openapi.json`,
                type: "application/vnd.oai.openapi+json",
              },
            ],
          },
        ],
      },
      type: "application/linkset+json",
    };
  if (path === "/.well-known/mcp/server-card.json")
    return {
      body: {
        $schema:
          "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
        version: "1.0",
        protocolVersion: "2025-11-25",
        serverInfo: { name: "crp", version: "1.0.0" },
        description: "Read BTC/ETH paper positions and evaluation evidence.",
        transport: { type: "streamable-http", endpoint: `${HOME}/mcp` },
        authentication: { required: false },
        tools: TOOLS,
      },
    };
  if (path === "/openapi.json")
    return {
      body: {
        openapi: "3.1.0",
        info: {
          title: "CRP",
          version: "1.0.0",
          description: "Read-only paper position journal. No order execution.",
        },
        servers: [{ url: HOME }],
        paths: Object.fromEntries(
          ["/api/state", "/api/backtest", "/api/decisions", "/api/source-health"].map((p) => [
            p,
            {
              get: {
                operationId: p.split("/").at(-1),
                responses: {
                  200: {
                    description: "Recorded research data.",
                    content: {
                      "application/json": { schema: { type: "object" } },
                    },
                  },
                },
              },
            },
          ]),
        ),
      },
      type: "application/vnd.oai.openapi+json",
    };
  if (path === "/robots.txt")
    return {
      body: `User-agent: *\nAllow: /\nContent-Signal: search=yes, ai-input=yes, ai-train=no\nSitemap: ${HOME}/sitemap.xml\n`,
      type: "text/plain",
    };
  if (path === "/sitemap.xml")
    return {
      body: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${HOME}/</loc></url><url><loc>${HOME}/crp/</loc></url><url><loc>${HOME}/warrants/</loc></url><url><loc>${HOME}/warrants/methode/</loc></url><url><loc>${HOME}/method.md</loc></url></urlset>`,
      type: "application/xml",
    };
  return null;
}
