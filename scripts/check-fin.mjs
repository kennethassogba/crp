import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const base = process.env.FIN_URL ?? "http://127.0.0.1:5185";
const browser = await chromium.launch();
await mkdir("output/playwright", { recursive: true });
const views = [],
  interactions = [];
const routes = [
  ["/", "Portefeuilles"],
  ["/warrants/", "Catalogue"],
  ["/warrants/experience/", "Warrants"],
  ["/warrants/methode/", "Analyser un warrant"],
  ["/warrants/suivi/", "Analyses enregistrées"],
  ["/crp/", /^CRP$/],
  ["/crp/modeles/", /^CRP$/],
  ["/crp/historique/", /^Historique/],
  ["/crp/methode/", "Règles CRP"],
  ["/donnees/", "Données"],
];
async function scan(page, description) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    description + " overflow",
  );
  const issues = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations.filter((v) => ["critical", "serious"].includes(v.impact));
  assert.deepEqual(
    issues.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
    description + " accessibility",
  );
}
try {
  for (const width of (process.env.FIN_WIDTHS ?? "1440,768,390,320").split(",").map(Number)) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const [path, title] of routes) {
      await page.goto(base + path);
      await page
        .getByRole("heading", {
          name: title,
          exact: typeof title === "string",
          level: 1,
        })
        .waitFor();
      if (["/crp/", "/crp/modeles/"].includes(path))
        await page
          .getByRole("group", { name: "Comparer les modèles", exact: true })
          .waitFor();
      if (path === "/warrants/experience/")
        await page
          .getByRole("group", { name: "Comparer les warrants", exact: true })
          .waitFor();
      if (path === "/warrants/")
        await page.locator(".contract-button").first().waitFor();
      await scan(page, `${path} ${width}`);
      views.push({ path, width });
      if (
        (width === 1440 || width === 390) &&
        ["/", "/warrants/", "/warrants/experience/", "/crp/"].includes(path)
      )
        await page.screenshot({
          path: `output/playwright/unified-${path === "/" ? "overview" : path.includes("experience") ? "warrants-experience" : path.includes("warrants") ? "warrants" : "crp"}-${width}.png`,
          fullPage: true,
        });
    }
    await page.goto(base + "/warrants/experience/");
    const list = page.getByRole("group", {
      name: "Comparer les warrants",
      exact: true,
    });
    await list.getByRole("button", { name: /Q433S/ }).waitFor();
    assert.equal(await list.getByRole("button").count(), 1);
    const portfolio = page.getByRole("region", {
      name: "Portefeuille Q433S",
      exact: true,
    });
    const curve = portfolio.getByRole("group", {
      name: /Évolution du capital/,
    });
    await curve.focus();
    const latest = await curve.locator("[role=status]").innerText();
    await page.keyboard.press("Home");
    assert.notEqual(await curve.locator("[role=status]").innerText(), latest);
    await portfolio.getByText("Détails", { exact: true }).click();
    assert.match(await portfolio.innerText(), /689 Q433S/);
    await scan(page, "EUR1000 J1 portfolio " + width);
    await page.goto(base + "/");
    await page
      .getByRole("group", { name: "Comparer les portefeuilles", exact: true })
      .waitFor();
    await page.locator(".stock-row").nth(3).waitFor();
    assert.equal(await page.locator(".stock-row").count(), 4);
    assert.ok(!(await page.locator("body").innerText()).includes("k_eff"));
    interactions.push(
      "shared four-portfolio workspace and fixed J1 position " + width,
    );
    await page.goto(base + "/warrants/");
    await page.getByText("Marchés", { exact: true }).click();
    await page
      .getByRole("button", { name: /^NDX ·.*filtrer les contrats/ })
      .click();
    assert.equal(
      await page
        .getByLabel("Filtrer par sous-jacent", { exact: true })
        .inputValue(),
      "NDX",
    );
    await page.getByRole("button", { name: "Tous", exact: true }).click();
    assert.equal(
      await page
        .getByLabel("Filtrer par sous-jacent", { exact: true })
        .inputValue(),
      "all",
    );
    await page.getByLabel("Rechercher un warrant").fill("Z377S");
    await page.getByRole("button", { name: /Z377S/ }).click();
    const dialog = page.getByRole("dialog", { name: "Analyse du warrant" });
    await dialog.getByRole("heading", { name: /Z377S/ }).waitFor();
    await scan(page, "warrant detail " + width);
    const chart = dialog.getByRole("group", { name: /Gains nets/ });
    await chart.focus();
    const initial = await chart.locator(".chart-readout").innerText();
    await page.keyboard.press("ArrowRight");
    assert.notEqual(await chart.locator(".chart-readout").innerText(), initial);
    await dialog
      .getByRole("button", { name: "Warrant ×5", exact: true })
      .click();
    const targetGain = Number(
      (await dialog.locator(".simulator-input>strong").innerText())
        .split("€")[0]
        .replace(/[^0-9-]/g, ""),
    );
    assert.ok(targetGain > 3980 && targetGain <= 4000);
    await dialog
      .getByRole("button", { name: "Seuil de rentabilité", exact: true })
      .click();
    assert.match(
      await dialog.locator(".simulator-input>strong").innerText(),
      /^0 €/,
    );
    await dialog
      .getByRole("button", { name: "Cours actuel", exact: true })
      .click();
    const before = await dialog.locator(".simulator-input>strong").innerText();
    await dialog
      .getByRole("spinbutton", { name: "Palantir", exact: true })
      .fill("300");
    assert.notEqual(
      await dialog.locator(".simulator-input>strong").innerText(),
      before,
    );
    await dialog.getByRole("tab", { name: "Résumé", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await dialog
      .getByRole("heading", { name: "Comparer les hypothèses" })
      .waitFor();
    await scan(page, "models " + width);
    await dialog.getByRole("tab", { name: "Contrat", exact: true }).click();
    await dialog
      .getByRole("link", { name: "Lire le DIC", exact: true })
      .waitFor();
    await scan(page, "contract " + width);
    if (width === 1440 || width === 390) {
      await dialog.getByRole("tab", { name: "Résumé", exact: true }).click();
      await page.screenshot({
        path: `output/playwright/unified-detail-${width}.png`,
      });
    }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(
      await page
        .getByRole("button", { name: /Z377S/ })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    if (width === 320) {
      await page.getByRole("button", { name: "Ouvrir la navigation" }).click();
      const nav = page.getByRole("dialog", { name: "Navigation", exact: true });
      await nav
        .getByRole("link", { name: "Portefeuilles", exact: true })
        .click();
      await page.getByRole("link", { name: "Modèles IA", exact: true }).click();
      await page.getByRole("heading", { name: /^CRP$/, level: 1 }).waitFor();
      assert.equal(await nav.isVisible(), false);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: "block",
    }),
    page = await context.newPage();
  await page.goto(base + "/warrants/");
  await page.getByLabel("Rechercher un warrant").fill("Z377S");
  await page.getByRole("button", { name: /Z377S/ }).click();
  const d = page.getByRole("dialog", { name: "Analyse du warrant" });
  await d.getByRole("heading", { name: /Z377S/ }).waitFor();
  const first = await d.locator(".main-metric strong").innerText();
  await d.getByRole("spinbutton", { name: /Budget/ }).fill("1500");
  await page.waitForFunction(
    (initial) =>
      document.querySelector(".main-metric strong")?.textContent !== initial &&
      !!document.querySelector(".main-metric strong"),
    first,
  );
  await d
    .getByRole("button", { name: "Enregistrer l’analyse", exact: true })
    .click();
  await d.getByRole("button", { name: "Enregistré", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: "Portefeuilles", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "Modèles IA", exact: true }).click();
  await page.getByRole("heading", { name: /^CRP$/, level: 1 }).waitFor();
  await page
    .getByRole("link", { name: "Catalogue", exact: true })
    .first()
    .click();
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "Budget", exact: true })
      .inputValue(),
    "1500",
  );
  await page
    .getByRole("link", { name: /Analyses/ })
    .first()
    .click();
  await page.getByRole("heading", { name: /Z377S/ }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: /Z377S/ }).waitFor();
  await page.getByRole("button", { name: /Retirer l’observation/ }).click();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await page.getByRole("heading", { name: /Z377S/ }).waitFor();
  interactions.push("budget, saved observation, persistence and undo");
  await page
    .getByRole("link", { name: "Catalogue", exact: true })
    .first()
    .click();
  assert.equal(
    await page.evaluate(
      () => window.performance.getEntriesByType("navigation").length,
    ),
    1,
  );
  await page.goBack();
  await page
    .getByRole("heading", {
      name: "Analyses enregistrées",
      exact: true,
      level: 1,
    })
    .waitFor();
  interactions.push("SPA navigation and browser back");
  await page.goto(base + "/warrants/");
  const csv = await readFile("public/research/catalogue.csv");
  await page.getByLabel("Importer un catalogue CSV ou JSON").setInputFiles({
    name: "catalogue.csv",
    mimeType: "text/csv",
    buffer: csv,
  });
  await page
    .getByRole("status")
    .filter({ hasText: /6 produits importés/ })
    .waitFor();
  await page.getByLabel("Importer un catalogue CSV ou JSON").setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("isin,ask\nx,0"),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: /Colonnes requises/ })
    .waitFor();
  interactions.push("CSV import and rejection");
  await page.getByRole("link",{name:"Portefeuilles",exact:true}).first().click();
  await page.locator(".stock-row").nth(3).waitFor();
  await page.getByRole("region",{name:"Portefeuille Q433S",exact:true}).getByText("Détails",{exact:true}).click();
  assert.match(await page.getByRole("region",{name:"Portefeuille Q433S",exact:true}).innerText(),/689 Q433S/);
  interactions.push("catalog import leaves the public J1 portfolio unchanged");
  await page.goto(base + "/warrants/");
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await scan(page, "200% text");
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  await page.evaluate(() => (document.documentElement.dir = "rtl"));
  await scan(page, "RTL");
  await context.close();
  const failed = await browser.newContext({ serviceWorkers: "block" }),
    p = await failed.newPage();
  await p.route("**/research/snapshot.json", (r) =>
    r.fulfill({ status: 503, body: "{}" }),
  );
  await p.goto(base + "/warrants/");
  await p
    .getByRole("heading", { name: "Catalogue indisponible", exact: true })
    .waitFor();
  await p.getByRole("button", { name: "Réessayer", exact: true }).waitFor();
  await scan(p, "catalogue error");
  await failed.close();
  await writeFile(
    "output/playwright/unified-verification.json",
    JSON.stringify(
      {
        base,
        views,
        interactions,
        source: "dated public observations",
        execution: "none",
      },
      null,
      2,
    ),
  );
  console.log(
    `${views.length} views plus charts, simulator, dialog keyboard, imports, journal, SPA navigation and error recovery passed.`,
  );
} finally {
  await browser.close();
}
