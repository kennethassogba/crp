import { collect } from "../lib/market.mjs";
import { snapshotAt, simulate, HOUR, DAY, RULES } from "../lib/strategy.mjs";
import { MODELS, callModel, reservation } from "../lib/models.mjs";

export async function stateValue(env, key) {
  const row = await env.DB.prepare("SELECT value FROM state WHERE key=?")
    .bind(key)
    .first();
  return row ? JSON.parse(row.value) : null;
}
export async function setState(env, key, value) {
  await env.DB.prepare(
    "INSERT INTO state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
  )
    .bind(key, JSON.stringify(value), Date.now())
    .run();
}

export async function reserve(env, id, model, snapshot, cohort = "live") {
  const amount = reservation(model, snapshot);
  const statements = [
    env.DB.prepare(
      "UPDATE budget SET committed=committed+? WHERE id=1 AND committed+?<=cap AND NOT EXISTS(SELECT 1 FROM runs WHERE id=?)",
    ).bind(amount, amount, id),
    env.DB.prepare(
      "INSERT INTO runs(id,cohort,model,snapshot_at,status,snapshot,reservation) SELECT ?,?,?,?,'reserved',?,? WHERE changes()=1",
    ).bind(id, cohort, model.id, snapshot.at, JSON.stringify(snapshot), amount),
  ];
  const res = await env.DB.batch(statements);
  return res[1].meta.changes === 1;
}

export async function runOne(env, model, snapshot, cohort = "live") {
  if (!env.OPENAI_API_KEY) return { status: "unconfigured" };
  const id = `${cohort}:${snapshot.at}:${model.id}`;
  if (!(await reserve(env, id, model, snapshot, cohort)))
    return { status: "skipped" };
  try {
    const result = await callModel(model, snapshot, env.OPENAI_API_KEY);
    const published = Date.now(),
      entry = snapshot.at + HOUR;
    const status =
      cohort === "live" && published >= entry ? "late" : "completed";
    const hold = reservation(model, snapshot);
    if (result.cost > hold)
      throw new Error("Provider cost exceeded reserved upper bound");
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE runs SET status=?,decision=?,usage=?,cost=?,published_at=?,entry_after=?,latency_ms=? WHERE id=? AND status='reserved'",
      ).bind(
        status,
        JSON.stringify(result.decision),
        JSON.stringify(result.usage),
        result.cost,
        published,
        entry,
        result.latencyMs,
        id,
      ),
      env.DB.prepare(
        "UPDATE budget SET committed=committed-?+?,actual=actual+? WHERE id=1",
      ).bind(hold, result.cost, result.cost),
    ]);
    return { status, ...result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Provider request failed";
    await env.DB.prepare(
      "UPDATE runs SET status='failed',error=?,published_at=? WHERE id=?",
    )
      .bind(message, Date.now(), id)
      .run();
    // Keep the full reservation after ambiguous or incomplete requests. Never retry automatically.
    console.error(
      JSON.stringify({
        event: "model_failed",
        model: model.id,
        error: message,
      }),
    );
    return { status: "failed", error: message };
  }
}

export async function settle(env, market) {
  const rows = await env.DB.prepare(
    "SELECT * FROM runs WHERE status='completed' AND result IS NULL ORDER BY snapshot_at,model",
  ).all();
  for (const r of rows.results) {
    if (r.entry_after + DAY > market.to - HOUR) continue;
    const older = await env.DB.prepare(
      "SELECT result FROM runs WHERE model=? AND cohort=? AND snapshot_at<? AND result IS NOT NULL ORDER BY snapshot_at DESC LIMIT 1",
    )
      .bind(r.model, r.cohort, r.snapshot_at)
      .first();
    const equity = older ? JSON.parse(older.result).equity : RULES.capital;
    const result = simulate(
      JSON.parse(r.decision),
      JSON.parse(r.snapshot),
      market,
      equity,
      r.entry_after,
    );
    if (result)
      await env.DB.prepare(
        "UPDATE runs SET result=? WHERE id=? AND result IS NULL",
      )
        .bind(JSON.stringify(result), r.id)
        .run();
  }
}

export async function tick(env) {
  const previous = await stateValue(env, "market");
  const market =
    previous && Date.now() - previous.collectedAt < 50 * 60_000
      ? previous
      : await collect(10);
  if (market !== previous) await setState(env, "market", market);
  await settle(env, market);
  if (!env.OPENAI_API_KEY) {
    await setState(env, "scheduler", { at: Date.now(), status: "needs_key" });
    return;
  }
  const now = Date.now(),
    day = Math.floor(now / DAY) * DAY,
    daily = day + 8 * HOUR;
  await setState(env, "scheduler", {
    at: now,
    status: "waiting",
    nextSnapshotAt: now < daily ? daily : daily + DAY,
    marketAt: market.to,
  });
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM runs WHERE cohort='live'",
  ).first();
  // The first observation can start at the current full hour. Later decisions use 08:00 UTC.
  const at = Number(count.n) === 0 ? Math.floor(now / HOUR) * HOUR : daily;
  if (at > market.to || now >= at + 50 * 60_000 || now < at) return;
  const previousRun = await env.DB.prepare(
    "SELECT snapshot_at,entry_after FROM runs WHERE cohort='live' AND status='completed' AND json_extract(decision,'$.action')<>'CASH' AND snapshot_at<? ORDER BY snapshot_at DESC LIMIT 1",
  )
    .bind(day)
    .first();
  if (previousRun?.entry_after + DAY > at + HOUR) return;
  const existing = await env.DB.prepare(
    "SELECT snapshot_at,COUNT(*) AS n FROM runs WHERE cohort='live' AND snapshot_at>=? AND snapshot_at<? GROUP BY snapshot_at LIMIT 1",
  )
    .bind(day, day + DAY)
    .first();
  if (existing && Number(existing.n) >= MODELS.length) return;
  const snapshot = snapshotAt(market, existing?.snapshot_at ?? at);
  for (const model of MODELS) await runOne(env, model, snapshot);
  await setState(env, "scheduler", {
    at: Date.now(),
    status: "completed",
    snapshotAt: at,
  });
}
