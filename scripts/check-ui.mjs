import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.CRP_URL ?? "http://127.0.0.1:5185";
await mkdir("output/playwright", { recursive: true });
const evidence = [];
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
for (const [engine, type] of [["chromium", chromium]]) {
  if (
    process.env.CRP_BROWSERS &&
    !process.env.CRP_BROWSERS.split(",").includes(engine)
  )
    continue;
  const browser = await type.launch({ headless: true });
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [768, 800],
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
      .getByRole("heading", { name: "Today’s decisions", exact: true })
      .waitFor();
    const nav =
      width <= 820
        ? page.getByRole("navigation", { name: "Mobile workspace" })
        : page.getByRole("navigation", { name: "Workspace", exact: true });
    for (const label of [
      "Today",
      "Models",
      "Backtest",
      "Method",
      "Execution",
      "Evidence",
    ]) {
      await (label === "Execution" || label === "Evidence" ? page : nav)
        .getByRole("button", { name: label, exact: true })
        .click();
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
      check(
        issues.length === 0,
        `${engine} ${width} ${label}: ${JSON.stringify(issues.map((v) => v.id))}`,
      );
    }
    await nav.getByRole("button", { name: "Models", exact: true }).click();
    await page
      .getByRole("button", { name: "Historical replay", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Read Luna decision", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    const dialogIssues = (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.filter((v) => ["critical", "serious"].includes(v.impact));
    check(
      dialogIssues.length === 0,
      `${engine} ${width} dialog: ${JSON.stringify(dialogIssues.map((v) => v.id))}`,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("dialog", { name: "Recorded decision", exact: true })
        .isVisible(),
      false,
    );
    await nav.getByRole("button", { name: "Today", exact: true }).click();
    await page
      .locator(".asset-switch")
      .getByRole("button", { name: /ETH/ })
      .click();
    const decisions = page.locator(".daily-decision");
    assert.equal(await decisions.count(), 5);
    for (const row of await decisions.all()) assert.ok(await row.isVisible());
    const available = page.locator(".daily-decision:not(:disabled)").first();
    if (await available.count()) {
      await available.click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
    }
    const chart = page.getByRole("img", { name: /ETH observed hourly prices/ });
    await chart.hover();
    const tooltip = page.locator(".chart-tooltip");
    await tooltip.waitFor();
    const contrast = await tooltip.evaluate((el) => {
      const rgb = (v) =>
        v
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((n) => {
            const c = n / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
      const lum = (v) => {
        const c = rgb(v);
        return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      };
      const css = getComputedStyle(el),
        a = lum(css.color),
        b = lum(css.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    check(contrast >= 4.5, `${engine} ${width} tooltip contrast: ${contrast}`);
    await chart.focus();
    const before = await tooltip.textContent();
    await page.keyboard.press("ArrowLeft");
    assert.notEqual(await tooltip.textContent(), before);
    await page.keyboard.press("Escape");
    await chart.blur();
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `output/playwright/${engine}-${width}.png`,
      });
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Mixed browser fixtures exercise long, cash, failed and excluded decisions.
  // They never invoke a provider or write market records.
  const mixed = await browser.newContext({
    viewport: { width: 375, height: 667 },
    serviceWorkers: "block",
    hasTouch: true,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const mixedPage = await mixed.newPage();
  await mixedPage.route("**/api/state", async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    const now = Date.now();
    data.asOf = now;
    data.decisions = data.models.map((m, i) => ({
      id: `ui-fixture-${m.id}`,
      model: m.id,
      cohort: "live",
      snapshot_at: now,
      published_at: now,
      entry_after: now + 3_600_000,
      cost: 0,
      latency_ms: 0,
      status: ["completed", "completed", "completed", "failed", "late"][i],
      decision:
        i === 3
          ? null
          : {
              action: ["CASH", "BTC_2X", "ETH_1X", "CASH", "CASH"][i],
              reason: "Browser fixture: recorded reasoning.",
            },
      error: i === 3 ? "Browser fixture: provider unavailable." : null,
      result: null,
      snapshot: data.snapshot,
    }));
    await route.fulfill({ response, json: data });
  });
  await mixedPage.goto(base);
  const daily = mixedPage.locator(".daily-decisions");
  for (const label of [
    "Cash",
    "Long BTC · 2×",
    "Long ETH · 1×",
    "Request failed",
    "Late, excluded",
  ])
    await daily.getByText(label, { exact: true }).waitFor();
  await mixedPage
    .getByRole("button", {
      name: "Read Luna Decision decision: Long BTC · 2×",
      exact: true,
    })
    .click();
  await mixedPage
    .getByRole("dialog")
    .getByText("Stop level", { exact: true })
    .waitFor();
  await mixedPage
    .getByRole("button", { name: "Copy paper plan", exact: true })
    .click();
  assert.match(
    await mixedPage.evaluate(() => navigator.clipboard.readText()),
    /Long BTC · 2×[\s\S]*Stop \$[\s\S]*Notional \$[\s\S]*No order has been placed/,
  );
  const planIssues = (
    await new AxeBuilder({ page: mixedPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations.filter((v) => ["critical", "serious"].includes(v.impact));
  check(
    planIssues.length === 0,
    `mixed long plan: ${JSON.stringify(planIssues.map((v) => v.id))}`,
  );
  await mixedPage.screenshot({ path: "output/playwright/position-plan.png" });
  await mixedPage.keyboard.press("Escape");
  await mixedPage
    .getByRole("button", {
      name: "Read Sol decision: Request failed",
      exact: true,
    })
    .click();
  await mixedPage
    .getByText("Browser fixture: provider unavailable.", { exact: true })
    .waitFor();
  await mixedPage.keyboard.press("Escape");
  const touchChart = mixedPage.getByRole("img", {
    name: /BTC observed hourly prices/,
  });
  await touchChart.tap();
  await mixedPage.locator(".chart-tooltip").waitFor();
  await mixedPage.screenshot({ path: "output/playwright/mixed-decisions.png" });
  check(
    await mixedPage.evaluate(
      () =>
        document.querySelector("main").scrollHeight <=
        document.querySelector("main").clientHeight + 1,
    ),
    "mixed decisions: mobile overflow",
  );
  await mixedPage.getByRole("button", { name: "24h", exact: true }).click();
  await mixedPage
    .getByRole("img", { name: /BTC observed hourly prices/ })
    .tap();
  await mixedPage.locator(".chart-tooltip").waitFor();
  await mixed.close();

  // Text resize and reflow. Short viewports may scroll to preserve access.
  const page = await browser.newPage({ viewport: { width: 640, height: 600 } });
  await page.goto(`${base}/#backtest`);
  await page
    .getByRole("heading", { name: "Binance backtest", exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Performance source").inputValue(),
    "momentum",
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "Binance backtest", exact: true })
    .waitFor();
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Today’s decisions", exact: true })
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
console.log(`Verified ${evidence.length} viewport/view combinations.`);

assert.deepEqual(failures, []);
