import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.FIN_URL ?? "http://127.0.0.1:5185";
const sizes = process.env.FIN_WIDTHS
  ? process.env.FIN_WIDTHS.split(",")
      .map(Number)
      .map((width) => ({ width, height: width <= 390 ? 844 : 1000 }))
  : [
      { width: 2407, height: 1260 },
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ];
const browser = await chromium.launch();
await mkdir("output/playwright", { recursive: true });
const evidence = [];
try {
  for (const viewport of sizes) {
    const context = await browser.newContext({
        viewport,
        reducedMotion: "reduce",
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of ["/", "/positions/", "/resultats/", "/methode/"]) {
      await page.goto(base + route);
      await page.locator(".position-row,.results,.method").first().waitFor();
      const verify = async (state) => {
        const layout = await page.evaluate(() => ({
          x: document.documentElement.scrollWidth > innerWidth,
          y: document.documentElement.scrollHeight > innerHeight,
          app: document.querySelector(".app").getBoundingClientRect().height,
          small: [...document.querySelectorAll("body *")]
            .filter(
              (e) =>
                e.getClientRects().length &&
                [...e.childNodes].some(
                  (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
                ) &&
                parseFloat(getComputedStyle(e).fontSize) < 16,
            )
            .map((e) => [e.tagName, e.className, getComputedStyle(e).fontSize]),
        }));
        assert.equal(
          layout.x,
          false,
          `${viewport.width} ${state} horizontal scroll`,
        );
        assert.equal(
          layout.y,
          false,
          `${viewport.width} ${state} document scroll`,
        );
        assert.ok(Math.abs(layout.app - viewport.height) < 2);
        assert.deepEqual(layout.small, [], `${state} small copy`);
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        assert.deepEqual(
          axe.violations.map((v) => ({
            id: v.id,
            targets: v.nodes.map((n) => n.target),
          })),
          [],
          `${viewport.width} ${state}`,
        );
        evidence.push({
          ...viewport,
          state,
          axe: true,
          noDocumentScroll: true,
        });
      };
      await verify(route);
      if (route === "/") {
        assert.equal(
          await page.locator(".instrument-code").first().evaluate(e => getComputedStyle(e).textAlign),
          "start",
          "Warrant codes align with instrument names",
        );
        assert.equal(await page.locator(".topbar").count(), 0);
        assert.equal(
          await page
            .getByRole("button", { name: "Actualiser les données" })
            .count(),
          0,
        );
        assert.equal(await page.locator("main>p.source-note").count(), 0);
        await page.screenshot({
          path: `output/playwright/fullscreen-list-${viewport.width}.png`,
        });
        await page.locator(".position-row").first().click();
        await page.locator(".chart-canvas canvas").first().waitFor();
        const panel = await page
          .locator(".analysis")
          .evaluate((e) => ({
            scroll: e.scrollHeight,
            client: e.clientHeight,
            chart: e.querySelector(".chart-canvas").clientHeight,
          }));
        assert.ok(
          panel.scroll <= panel.client + 2,
          `${viewport.width} instrument scroll ${JSON.stringify(panel)}`,
        );
        assert.ok(panel.chart >= 80, `${viewport.width} chart too short`);
        await verify("instrument");
        await page.screenshot({
          path: `output/playwright/fullscreen-chart-${viewport.width}.png`,
        });
        await page
          .getByRole("button", { name: "Comprendre le gain moyen prévu" })
          .click();
        await page.getByRole("dialog", { name: "Gain moyen prévu" }).waitFor();
        await verify("forecast help");
        await page.keyboard.press("Escape");
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(
    "output/playwright/fullscreen-views.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(`${evidence.length} app states: viewport, type and axe passed`);
} finally {
  await browser.close();
}
