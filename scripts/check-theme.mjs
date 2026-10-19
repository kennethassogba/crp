import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = process.env.FIN_URL ?? "http://127.0.0.1:5185";
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto(base + "/crp/");
  await page
    .getByRole("group", { name: "Comparer les modèles", exact: true })
    .waitFor();
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement),
      token = (k) => style.getPropertyValue(k).trim();
    return {
      mode: style.colorScheme,
      text: token("--text"),
      page: token("--page"),
      muted: token("--muted"),
      loss: token("--loss"),
      accent: token("--accent"),
      control: token("--control"),
      panel: token("--panel"),
      fill: token("--accent-fill"),
      lossFill: token("--loss-fill"),
    };
  });
  const lum = (hex) => {
    const rgb = hex
      .replace("#", "")
      .match(/../g)
      .map((x) => parseInt(x, 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const ratio = (a, b) =>
    (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  assert.equal(colors.mode, "dark");
  const pairs = [
    ["text", colors.text, colors.page, 4.5],
    ["muted", colors.muted, colors.page, 4.5],
    ["muted on panel", colors.muted, colors.panel, 4.5],
    ["loss", colors.loss, colors.page, 4.5],
    ["accent", colors.accent, colors.page, 4.5],
    ["primary button", "#ffffff", colors.fill, 4.5],
    ["negative badge", "#ffffff", colors.lossFill, 4.5],
    ["control border", colors.control, colors.panel, 3],
    ["Luna line", "#b5abff", colors.page, 3],
    ["Decision line", "#8ab4f8", colors.page, 3],
    ["Sol line", "#d8b484", colors.page, 3],
  ].map(([name, fg, bg, minimum]) => ({
    name,
    fg,
    bg,
    minimum,
    ratio: ratio(fg, bg),
  }));
  for (const p of pairs)
    assert.ok(p.ratio >= p.minimum, `${p.name}: ${p.ratio}`);
  await writeFile(
    "output/playwright/contrast-dark.json",
    JSON.stringify({ colors, pairs }, null, 2),
  );
  console.log(`Dark-only theme: ${pairs.length} contrast pairs passed.`);
} finally {
  await browser.close();
}
