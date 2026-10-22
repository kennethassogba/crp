export const TOOLS = [
  [
    "get_warrant_selections",
    "Daily frozen selections, entry prices and predictions.",
  ],
  [
    "get_warrant_positions",
    "All prospective simulations, observed bids, exits and source timestamps.",
  ],
  [
    "get_warrant_results",
    "Closed-position performance and probability calibration.",
  ],
  ["get_warrant_catalog", "Observed Bourso warrants and underlying histories."],
].map(([name, description]) => ({
  name,
  description,
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
}));
export const LINKS =
  '<https://fin.keff.uk/openapi.json>; rel="service-desc", <https://fin.keff.uk/index.md>; rel="describedby"';
export const GUIDE = `# Fin — Warrants\n\nSélections quotidiennes et suivi prospectif de positions simulées à 1 000 EUR.\n\n- Sélection : https://fin.keff.uk/\n- Positions : https://fin.keff.uk/positions/\n- Résultats : https://fin.keff.uk/resultats/\n- Méthode : https://fin.keff.uk/methode/\n- Journal JSON : https://fin.keff.uk/api/warrants/tracker\n- Sources : https://fin.keff.uk/research/snapshot.json\n- Protocole : https://fin.keff.uk/research/protocole.md\n- Code : https://github.com/kennethassogba/fin\n- MCP : POST https://fin.keff.uk/mcp\n\nLecture seule. Aucun ordre, aucun modèle payant. Prévisions exploratoires, pas de rentabilité prouvée. Les prix sont des relevés publics, pas des exécutions garanties.\n`;
export function discovery(path) {
  if (["/index.md", "/llms.txt", "/agent-skills/fin/SKILL.md"].includes(path))
    return { body: GUIDE, type: "text/markdown; charset=utf-8" };
  if (path === "/robots.txt")
    return {
      body: "User-agent: *\nAllow: /\nSitemap: https://fin.keff.uk/sitemap.xml\n",
      type: "text/plain",
    };
  if (path === "/sitemap.xml")
    return {
      body:
        '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        ["/", "/positions/", "/resultats/", "/methode/"]
          .map((p) => `<url><loc>https://fin.keff.uk${p}</loc></url>`)
          .join("") +
        "</urlset>",
      type: "application/xml",
    };
  if (path === "/openapi.json")
    return {
      body: {
        openapi: "3.1.0",
        info: { title: "Fin Warrants", version: "2.0.0" },
        servers: [{ url: "https://fin.keff.uk" }],
        paths: Object.fromEntries(
          ["tracker", "selections", "positions", "results"].map((k) => [
            "/api/warrants/" + k,
            {
              get: {
                operationId: "get_" + k,
                summary: "Read-only prospective warrant " + k,
                responses: {
                  200: {
                    description: "Timestamped JSON; unknown values are null",
                  },
                },
              },
            },
          ]),
        ),
      },
    };
  if (path === "/.well-known/mcp/server-card.json")
    return {
      body: {
        serverInfo: { name: "fin-warrants", version: "2.0.0" },
        url: "https://fin.keff.uk/mcp",
        transport: "streamable-http",
        authentication: { required: false },
        tools: TOOLS,
      },
    };
  return null;
}
