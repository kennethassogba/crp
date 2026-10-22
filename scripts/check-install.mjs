import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch(),
  base = process.env.FIN_URL ?? "http://127.0.0.1:5185";
try {
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.goto(base);
  await page.locator(".position-row").first().waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Installer", exact: true }).count(),
    0,
  );
  await page.evaluate(() =>
    localStorage.setItem(
      "crp-install-v1",
      JSON.stringify({
        visits: 3,
        lastSeen: 0,
        dismissedUntil: 0,
        installed: false,
      }),
    ),
  );
  await page.reload();
  await page.locator(".position-row").first().waitFor();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "Menu de l’application" }).click();
  await page.getByRole("button", { name: "Installer", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Masquer la proposition d’installation" })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Installer", exact: true }).count(),
    0,
  );
  assert.ok(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("crp-install-v1")).dismissedUntil >
        Date.now(),
    ),
  );
  await context.close();
  console.log(
    "Install prompt: quiet entry, engagement gate, explicit action and dismissal passed",
  );
} finally {
  await browser.close();
}
