import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { getAgentLink } from "../../dist/index.js";

const output = join(process.env.RUNNER_TEMP, "antigravity-linux", "evidence");
const executablePath = process.env.ANTIGRAVITY_QA_EXE;
const load = createRequire(join(process.env.RUNNER_TEMP, "antigravity-qa-driver", "package.json"));
const { _electron } = load("playwright-core");

const url = getAgentLink("antigravity", "desktop");
if (url !== "antigravity://") throw new Error("The library produced an unexpected launch URI");
const mime = "x-scheme-handler/antigravity";
const shell = (file, args) => spawnSync(file, args, { encoding: "utf8", timeout: 8_000 });
const getRegistration = () => {
  const xdg = shell("xdg-mime", ["query", "default", mime]);
  const gio = shell("gio", ["mime", mime]);
  return { xdg: xdg.stdout?.trim() || null, gio: (gio.stdout || gio.stderr)?.trim() || null };
};

async function close(runningApp) {
  if (!runningApp) return;
  const child = runningApp.process();
  await Promise.race([runningApp.close().catch(() => {}), new Promise((done) => setTimeout(done, 6_000).unref())]);
  child.kill();
}

async function launch(args = []) {
  return _electron.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-gpu", "--ozone-platform=x11", ...args],
    env: process.env,
    timeout: 40_000,
  });
}

async function getVisibleView(runningApp, first, label) {
  const deadline = Date.now() + 40_000;
  let snapshot;
  while (Date.now() < deadline) {
    for (const candidate of runningApp.windows().reverse()) {
      const view = await candidate.evaluate(() => ({
        title: document.title,
        text: document.body?.innerText?.slice(0, 1_200) ?? "",
      })).catch(() => null);
      if (!view || (!view.title && !view.text)) continue;
      snapshot = view;
      if (/welcome to antigravity/i.test(view.title + " " + view.text) ||
          (/antigravity/i.test(view.title + " " + view.text) && /sign in|continue with google/i.test(view.text))) {
        console.log(`${label} welcomes signed-out user:`, view);
        return { window: candidate, view, welcome: true };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 450));
  }
  console.log(`${label} observed visible view:`, snapshot);
  return { window: first, view: snapshot ?? null, welcome: false };
}

async function findDeepLinkLog(runningApp) {
  const logDirectory = await runningApp.evaluate(({ app }) => app.getPath("logs"));
  try {
    return readdirSync(logDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
      .map((entry) => ({
        log: entry.name,
        exactUriObserved: /Launched with deep link:\s*antigravity:\/\//.test(readFileSync(join(logDirectory, entry.name), "utf8")),
      }));
  } catch {
    return [];
  }
}

async function stockAppState(runningApp) {
  return runningApp.evaluate(({ app, BrowserWindow }, href) => ({
    name: app.getName(),
    version: app.getVersion(),
    executable: process.execPath,
    argvHasExactUri: process.argv.includes(href),
    electronDefaultProtocolClient: app.isDefaultProtocolClient("antigravity"),
    electronProtocolHandler: app.getApplicationNameForProtocol(href) || null,
    visibleWindows: BrowserWindow.getAllWindows()
      .filter((window) => window.isVisible())
      .map((window) => ({ title: window.getTitle(), url: window.webContents.getURL() })),
  }), url);
}

let app;
let page;
const proof = { url, beforeLaunch: getRegistration(), afterFirstLaunch: null, stockShellDispatch: null, directArgv: null, signedIn: false };
try {
  app = await launch();
  page = await app.firstWindow({ timeout: 25_000 });
  proof.firstApp = await stockAppState(app);
  if (proof.firstApp.version !== "2.35.0") throw new Error("Unexpected package version");
  const initial = await getVisibleView(app, page, "Initial launch");
  page = initial.window;
  proof.initialView = { welcome: initial.welcome, content: initial.view };
  proof.afterFirstLaunch = getRegistration();
  proof.firstApp = await stockAppState(app);
  await page.screenshot({ path: join(output, "first-launch.png"), timeout: 7_000 });
  console.log(`Stock MIME default after launch: ${proof.afterFirstLaunch.xdg ?? "(none)"}`);

  if (proof.afterFirstLaunch.xdg && proof.firstApp.electronDefaultProtocolClient) {
    await app.evaluate(({ app }) => {
      globalThis.antigravityQaAcceptedUrls = [];
      app.on("second-instance", (_event, argv) => {
        globalThis.antigravityQaAcceptedUrls.push(...argv);
      });
    });
    execFileSync("xdg-open", [url], { encoding: "utf8", timeout: 10_000 });
    const deadline = Date.now() + 10_000;
    while (!proof.stockShellDispatch && Date.now() < deadline) {
      proof.stockShellDispatch = await app.evaluate((_electron, href) => globalThis.antigravityQaAcceptedUrls.includes(href), url);
      if (!proof.stockShellDispatch) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!proof.stockShellDispatch) throw new Error("Stock xdg-open did not deliver exact URL to the running app");
    await page.screenshot({ path: join(output, "stock-shell-launch.png"), timeout: 7_000 });
  } else {
    console.log("No stock default handler for Antigravity. Testing the exact URI as cold application argv.");
    await close(app);
    app = undefined;
    page = undefined;
    app = await launch([url]);
    page = await app.firstWindow({ timeout: 25_000 });
    const direct = await getVisibleView(app, page, "Direct argv");
    page = direct.window;
    proof.directArgv = await stockAppState(app);
    proof.directView = { welcome: direct.welcome, content: direct.view };
    proof.packagedLogs = await findDeepLinkLog(app);
    if (!proof.directArgv.argvHasExactUri || !proof.directArgv.visibleWindows.length) {
      throw new Error("Cold application argv did not retain the exact URI in a visible instance");
    }
    await page.screenshot({ path: join(output, "application-argv-launch.png"), timeout: 7_000 });
    if (!direct.welcome && !proof.directArgv.visibleWindows.some(({ title }) => /welcome to antigravity/i.test(title))) {
      throw new Error("Exact argv reached the native app but its welcome view was not observed");
    }
  }
} catch (error) {
  if (page) {
    proof.errorView = await page.evaluate(() => ({ title: document.title, text: document.body?.innerText?.slice(0, 1_000) })).catch(() => null);
    await page.screenshot({ path: join(output, "renderer-error.png"), timeout: 6_000 }).catch(() => {});
  }
  throw error;
} finally {
  writeFileSync(join(output, "proof.json"), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
  await close(app);
}
