import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.FIN_URL ?? "http://127.0.0.1:5185",
  browser = await chromium.launch();
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  await page.goto(base);
  await page.locator(".position-row").first().waitFor();
  await page
    .getByRole("button", { name: "Prévision initiale", exact: true })
    .click();
  await page.getByRole("heading", { name: "Gain net simulé" }).waitFor();
  await page.getByRole("button", { name: "Suivi", exact: true }).click();
  await page.locator(".chart-canvas canvas").first().waitFor();
  const chart = page.locator(".chart-canvas"),
    readout = page.locator(".market-readout");
  await chart.focus();
  await page.keyboard.press("Home");
  const first = await readout.textContent();
  await page.keyboard.press("End");
  assert.notEqual(
    await readout.textContent(),
    first,
    "Keyboard must change price/date",
  );
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  const hover = await readout.textContent();
  assert.notEqual(hover, first, "Pointer readout");
  const canvas = await page
    .locator(".chart-canvas canvas")
    .first()
    .screenshot();
  assert.ok(canvas.length > 500, "Chart drawn");
  await page
    .getByRole("button", { name: "Zoomer le graphique", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Dézoomer le graphique", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Afficher tout l’historique", exact: true })
    .click();
  await page.getByRole("button", { name: "1S", exact: true }).click();
  await page.getByRole("button", { name: "3M", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Série affichée" })
    .selectOption("warrant");
  await page
    .getByRole("combobox", { name: "Série affichée" })
    .selectOption("capital");
  await page
    .getByRole("combobox", { name: "Série affichée" })
    .selectOption("underlying");
  await page.getByRole("button", { name: "Suivre la position" }).click();
  await page.getByRole("heading", { level: 1, name: "Positions" }).waitFor();
  await page.getByRole("button", { name: "Clôturées", exact: true }).click();
  await page
    .getByRole("heading", { name: "Aucune clôture pour le moment" })
    .waitFor();
  await page.getByRole("button", { name: "Toutes", exact: true }).click();
  await page.getByRole("searchbox").fill("unknown-isin");
  await page.getByRole("heading", { name: "Aucun résultat" }).waitFor();
  await page.getByRole("searchbox").fill("");
  await page.getByRole("link", { name: "Résultats", exact: true }).click();
  await page
    .getByRole("heading", { name: "Pas encore de résultat à comparer" })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Sélection", exact: true }).click();
  await page.locator(".position-row").first().click();
  await page.getByRole("button", { name: "Retour à la liste" }).waitFor();
  await page.getByRole("button", { name: "Retour à la liste" }).click();
  assert.ok(await page.locator(".position-row").first().isVisible());
  await context.close();
  // Network failure must be visible and recoverable, never a fabricated zero return.
  const failure = await browser.newContext(),
    fp = await failure.newPage();
  await fp.route("**/api/warrants/tracker", (r) =>
    r.fulfill({ status: 503, body: "{}" }),
  );
  await fp.goto(base);
  await fp.getByText("Chargement impossible.", { exact: false }).waitFor();
  assert.equal(await fp.locator(".position-row").count(), 0);
  await fp.unroute("**/api/warrants/tracker");
  await fp.getByRole("button", { name: "Actualiser", exact: true }).click();
  await fp.locator(".position-row").first().waitFor();
  await failure.close();
  console.log(
    "Chart, keyboard, hover, zoom, periods, series, navigation, filters, mobile and recovery passed",
  );
} finally {
  await browser.close();
}
