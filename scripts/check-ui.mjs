import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { compareCrp } from "../lib/crp-performance.mjs";
const base = process.env.FIN_URL ?? "http://127.0.0.1:5185";
const original = await (await fetch(base + "/api/state")).json();
const actions = ["CASH", "BTC_2X", "ETH_1X"];
const fixture = () => {
  const state = structuredClone(original);
  state.stale = false;
  state.decisions = state.models.map((model, i) => ({
    id: `fixture:${i}`,
    model: model.id,
    cohort: "live",
    snapshot_at: state.asOf - 2 * 86400000,
    published_at: state.asOf - 2 * 86400000 + 1000,
    entry_after: state.asOf - 2 * 86400000 + 3600000,
    status: "completed",
    snapshot: state.snapshot,
    decision: {
      action: actions[i],
      reason: "Raison enregistrée du modèle. ".repeat(20),
    },
    result: {
      equity: [10000, 10625, 9700][i],
      pnl: [0, 625, -300][i],
      exitAt: state.asOf - 86400000,
      action: actions[i],
      fees: 1,
      funding: 0.5,
    },
  }));
  state.comparison = compareCrp(state.models, state.decisions, {
    to: state.asOf,
  });
  return state;
};
const browser = await chromium.launch(),
  checks = [];
async function scan(p) {
  const result = await new AxeBuilder({ page: p })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    result.violations
      .filter((v) => ["critical", "serious"].includes(v.impact))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
  assert.ok(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
}
try {
  for (const width of [1440, 390, 320]) {
    const c = await browser.newContext({
        viewport: { width, height: 1000 },
        serviceWorkers: "block",
        reducedMotion: "reduce",
        hasTouch: width <= 390,
      }),
      p = await c.newPage();
    let state = fixture();
    await p.route("**/api/state", (r) => r.fulfill({ json: state }));
    await p.goto(base + "/crp/");
    await p
      .getByRole("table", { name: /Comparaison des portefeuilles/ })
      .waitFor();
    assert.equal(await p.locator(".comparison-row").count(), 3);
    assert.match(
      await p.locator(".comparison-row").nth(1).innerText(),
      /106,25/,
    );
    assert.match(await p.locator(".comparison-row").nth(1).innerText(), /6,25/);
    assert.match(
      await p.locator(".comparison-row").nth(2).innerText(),
      /97,00/,
    );
    assert.equal(
      await p.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
      "dark",
    );
    for (let i = 0; i < 3; i++) {
      await p.locator(".position-button").nth(i).click();
      const dialog = p.getByRole("dialog", { name: "Décision enregistrée" });
      await dialog
        .getByRole("heading", { name: state.models[i].name, exact: true })
        .waitFor();
      if (i === 1) {
        await dialog
          .getByText("Exposition sur la base de 100 €", { exact: true })
          .waitFor();
        assert.ok(!(await dialog.innerText()).includes("10 000"));
        await dialog
          .getByRole("button", { name: "Copier le plan", exact: true })
          .click();
      }
      if (i === 0)
        assert.equal(
          await dialog
            .getByRole("button", { name: "Copier le plan", exact: true })
            .isDisabled(),
          true,
        );
      await scan(p);
      await p.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(
        await p
          .locator(".position-button")
          .nth(i)
          .evaluate((el) => el === document.activeElement),
        true,
      );
    }
    const graph = p.getByRole("group", { name: /Capital des trois modèles/ });
    await graph.focus();
    const before = await graph.locator("[role=status]").innerText();
    await p.keyboard.press("Home");
    assert.notEqual(await graph.locator("[role=status]").innerText(), before);
    const box = await graph.locator("svg").boundingBox();
    await p.mouse.move(box.x + box.width * 0.1, box.y + 80);
    const hovered = await graph.locator("[role=status]").innerText();
    await p.mouse.move(box.x + box.width * 0.9, box.y + 80);
    assert.notEqual(await graph.locator("[role=status]").innerText(), hovered);
    if (width <= 390) {
      await p.touchscreen.tap(box.x + box.width * 0.1, box.y + 70);
      const touched = await graph.locator("[role=status]").innerText();
      await p.touchscreen.tap(box.x + box.width * 0.9, box.y + 70);
      assert.notEqual(
        await graph.locator("[role=status]").innerText(),
        touched,
      );
    }
    await scan(p);
    await p.evaluate(() => { (document.activeElement)?.blur(); window.scrollTo(0, 0); });
    await p.screenshot({
      path: `output/playwright/crp-comparison-fixture-${width}.png`,
      fullPage: true,
    });
    await p.evaluate(() => (document.documentElement.style.fontSize = "200%"));
    await scan(p);
    await p.evaluate(() => {
      document.documentElement.style.fontSize = "";
      document.documentElement.dir = "rtl";
    });
    await scan(p);
    await p.evaluate(() => (document.documentElement.dir = "ltr"));
    for (const failure of ["failed", "late"]) {
      state = fixture();
      Object.assign(state.decisions[1], {
        status: failure,
        result: null,
        error:
          failure === "failed" ? "Source de données indisponible." : undefined,
      });
      state.comparison = compareCrp(state.models, state.decisions, {
        to: state.asOf,
      });
      await p.reload();
      await p.locator(".position-button").nth(1).click();
      const dialog = p.getByRole("dialog", { name: "Décision enregistrée" });
      await dialog
        .getByRole("heading", { name: "Pas de position", exact: true })
        .waitFor();
      assert.equal(
        await dialog
          .getByRole("button", { name: "Copier le plan", exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(
        await dialog.getByText("Entrée indicative", { exact: true }).count(),
        0,
      );
      if (failure === "failed")
        await dialog
          .getByText("Source de données indisponible.", { exact: true })
          .waitFor();
      await scan(p);
      await p.keyboard.press("Escape");
    }
    await p
      .getByRole("link", { name: "Historique", exact: true })
      .last()
      .click();
    await p
      .getByRole("heading", { name: "Test historique Binance", exact: true })
      .waitFor();
    await p
      .getByRole("combobox", { name: "Stratégie", exact: true })
      .selectOption(state.models[0].id);
    await p
      .getByRole("heading", { name: "Journal des décisions", exact: true })
      .waitFor();
    await scan(p);
    checks.push({
      width,
      models: 3,
      baseEUR: 100,
      decisionOutcomes: ["cash", "BTC_2X", "ETH_1X", "failed", "late"],
      keyboard: "passed",
      hover: "passed",
      history: "passed",
      theme: "dark",
    });
    await c.close();
  }
  await writeFile(
    "output/playwright/crp-unified-verification.json",
    JSON.stringify(
      { checks, scope: "Browser fixtures, no provider invocation" },
      null,
      2,
    ),
  );
  console.log(
    "CRP: EUR-100 comparison, five outcomes, dialogs, keyboard/hover and history passed at three widths.",
  );
} finally {
  await browser.close();
}
