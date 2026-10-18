import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.CRP_URL ?? "http://127.0.0.1:5185";
const key = "crp-install-v1";
const browser = await chromium.launch();
const checks = [];
await mkdir("output/playwright", { recursive: true });
const iosAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
async function open({
  preference,
  ios = false,
  standalone = false,
  blockedStorage = false,
  width = 390,
  storageState,
  clockTime,
  freezeClock = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    serviceWorkers: "block",
    reducedMotion: "reduce",
    storageState,
    ...(ios ? { userAgent: iosAgent, isMobile: true, hasTouch: true } : {}),
  });
  await context.addInitScript(
    ({ key, preference, standalone, blockedStorage }) => {
      // Controlled browser fixtures test promotion policy, not an OS installation.
      if (preference && !localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(preference));
      if (standalone)
        Object.defineProperty(navigator, "standalone", { value: true });
      if (blockedStorage) {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Storage blocked", "SecurityError");
          },
        });
      }
    },
    { key, preference, standalone, blockedStorage },
  );
  const page = await context.newPage();
  const initialTime = clockTime ?? Date.now();
  await page.clock.install({ time: new Date(initialTime) });
  // Freeze before navigation so network latency cannot count as test engagement.
  if (freezeClock) await page.clock.pauseAt(new Date(initialTime + 1000));
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Today’s decisions", exact: true })
    .waitFor();
  return { page, context };
}
async function nativeOffer(page, outcome = "dismissed") {
  await page.evaluate((outcome) => {
    window.installPromptCalls = 0;
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = async () => {
      window.installPromptCalls++;
      if (outcome === "error")
        throw new Error("Browser fixture: expired prompt");
    };
    event.userChoice = Promise.resolve({ outcome });
    window.dispatchEvent(event);
    window.installDefaultPrevented = event.defaultPrevented;
  }, outcome);
  assert.equal(await page.evaluate(() => window.installDefaultPrevented), true);
}
const button = (page) =>
  page.getByRole("button", { name: "Install app", exact: true });

// Three distinct visits; quick reloads do not increase the count.
{
  let { page, context } = await open();
  await nativeOffer(page);
  assert.equal(await button(page).count(), 0);
  await page.reload();
  await page
    .getByRole("heading", { name: "Today’s decisions", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).visits,
      key,
    ),
    1,
  );
  for (let visit = 2; visit <= 3; visit++) {
    const stored = await context.storageState();
    const clockTime = await page.evaluate(() => Date.now() + 31 * 60_000);
    await context.close();
    ({ page, context } = await open({ storageState: stored, clockTime }));
    await nativeOffer(page);
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).visits,
        key,
      ),
      visit,
    );
    assert.equal(await button(page).count(), visit === 3 ? 1 : 0);
  }
  // A browser prompt only opens after the explicit click; cancellation snoozes.
  assert.equal(await page.evaluate(() => window.installPromptCalls), 0);
  await button(page).click();
  assert.equal(await page.evaluate(() => window.installPromptCalls), 1);
  await button(page).waitFor({ state: "hidden" });
  const snooze = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).dismissedUntil - Date.now(),
    key,
  );
  assert.ok(snooze > 13.9 * 86_400_000 && snooze <= 14 * 86_400_000);
  await page.reload();
  await page
    .getByRole("heading", { name: "Today’s decisions", exact: true })
    .waitFor();
  await nativeOffer(page);
  assert.equal(await button(page).count(), 0);
  checks.push(
    "Third distinct visit, reload deduplication, explicit native action and 14-day snooze",
  );
  await context.close();
}
// Native acceptance stops future offers; an expired prompt has a recovery path.
for (const outcome of ["accepted", "error"]) {
  const { page, context } = await open({
    preference: { visits: 2, lastSeen: Date.now() - 31 * 60_000 },
  });
  await nativeOffer(page, outcome);
  await button(page).click();
  if (outcome === "accepted") {
    await button(page).waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).installed,
        key,
      ),
      true,
    );
  } else {
    await page
      .getByRole("dialog", { name: "Install CRP", exact: true })
      .getByText(/reload the page and try again/)
      .waitFor();
    await page.getByRole("button", { name: "Got it", exact: true }).click();
    assert.equal(await button(page).count(), 0);
  }
  await context.close();
}
checks.push(
  "Native acceptance persists; prompt failure offers browser-menu recovery",
);
// Foreground time only; a background tab does not trigger promotion.
{
  const { page, context } = await open({ ios: true, freezeClock: true });
  await page.evaluate(() => {
    window.testVisibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => window.testVisibility,
    });
  });
  await page.clock.runFor(120_000);
  await page.evaluate(() => {
    window.testVisibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(600_000);
  assert.equal(await button(page).count(), 0);
  await page.evaluate(() => {
    window.testVisibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(59_000);
  assert.equal(await button(page).count(), 0);
  await page.clock.runFor(1_000);
  await button(page).waitFor();
  checks.push("Three minutes of foreground use, excluding ten hidden minutes");
  await context.close();
}
// iPhone guidance, responsive header, native dialog focus and accessible controls.
for (const width of [320, 375, 390, 768, 1440]) {
  const { page, context } = await open({
    ios: true,
    width,
    preference: { visits: 2, lastSeen: Date.now() - 31 * 60_000 },
  });
  await button(page).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: `output/playwright/install-offer-${width}.png`,
  });
  await button(page).click();
  const dialog = page.getByRole("dialog", { name: "Install CRP", exact: true });
  await dialog.getByText("Add to Home Screen", { exact: true }).waitFor();
  const issues = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations.filter((v) => ["critical", "serious"].includes(v.impact));
  assert.deepEqual(
    issues.map((v) => v.id),
    [],
  );
  if (width === 390)
    await page.screenshot({ path: "output/playwright/install-ios-guide.png" });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await button(page).waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("button", { name: "Download evidence", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await context.close();
}
checks.push(
  "iOS instructions and header at five sizes; Escape, focus restoration and axe",
);
// No suggestion inside the installed app, after install, or in an unsupported browser.
for (const mode of ["standalone", "installed", "appinstalled", "unsupported"]) {
  const { page, context } = await open({
    ios: mode !== "unsupported",
    standalone: mode === "standalone",
    preference: {
      visits: 2,
      lastSeen: Date.now() - 31 * 60_000,
      installed: mode === "installed",
    },
  });
  if (mode === "appinstalled") {
    await button(page).waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  }
  assert.equal(await button(page).count(), 0);
  await context.close();
}
checks.push(
  "Installed, standalone, appinstalled and unsupported-browser suppression",
);
// Restricted storage still permits the time-based, dismissible invitation.
{
  const { page, context } = await open({ ios: true, blockedStorage: true });
  await page.clock.runFor(180_000);
  await button(page).waitFor();
  await page
    .getByRole("button", { name: "Dismiss install suggestion", exact: true })
    .click();
  assert.equal(await button(page).count(), 0);
  checks.push("Storage-denied fallback without crashes");
  await context.close();
}
await browser.close();
await writeFile(
  "output/playwright/install.json",
  JSON.stringify(
    {
      base,
      checks,
      scope:
        "Browser policy and simulated native event; no OS installation performed",
    },
    null,
    2,
  ),
);
console.log(`Installation invitation passed: ${checks.length} grouped checks.`);
