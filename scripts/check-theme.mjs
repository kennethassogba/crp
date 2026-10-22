import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.goto(process.env.FIN_URL ?? "http://127.0.0.1:5185");
  await page.locator(".position-row").first().waitFor();
  const c = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      [
        "bg",
        "panel",
        "surface",
        "text",
        "muted",
        "control",
        "accent",
        "accent-fill",
        "loss",
      ].map((k) => [k, s.getPropertyValue("--" + k).trim()]),
    );
  });
  const luminance = (h) => {
    const x = h
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2];
  };
  const ratio = (a, b) => {
    const x = luminance(c[a]),
      y = luminance(c[b]);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  let checks = 0;
  for (const fg of ["text", "muted", "accent", "loss"])
    for (const bg of ["bg", "panel", "surface"]) {
      assert.ok(ratio(fg, bg) >= 4.5, `${fg}/${bg}`);
      checks++;
    }
  assert.ok(ratio("text", "accent-fill") >= 4.5);
  console.log(`${checks + 1} measured contrast pairs passed`);
  await context.close();
} finally {
  await browser.close();
}
