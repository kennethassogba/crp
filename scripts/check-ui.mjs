import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = process.env.FIN_URL ?? "http://127.0.0.1:5185";
const state = await (await fetch(base + "/api/state")).json();
// Browser fixtures exercise five outcomes. They never write records or call a model.
state.decisions = state.models.map((model, i) => ({
  id: `fixture:${i}`,
  model: model.id,
  cohort: "live",
  snapshot_at: state.asOf,
  published_at: state.asOf + 1000,
  entry_after: state.asOf + 3600000,
  status: ["completed", "completed", "completed", "failed", "late"][i],
  snapshot: state.snapshot,
  decision:
    i < 3
      ? {
          action: ["CASH", "BTC_2X", "ETH_1X"][i],
          reason: "Raison enregistrée du modèle. ".repeat(20),
        }
      : i === 4
        ? { action: "BTC_1X", reason: "Réponse reçue après la limite." }
        : null,
  error: i === 3 ? "Source de données indisponible." : undefined,
  result:
    i < 3
      ? {
          equity: 10000,
          pnl: 0,
          exitAt: state.asOf,
          action: ["CASH", "BTC_2X", "ETH_1X"][i],
        }
      : null,
}));
const browser = await chromium.launch(),
  checks = [];
try {
  for (const width of [1440, 390, 320]) {
    const c = await browser.newContext({
        viewport: { width, height: 900 },
        serviceWorkers: "block",
        reducedMotion: "reduce",
      }),
      p = await c.newPage();
    await p.route("**/api/state", (r) => r.fulfill({ json: state }));
    await p.goto(base + "/crp/");
    await p.getByRole("heading", { name: /^Décisions/, level: 1 }).waitFor();
    assert.equal(await p.locator(".decision-list>.decision-row").count(), 5);
    for (let i = 0; i < 5; i++) {
      await p.locator(".decision-list>.decision-row").nth(i).click();
      const dialog = p.getByRole("dialog", { name: "Décision enregistrée" });
      await dialog
        .getByRole("heading", { name: state.models[i].name, exact: true })
        .waitFor();
      if (i === 1) {
        const entry = state.snapshot.assets.BTC.price;
        assert.match(
          await dialog.innerText(),
          new RegExp(
            new Intl.NumberFormat("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
              .format(entry)
              .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          ),
        );
        await dialog
          .getByRole("button", { name: "Copier le plan", exact: true })
          .click();
      }
      if ([0, 3, 4].includes(i))
        assert.equal(
          await dialog
            .getByRole("button", { name: "Copier le plan", exact: true })
            .isDisabled(),
          true,
        );
      if (i === 4) {
        await dialog
          .getByRole("heading", { name: "Pas de position", exact: true })
          .waitFor();
        assert.equal(
          await dialog.getByText("Entrée indicative", { exact: true }).count(),
          0,
        );
      }
      if (i === 3)
        await dialog
          .getByText("Source de données indisponible.", { exact: true })
          .waitFor();
      const scan = await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      assert.deepEqual(
        scan.violations
          .filter((v) => ["critical", "serious"].includes(v.impact))
          .map((v) => v.id),
        [],
      );
      await p.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(
        await p
          .locator(".decision-list>.decision-row")
          .nth(i)
          .evaluate((el) => el === document.activeElement),
        true,
      );
    }
    const graph = p.getByRole("group", { name: /BTC, 7 jours/ });
    await graph.focus();
    const before = await graph.locator(".chart-readout").innerText();
    await p.keyboard.press("Home");
    assert.notEqual(await graph.locator(".chart-readout").innerText(), before);
    const svg = graph.locator("svg"),
      box = await svg.boundingBox();
    await p.mouse.move(box.x + box.width * 0.4, box.y + 100);
    const hovered = await graph.locator(".chart-readout").innerText();
    await p.mouse.move(box.x + box.width * 0.7, box.y + 100);
    assert.notEqual(await graph.locator(".chart-readout").innerText(), hovered);
    await p.getByRole("button", { name: "ETH", exact: true }).click();
    await p.getByRole("group", { name: /ETH, 7 jours/ }).waitFor();
    await p.getByRole("link", { name: "Modèles", exact: true }).last().click();
    await p
      .getByRole("heading", { name: "Résultats observés", exact: true })
      .waitFor();
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
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    checks.push({
      width,
      fixtureDecisions: 5,
      keyboard: "passed",
      hover: "passed",
      modelHistory: "passed",
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
    "Unified CRP: five decision outcomes, plans, dialogs, charts and history passed at three widths.",
  );
} finally {
  await browser.close();
}
