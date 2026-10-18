import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.CRP_URL ?? "http://127.0.0.1:5185";
const browser = await chromium.launch({ headless: true });
await mkdir("output/playwright", { recursive: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(20_000);
await page.goto(base);
await page.getByRole("heading", { name: "Daily position", exact: true }).waitFor();
await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
const cdp = await context.newCDPSession(page);
const install = await cdp.send("Page.getInstallabilityErrors");
assert.deepEqual(install.installabilityErrors, []);
const manifest = await (await page.request.get(`${base}/manifest.webmanifest`)).json();
assert.equal(manifest.display, "standalone");
assert.ok(manifest.icons.some(i => i.sizes === "512x512"));
await context.setOffline(true);
await page.reload();
await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
await page.getByRole("link", { name: "Open dataset", exact: true }).waitFor();
await page.screenshot({ path: "output/playwright/offline.png" });
await context.setOffline(false);
await page.getByRole("button", { name: "Retry", exact: true }).click();
await page.getByRole("heading", { name: "Daily position", exact: true }).waitFor();
await context.close();

// Intercept only browser responses to examine recoverable states. No model calls.
const states = [];
for (const state of ["loading", "error", "empty"]) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const p = await c.newPage();
  p.setDefaultTimeout(20_000);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await p.route("**/api/state", async route => {
    if (state === "loading") {
      await gate;
      await route.continue();
    } else if (state === "error") {
      await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    } else {
      const response = await route.fetch();
      const data = await response.json();
      data.decisions = [];
      await route.fulfill({ response, json: data });
    }
  });
  await p.goto(base);
  if (state === "loading") await p.getByRole("status").filter({ hasText: "Loading recorded" }).waitFor();
  if (state === "error") await p.getByRole("button", { name: "Retry", exact: true }).waitFor();
  if (state === "empty") await p.getByRole("heading", { name: "Daily position", exact: true }).waitFor();
  const scan = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const violations = scan.violations.filter(v => ["critical", "serious"].includes(v.impact));
  assert.deepEqual(violations.map(v => v.id), []);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.screenshot({ path: `output/playwright/${state}.png` });
  states.push({ state, seriousViolations: violations.length });
  release();
  await c.close();
}
await browser.close();
await writeFile("output/playwright/pwa.json", JSON.stringify({ base, install, states, offlineRetry: "passed" }, null, 2));
console.log("PWA installability, offline retry, loading, error and empty states passed.");
