import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import ts from "typescript";

const base = process.env.FIN_URL ?? "http://127.0.0.1:5185";
const browser = await chromium.launch();
const evidence = [];
await mkdir("output/playwright", { recursive: true });
// Check source-backed copy: every translation call and the frozen method labels have English text.
const dictionary = ts.createSourceFile("i18n.ts", await readFile("src/fin/i18n.ts", "utf8"), ts.ScriptTarget.Latest, true);
let keys = new Set();
function dictionaryKeys(n) {
  if (ts.isVariableDeclaration(n) && n.name.getText(dictionary) === "english")
    keys = new Set(n.initializer.properties.map(p => p.name.text));
  ts.forEachChild(n, dictionaryKeys);
}
dictionaryKeys(dictionary);
for (const file of ["src/fin/main.tsx", "src/fin/MarketChart.tsx", "src/InstallPrompt.tsx", "src/fin/Sheet.tsx"]) {
  const ast = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function walk(n) {
    if (ts.isCallExpression(n) && n.expression.getText(ast) === "t" && ts.isStringLiteral(n.arguments[0]))
      assert.ok(keys.has(n.arguments[0].text), `Missing English copy: ${n.arguments[0].text}`);
    if (ts.isVariableDeclaration(n) && ["routes", "reason", "methodSteps"].includes(n.name.getText(ast))) {
      const check = child => {
        if (ts.isStringLiteral(child) && !child.text.startsWith("/"))
          assert.ok(keys.has(child.text), `Missing method/navigation copy: ${child.text}`);
        ts.forEachChild(child, check);
      };
      check(n.initializer);
    }
    ts.forEachChild(n, walk);
  }
  walk(ast);
}

