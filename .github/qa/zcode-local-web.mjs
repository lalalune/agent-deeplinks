import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const [qa, url] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL(qa + "/browser/node_modules/playwright/index.mjs"));
const { getAgentLink } = await import("../../package-under-test/dist/index.js");
const generated = getAgentLink("zcode", "web", { action: "local-web", target: url });
assert.equal(generated, url);
const origin = new URL(url).origin;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/*", route => {
    const target = new URL(route.request().url());
    return target.origin === origin || ["blob:", "data:"].includes(target.protocol) ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto(generated, { waitUntil: "domcontentloaded" });
  await page.locator('textarea,[contenteditable="true"],[role="textbox"]').first().or(page.getByText(/Login with Browser|Use API key|New task/i).first()).waitFor({ timeout: 25_000 }).catch(() => {});
  const text = (await page.locator("body").innerText()).slice(0, 1250);
  const controls = await page.locator('button,textarea,[contenteditable="true"],[role="textbox"]').evaluateAll(nodes =>
    nodes.map(node => [node.innerText, node.getAttribute("aria-label"), node.getAttribute("placeholder")].filter(Boolean)).filter(parts => parts.length > 0).slice(0, 32));
  const screenshot = await page.screenshot({ path: qa + "/evidence/loopback-workspace.png" });
  const proof = {
    url, generated, final: page.url(), status: response.status(), title: await page.title(), engine: browser.version(),
    visibleText: text, controls, errors, screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
  };
  await writeFile(qa + "/evidence/browser-proof.json", JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
  assert.equal(response.status(), 200);
  assert.match(text, /new task|login with browser|use api key|connect/i);
} finally {
  await browser.close();
}
