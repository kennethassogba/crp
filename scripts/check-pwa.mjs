import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch(),
  base = process.env.FIN_URL ?? "http://127.0.0.1:5185";
try {
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.goto(base);
  await page.locator(".position-row").first().waitFor();
  const manifest = await (
    await context.request.get(base + "/manifest.webmanifest")
  ).json();
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.locator(".position-row").first().waitFor();
  await context.setOffline(true);
  await page.reload();
  await page.getByText(/Hors ligne|Connexion interrompue/).first().waitFor();
  assert.equal(await page.locator(".position-row").count(), 0);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.locator(".position-row").first().waitFor();
  const cached = await page.evaluate(async () => {
    const all = [];
    for (const name of await caches.keys())
      for (const req of await (await caches.open(name)).keys())
        all.push(req.url);
    return all;
  });
  assert.ok(
    !cached.some((url) => url.includes("/api/") || url.includes("/research/")),
  );
  await context.close();
  console.log(
    "PWA manifest, install, offline shell, no cached prices and recovery passed",
  );
} finally {
  await browser.close();
}
