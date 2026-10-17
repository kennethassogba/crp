import { ACTIONS } from "./strategy.mjs";
export const MODELS = [
  {
    id: "luna",
    name: "Luna",
    provider: "gpt-6-luna",
    input: 0.1,
    output: 0.5,
    effort: "none",
    maxOutput: 512,
  },
  {
    id: "decision",
    name: "Luna Decision",
    provider: "gpt-6-luna",
    input: 0.1,
    output: 0,
    endpoint: "decisions",
    maxOutput: 0,
  },
  {
    id: "terra",
    name: "Terra",
    provider: "gpt-5.6-terra",
    input: 2,
    output: 12,
    effort: "none",
    maxOutput: 512,
  },
  {
    id: "sol",
    name: "Sol",
    provider: "gpt-6-sol",
    input: 2,
    output: 10,
    effort: "none",
    maxOutput: 512,
  },
  {
    id: "astra",
    name: "Astra",
    provider: "gpt-6-astra",
    input: 10,
    output: 50,
    effort: "low",
    maxOutput: 2048,
  },
];
export const INSTRUCTIONS = `Select one long-only BTC/ETH perpetual paper position for the next 24 hours or CASH. Actions: CASH, BTC_1X, BTC_2X, ETH_1X, ETH_2X. Only use the supplied past market snapshot. No web, no future knowledge. Consider trend, volatility, volume and observed funding. 1X/2X means isolated margin leverage, not full-account exposure. Position sizing is deterministic: stop distance=max(1%,2*hourly ATR14/price), stop risk including estimated fees capped at 2% of equity. Max account notional 2x. Entry is the first full hour at least one hour after snapshot time, only after your response is recorded. Exit 24h after entry or earlier at stop. Estimated costs per side: 0.05% fee plus 0.02% slippage; actual subsequent funding is charged. Compare against cash. Select CASH if evidence is insufficient. Do not claim calibrated confidence or guaranteed returns. Return a concise reason grounded in the supplied fields.`;
export function requestBody(model, snapshot) {
  const input = JSON.stringify(snapshot);
  if (new TextEncoder().encode(input + INSTRUCTIONS).length > 16_000)
    throw new Error("Snapshot exceeds input budget");
  if (model.endpoint === "decisions")
    return {
      model: model.provider,
      input: `${INSTRUCTIONS}\n${input}`,
      questions: [
        {
          name: "position",
          type: "choice",
          instructions:
            "Choose the position with the best expected net risk-adjusted result, including CASH.",
          choices: ACTIONS.map((value) => ({
            value,
            description:
              value === "CASH"
                ? "Remain in cash."
                : `Long ${value.split("_")[0]} with ${value.endsWith("2X") ? "2x" : "1x"} isolated leverage and risk-limited sizing.`,
          })),
        },
      ],
    };
  return {
    model: model.provider,
    instructions: INSTRUCTIONS,
    input,
    store: false,
    reasoning: { effort: model.effort },
    max_output_tokens: model.maxOutput,
    text: {
      format: {
        type: "json_schema",
        name: "position",
        strict: true,
        schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ACTIONS },
            reason: { type: "string" },
          },
          required: ["action", "reason"],
          additionalProperties: false,
        },
      },
    },
  };
}
export function reservation(model, snapshot) {
  const bytes = new TextEncoder().encode(
    JSON.stringify(requestBody(model, snapshot)),
  ).length;
  return (
    ((bytes + 4096) * model.input) / 1e6 +
    (model.maxOutput * model.output) / 1e6
  );
}
export function parseDecision(model, result) {
  if (model.endpoint === "decisions") {
    const a = result.answers?.[0];
    if (!a || a.type === "refusal" || !ACTIONS.includes(a.choice))
      throw new Error("Decision response is invalid");
    return {
      action: a.choice,
      reason: "Selected from the same five positions.",
      probabilities: a.probabilities ?? null,
      confidence: a.confidence ?? null,
    };
  }
  if (result.status && result.status !== "completed")
    throw new Error("Model output is incomplete");
  const text = result.output
    ?.flatMap((o) => o.content ?? [])
    .find((c) => c.type === "output_text")?.text;
  const value = JSON.parse(text ?? "null");
  if (
    !value ||
    !ACTIONS.includes(value.action) ||
    typeof value.reason !== "string" ||
    value.reason.length > 1200
  )
    throw new Error("Model response is invalid");
  return value;
}
export function actualCost(model, usage) {
  if (
    !usage ||
    !Number.isFinite(usage.input_tokens) ||
    !Number.isFinite(usage.output_tokens)
  )
    throw new Error("Provider usage missing");
  return (
    (usage.input_tokens * model.input + usage.output_tokens * model.output) /
    1e6
  );
}
export async function callModel(model, snapshot, key) {
  const start = Date.now();
  const res = await fetch(
    `https://api.openai.com/v1/${model.endpoint ?? "responses"}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody(model, snapshot)),
      signal: AbortSignal.timeout(90_000),
    },
  );
  if (!res.ok) throw new Error(`Provider HTTP ${res.status}`);
  const raw = await res.json();
  const cost = actualCost(model, raw.usage);
  return {
    decision: parseDecision(model, raw),
    usage: raw.usage,
    cost,
    latencyMs: Date.now() - start,
    requestId: res.headers.get("x-request-id"),
  };
}