const verify = async (page, viewport, state) => {
  const layout = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    scroll: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
    clipped: [...document.querySelectorAll(".toolbar-actions button,.instrument-toolbar button,.sidebar nav a")]
      .filter(e => e.getClientRects().length)
      .some(e => { const r=e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1; }),
  }));
  assert.equal(layout.lang, "en");
  assert.equal(layout.scroll, false, `${viewport.width} ${state} page scroll`);
  assert.equal(layout.clipped, false, `${viewport.width} ${state} clipped controls`);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(v => ({ id:v.id, target:v.nodes.map(n=>n.target) })), [], `${viewport.width} ${state}`);
  evidence.push({ ...viewport, state, lang:"en", axe:true, noDocumentScroll:true });
};
try {
  for (const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568}]) {
    const context = await browser.newContext({viewport}), page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(base);
    await page.locator(".position-row").first().waitFor();
    await page.getByRole("button", {name:"Switch to English", exact:true}).click();
    await page.getByRole("link", {name:"Selection", exact:true}).waitFor();
    assert.equal(await page.title(), "Selection · Fin");
    assert.equal(await page.evaluate(() => localStorage.getItem("fin-language")), "en");
    await verify(page, viewport, "selection");
    await page.screenshot({path:`output/playwright/i18n-en-list-${viewport.width}.png`});
    await page.locator(".position-row").first().click();
    await page.locator(".chart-canvas canvas").first().waitFor();
    const selectedUrl = page.url();
    const chartLabel = await page.locator(".chart-canvas").getAttribute("aria-label");
    assert.ok(chartLabel.includes("Use arrow keys"));
    await page.getByRole("button", {name:"1W",exact:true}).waitFor();
    await page.getByRole("button", {name:"1Y",exact:true}).waitFor();
    assert.ok((await page.locator(".market-readout strong").innerText()).startsWith("$"));
    await verify(page, viewport, "instrument");
    const panel = await page.locator(".analysis").evaluate(e=>({scroll:e.scrollHeight,client:e.clientHeight}));
    assert.ok(panel.scroll <= panel.client + 2, `Instrument scroll ${viewport.width}`);
    await page.screenshot({path:`output/playwright/i18n-en-chart-${viewport.width}.png`});
    await page.getByRole("button", {name:"Passer en français",exact:true}).click();
    await page.getByRole("button", {name:"Comprendre le gain moyen prévu"}).waitFor();
    assert.equal(page.url(), selectedUrl, "Language switch preserves the selected warrant");
    assert.equal(await page.getByRole("button", {name:"Switch to English",exact:true}).evaluate(e=>e===document.activeElement), true, "Language switch keeps focus");
    await page.getByRole("button", {name:"Switch to English",exact:true}).click();
    await page.getByRole("button", {name:"About expected profit"}).click();
    await page.getByText("Unvalidated model. The full investment may be lost.", {exact:true}).waitFor();
    await verify(page, viewport, "forecast help");
    await page.keyboard.press("Escape");
    await page.getByRole("button", {name:"Position",exact:true}).click();
    await page.getByText("€1,000.00",{exact:true}).waitFor();
    await page.getByRole("button", {name:"Contract",exact:true}).click();
    await page.getByText("Expiry",{exact:true}).waitFor();
    await page.getByRole("button", {name:"Exit",exact:true}).click();
    await page.getByText("+100% or −50%",{exact:true}).waitFor();
    await verify(page, viewport, "position sheet");
    await page.keyboard.press("Escape");
    await page.getByRole("button", {name:"Forecast",exact:true}).click();
    for (const tab of ["Chances","Model","Scenarios"]) await page.getByRole("button", {name:tab,exact:true}).click();
    await page.getByText("Mean profit",{exact:true}).waitFor();
    await verify(page, viewport, "forecast sheet");
    await page.keyboard.press("Escape");
    await page.getByRole("button", {name:"Price source and date"}).click();
    await page.getByText("Automatic · daily observations",{exact:true}).waitFor();
    await page.keyboard.press("Escape");
    await page.reload();
    await page.getByRole("button", {name:"About expected profit"}).waitFor();
    assert.equal(page.url(), selectedUrl, "Language and selection survive reload");
    await page.getByRole("link", {name:"Positions",exact:true}).click();
    await page.getByRole("combobox", {name:"Position status"}).selectOption("closed");
    await page.getByRole("heading", {name:"No closed positions",exact:true}).waitFor();
    await verify(page, viewport, "positions");
    await page.getByRole("link", {name:"Results",exact:true}).click();
    await page.getByRole("button", {name:"Evaluate model",exact:true}).click();
    await page.getByText("No closed positions to compare forecasts with outcomes.",{exact:true}).waitFor();
    await page.keyboard.press("Escape");
    await verify(page, viewport, "results");
    await page.goto(base+"/methode/");
    for (const [i,title] of ["Filter","Rank","Simulate €1,000","Close","Evaluate","Understand the limits"].entries()) {
      if(i) await page.getByRole("button",{name:"Next page",exact:true}).click();
      await page.getByRole("heading",{name:title,exact:true}).waitFor();
    }
    await verify(page, viewport, "method");
    await page.getByRole("button",{name:"Sources and data",exact:true}).click();
    await page.getByText("Mon–Fri · 21:30 UTC",{exact:true}).waitFor();
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    await context.close();
  }
  const ios = await browser.newContext({viewport:{width:390,height:844}, userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15"});
  await ios.addInitScript(() => {
    localStorage.setItem("fin-language","en");
    localStorage.setItem("crp-install-v1",JSON.stringify({visits:3,lastSeen:0,dismissedUntil:0,installed:false}));
  });
  const ip=await ios.newPage(); await ip.goto(base);
  await ip.getByRole("button",{name:"App menu",exact:true}).click();
  await ip.getByRole("button",{name:"Install",exact:true}).click();
  await ip.getByRole("dialog",{name:"Install Fin",exact:true}).waitFor();
  await ip.getByText("Add to Home Screen",{exact:true}).waitFor();
  await verify(ip,{width:390,height:844},"installation");
  await ios.close();
  const failure=await browser.newContext(), fp=await failure.newPage();
  await fp.route("**/api/warrants/tracker",r=>r.fulfill({status:503,body:"{}"}));
  await fp.goto(base);
  await fp.getByText("Connexion interrompue.",{exact:false}).waitFor();
  await fp.getByRole("button",{name:"Switch to English",exact:true}).click();
  await fp.getByText("Connection lost. Reconnecting automatically.",{exact:true}).waitFor();
  await failure.close();
  await writeFile("output/playwright/i18n-views.json",JSON.stringify(evidence,null,2));
  console.log(`${evidence.length} English states passed; language, numbers, dates, chart, persistence, focus, installation and errors checked`);
} finally { await browser.close(); }
