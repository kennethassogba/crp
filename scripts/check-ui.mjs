import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.FIN_URL ?? "http://127.0.0.1:5185",
  browser = await chromium.launch();
const current = await (await fetch(base + "/api/warrants/tracker")).json();
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    }),
    page = await context.newPage();
  await page.goto(base);
  await page.locator(".position-row").first().waitFor();
  await page
    .getByRole("button", { name: "Comprendre le gain moyen prévu" })
    .click();
  await page.getByRole("dialog", { name: "Gain moyen prévu" }).waitFor();
  await page.getByText("Modèle non validé.", { exact: false }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Comprendre le gain moyen prévu" })
      .evaluate((e) => e === document.activeElement),
    true,
    "Help restores focus",
  );
  const chart = page.locator(".chart-canvas"),
    readout = page.locator(".market-readout");
  await chart.focus();
  await page.keyboard.press("Home");
  const first = await readout.textContent();
  await page.keyboard.press("End");
  assert.notEqual(await readout.textContent(), first);
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  assert.notEqual(await readout.textContent(), first);
  for (const name of [
    "Zoomer le graphique",
    "Dézoomer le graphique",
    "Afficher tout l’historique",
  ])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "1S", exact: true }).click();
  await page.getByRole("button", { name: "3M", exact: true }).click();
  for (const value of ["warrant", "capital", "underlying"])
    await page
      .getByRole("combobox", { name: "Série affichée" })
      .selectOption(value);
  await page.getByRole("button", { name: "Position", exact: true }).click();
  await page.getByRole("dialog", { name: "Position", exact: true }).waitFor();
  await page.getByRole("button", { name: "Contrat", exact: true }).click();
  await page.getByText("Strike", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Sortie", exact: true }).click();
  await page.getByText("+100 % ou −50 %", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Prévision", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Prévision initiale", exact: true })
    .waitFor();
  for (const name of ["Chances", "Modèle", "Scénarios"])
    await page.getByRole("button", { name, exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Positions", exact: true }).click();
  await page
    .getByRole("combobox", { name: "État des positions" })
    .selectOption("closed");
  await page.getByRole("heading", { name: "Aucune clôture" }).waitFor();
  await page
    .getByRole("combobox", { name: "État des positions" })
    .selectOption("all");
  await page.getByRole("button", { name: "Rechercher un warrant" }).click();
  await page.getByRole("searchbox").fill("no-such-isin");
  await page.getByRole("button", { name: "Afficher", exact: true }).click();
  await page.getByRole("heading", { name: "Aucun résultat" }).waitFor();
  await page.getByRole("button", { name: "Effacer la recherche" }).click();
  await page.getByRole("link", { name: "Résultats", exact: true }).click();
  await page.getByRole("button", { name: "Évaluer le modèle" }).click();
  await page
    .getByText("Aucune clôture pour comparer les prévisions aux résultats.")
    .waitFor();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Sélection", exact: true }).click();
  await page.locator(".position-row").first().click();
  await page.getByRole("button", { name: "Retour à la liste" }).click();
  assert.ok(await page.locator(".position-row").first().isVisible());
  await context.close();
  // Automatic updates and recovery: controlled network and clock, no real waiting or manual refresh.
  let calls = 0;
  let nextData = current;
  const auto = await browser.newContext(),
    ap = await auto.newPage();
  await ap.clock.install();
  await ap.route("**/api/warrants/tracker", (r) => {
    calls++;
    return r.fulfill({ json: nextData });
  });
  await ap.goto(base + "/positions/");
  await ap.locator(".position-row").first().waitFor();
  const before = calls;
  nextData = structuredClone(current);
  nextData.updatedAt = "2026-10-23T19:30:00.000Z";
  nextData.positions[0].pnl = 123;
  nextData.positions[0].value = 1123;
  await ap.clock.fastForward(60000);
  await ap.locator(".position-row").first().getByText("+123 €", { exact: true }).waitFor();
  assert.ok(calls > before, "Minute polling must request fresh data");
  await auto.close();
  let failed = true;
  const recovery = await browser.newContext(),
    rp = await recovery.newPage();
  await rp.clock.install();
  await rp.route("**/api/warrants/tracker", (r) =>
    failed
      ? r.fulfill({ status: 503, body: "{}" })
      : r.fulfill({ json: current }),
  );
  await rp.goto(base);
  await rp.getByText("Connexion interrompue.", { exact: false }).waitFor();
  assert.equal(await rp.locator(".position-row").count(), 0);
  failed = false;
  await rp.clock.fastForward(15000);
  await rp.locator(".position-row").first().waitFor();
  await recovery.close();
  // More than one screen of positions remains reachable by pages, with no scroll.
  const many = structuredClone(current);
  many.positions = Array.from({ length: 20 }, (_, i) => ({
    ...current.positions[i % current.positions.length],
    id: "fixture-" + i,
  }));
  const pagination = await browser.newContext({
      viewport: { width: 320, height: 568 },
    }),
    pp = await pagination.newPage();
  await pp.route("**/api/warrants/tracker", (r) => r.fulfill({ json: many }));
  await pp.goto(base + "/positions/");
  await pp.locator(".position-row").first().waitFor();
  const initial = await pp
    .locator(".position-row")
    .first()
    .getAttribute("href");
  await pp.getByRole("button", { name: "Page suivante", exact: true }).click();
  assert.notEqual(
    await pp.locator(".position-row").first().getAttribute("href"),
    initial,
  );
  await pp.locator(".position-row").first().click();
  await pp.getByRole("button", { name: "Retour à la liste" }).click();
  assert.notEqual(
    await pp.locator(".position-row").first().getAttribute("href"),
    initial,
  );
  await pagination.close();
  console.log(
    "Chart, sheets, focus, navigation, search, pagination, automatic polling and automatic recovery passed",
  );
} finally {
  await browser.close();
}
