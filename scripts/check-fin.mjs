import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const base = process.env.FIN_URL ?? "http://127.0.0.1:5185";
await mkdir("output/playwright", { recursive: true });
const browser = await chromium.launch();
const evidence = [];
try {
  for (const [width, height] of [
    [1440, 1000],
    [1024, 900],
    [768, 900],
    [390, 844],
    [320, 760],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const [path, title] of [
      ["/", "Projets finance"],
      ["/warrants/", "Warrants"],
      ["/warrants/methode/", "Une méthode reproductible."],
      ["/warrants/suivi/", "Suivi de recherche"],
    ]) {
      await page.goto(base + path);
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      if (path === "/warrants/") {
        await page.getByText("833", { exact: false }).count(); // Ready is established by the settled metrics below.
        await page.getByRole("heading", { name: /Z377S/ }).waitFor();
        await page.getByText(/Intervalle conditionnel 95/).waitFor();
      }
      const box = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(
        box.scroll <= width + 1,
        `overflow ${path} ${width}: ${JSON.stringify(box)}`,
      );
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      const issues = scan.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact),
      );
      assert.deepEqual(
        issues.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
        [],
        `${path} ${width} accessibility`,
      );
      evidence.push({ width, height, path, box, seriousIssues: issues.length });
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `output/playwright/fin-${path === "/" ? "home" : path.includes("methode") ? "method" : path.includes("suivi") ? "journal" : "warrants"}-${width}.png`,
          fullPage: path !== "/warrants/methode/",
        });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
  });
  const p = await context.newPage();
  await p.goto(base + "/warrants/");
  await p.getByRole("heading", { name: /Z377S/ }).waitFor();
  await p.getByText(/Intervalle conditionnel 95/).waitFor();
  assert.match(await p.locator(".main-metric strong").innerText(), /834/);
  assert.match(await p.locator(".metric-row").innerText(), /9,7/);
  await p.getByRole("tab", { name: "Sensibilité", exact: true }).click();
  await p.getByRole("cell", { name: /−?\-15 €/ }).waitFor();
  await p
    .getByRole("button", { name: "Enregistrer l’analyse", exact: true })
    .click();
  await p.getByRole("button", { name: "Enregistré", exact: true }).waitFor();
  await p.goto(base + "/warrants/suivi/");
  await p.getByRole("heading", { name: /Z377S/ }).waitFor();
  await p.reload();
  await p.getByRole("heading", { name: /Z377S/ }).waitFor();
  await p.goto(base + "/warrants/");
  await p.getByRole("heading", { name: /Z377S/ }).waitFor();
  await p.getByText(/Intervalle conditionnel 95/).waitFor();
  await p.getByRole("button", { name: "Hypothèses", exact: true }).click();
  await p.getByLabel("EUR/USD", { exact: true }).fill("1.200");
  await p.getByText(/Intervalle conditionnel 95/).waitFor();
  await p.waitForFunction(
    () =>
      !document.querySelector('.detail-panel[aria-busy="true"]') &&
      !document
        .querySelector(".main-metric strong")
        ?.textContent?.includes("834"),
  );
  assert.doesNotMatch(
    await p.locator(".main-metric strong").innerText(),
    /834/,
  );
  await p.getByLabel("EUR/USD", { exact: true }).fill("1.124");
  await p.getByText(/Intervalle conditionnel 95/).waitFor();
  await p.waitForFunction(() =>
    document.querySelector(".main-metric strong")?.textContent?.includes("834"),
  );
  await p.getByLabel("Budget", { exact: true }).fill("1500");
  await p.getByText(/Intervalle conditionnel 95/).waitFor();
  await p.waitForFunction(() =>
    document.querySelector(".main-metric strong")?.textContent?.includes("417"),
  );
  assert.match(await p.locator(".main-metric strong").innerText(), /417/);
  await p.getByLabel("Filtrer les résultats").selectOption("validate");
  await p
    .getByRole("heading", { name: "Aucun résultat", exact: true })
    .waitFor();
  await p
    .getByRole("button", { name: "Réinitialiser les filtres", exact: true })
    .click();
  await p.getByLabel("Rechercher un warrant").fill("Q439S");
  await p.getByRole("button", { name: /Q439S PUT/ }).click();
  await p.getByRole("heading", { name: /Q439S/ }).waitFor();
  await p.getByRole("tab", { name: "Contrat & sources", exact: true }).click();
  await p.getByRole("link", { name: "Lire le DIC", exact: true }).waitFor();
  const csv = await readFile("public/research/catalogue.csv");
  await p
    .getByLabel("Importer un catalogue CSV ou JSON")
    .setInputFiles({
      name: "catalogue.csv",
      mimeType: "text/csv",
      buffer: csv,
    });
  await p
    .getByRole("status")
    .filter({ hasText: /6 produits importés/ })
    .waitFor();
  await p
    .getByLabel("Importer un catalogue CSV ou JSON")
    .setInputFiles({
      name: "invalide.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("isin,ask\nx,0"),
    });
  await p
    .getByRole("alert")
    .filter({ hasText: /Colonnes requises absentes/ })
    .waitFor();
  await context.close();
  // A failed data request has a retry and does not pretend to contain current quotes.
  const failed = await browser.newContext();
  const errorPage = await failed.newPage();
  await errorPage.route("**/research/snapshot.json", (r) =>
    r.fulfill({ status: 503, body: "{}" }),
  );
  await errorPage.goto(base + "/warrants/");
  await errorPage
    .getByRole("heading", { name: "Données indisponibles", exact: true })
    .waitFor();
  await errorPage
    .getByRole("button", { name: "Réessayer", exact: true })
    .waitFor();
  await failed.close();
  const social = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await social.goto(base);
  await social
    .getByRole("heading", { name: "Projets finance", exact: true })
    .waitFor();
  await social.screenshot({ path: "public/fin-social.png" });
  await social.close();
  await writeFile(
    "output/playwright/fin-verification.json",
    JSON.stringify(
      {
        base,
        views: evidence,
        interactions: "passed",
        sourceQuotes: "frozen 2026-10-16",
        execution: "none",
      },
      null,
      2,
    ),
  );
  console.log(
    `Finance UI: ${evidence.length} route/viewport checks, imports, sensitivity, journal and error state passed.`,
  );
} finally {
  await browser.close();
}
