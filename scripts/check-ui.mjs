import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.CRP_URL ?? "http://127.0.0.1:5185";
await mkdir("output/playwright", { recursive: true });
const evidence = [];
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
for (const [engine, type] of [
  ["chromium", chromium],
]) {
  if (process.env.CRP_BROWSERS && !process.env.CRP_BROWSERS.split(",").includes(engine)) continue;
  const browser = await type.launch({ headless: true });
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [375, 667],
    [320, 568],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page
      .getByRole("heading", { name: "Daily position", exact: true })
      .waitFor();
    const nav =
      width <= 820
        ? page.getByRole("navigation", { name: "Mobile workspace" })
        : page.getByRole("navigation", { name: "Workspace", exact: true });
    for (const label of ["Today", "Models", "Backtest", "Method", "Execution", "Evidence"]) {
      await (label === "Execution" || label === "Evidence" ? page : nav)
        .getByRole("button", { name: label, exact: true }).click();
      await page.waitForTimeout(80);
      const box = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyHeight: document.documentElement.scrollHeight,
        height: innerHeight,
        mainHeight: document.querySelector("main").clientHeight,
        mainScroll: document.querySelector("main").scrollHeight,
      }));
      check(
        box.scrollWidth <= width + 1,
        `${engine} ${width} ${label}: horizontal overflow`,
      );
      if (width >= 375 && height >= 667)
        check(
          box.bodyHeight <= height + 1,
          `${engine} ${width} ${label}: body scroll`,
        );
      if (width >= 375 && height >= 667)
        check(
          box.mainScroll <= box.mainHeight + 1,
          `${engine} ${width} ${label}: hidden main scroll ${JSON.stringify(box)}`,
        );
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      const issues = axe.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      evidence.push({
        engine,
        width,
        height,
        view: label,
        box,
        violations: issues.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      });
      check(issues.length === 0, `${engine} ${width} ${label}: ${JSON.stringify(issues.map(v=>v.id))}`);
    }
    await nav.getByRole("button", { name: "Models", exact: true }).click();
    await page
      .getByRole("button", { name: "Historical replay", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Read Luna decision", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    const dialogIssues = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze())
      .violations.filter(v => ["critical", "serious"].includes(v.impact));
    check(dialogIssues.length === 0, `${engine} ${width} dialog: ${JSON.stringify(dialogIssues.map(v => v.id))}`);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog").isVisible(), false);
    await nav.getByRole("button", { name: "Today", exact: true }).click();
    await page
      .locator(".asset-switch")
      .getByRole("button", { name: /ETH/ })
      .click();
    await page.getByLabel("Decision source").selectOption("sol");
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `output/playwright/${engine}-${width}.png`,
      });
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Text resize and reflow. Short viewports may scroll to preserve access.
  const page = await browser.newPage({ viewport: { width: 640, height: 600 } });
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Daily position", exact: true })
    .waitFor();
  await page.addStyleTag({ content: "html {font-size:200%}" });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.close();
  await browser.close();
}
await writeFile(
  "output/playwright/verification.json",
  JSON.stringify(evidence, null, 2),
);
console.log(
  `Verified ${evidence.length} viewport/view combinations.`,
);

assert.deepEqual(failures, []);
