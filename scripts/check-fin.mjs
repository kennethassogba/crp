import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.FIN_URL ?? "http://127.0.0.1:5185",
  widths = (process.env.FIN_WIDTHS ?? "1440,1024,390,320")
    .split(",")
    .map(Number),
  browser = await chromium.launch({ headless: true });
await mkdir("output/playwright", { recursive: true });
const evidence = [];
try {
  for (const width of widths) {
    const context = await browser.newContext({
        viewport: { width, height: 1000 },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of ["/", "/positions/", "/resultats/", "/methode/"]) {
      await page.goto(base + route);
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.locator(".stamp").waitFor();
      assert.equal(
        await page.locator("body").evaluate((e) => e.scrollWidth > innerWidth),
        false,
        `${width} ${route} horizontal overflow`,
      );
      assert.equal(await page.getByText("Détails", { exact: true }).count(), 0);
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      assert.deepEqual(
        axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        `${width} ${route}`,
      );
      if (route === "/" && (width === 1440 || width === 390))
        await page.screenshot({
          path: `output/playwright/warrants-${width}.png`,
          fullPage: true,
        });
      evidence.push({ width, route, axe: true });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(
    "output/playwright/warrants-views.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(`${evidence.length} views: responsive and axe passed`);
} finally {
  await browser.close();
}
