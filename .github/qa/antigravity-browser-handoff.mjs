import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const [scratch, route] = process.argv.slice(2);
assert.ok(route === "draft" || route === "marketplace");
const output = join(scratch, "evidence", route);
await mkdir(output, { recursive: true });
const observe = join(scratch, "browser-observe");
const chromeBundle = "/Applications/Google Chrome.app";
const chromeBinary = join(chromeBundle, "Contents/MacOS/Google Chrome");
const appID = "com.google.antigravity";
const site = "https://deeplinks.fun/";
const run = (file, args) => execFileSync(file, args, { encoding: "utf8", timeout: 30000 }).trim();
const field = (app, name) => run("/usr/bin/plutil", ["-extract", name, "raw", join(app, "Contents/Info.plist")]);
const apps = () => JSON.parse(run(observe, ["application", appID]));
const capture = file => run("/usr/sbin/screencapture", ["-x", join(output, file)]);
const recognize = file => run(observe, ["ocr", join(output, file)]);
const installed = await realpath((await readFile(join(scratch, "app-path.txt"), "utf8")).trim());
const installedExecutable = join(installed, "Contents/MacOS", field(installed, "CFBundleExecutable"));
const packageDir = join(scratch, "library/package");
const { getAgentLink } = await import(pathToFileURL(join(packageDir, "dist/index.js")));
const version = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8")).version;
const linkOptions = route === "draft"
  ? { prompt: "tell me about deeplinks.fun" }
  : { action: "marketplace" };
const uri = getAgentLink("antigravity", "desktop", linkOptions);
const mainLogs = [
  "Library/Logs/Antigravity/main.log",
  "Library/Logs/antigravity/main.log",
  "Library/Application Support/Antigravity/logs/main.log",
];
assert.equal(version, "0.1.56");
assert.equal(uri, route === "draft"
  ? "antigravity://open?prompt=tell%20me%20about%20deeplinks.fun"
  : "antigravity://customizations/marketplaces");
const selector = route === "draft"
  ? '.agent-row a[aria-label="Open Antigravity"]'
  : 'a[aria-label="Antigravity: Marketplace"]';

const proof = {
  stage: "verifying exact installed app and browser",
  libraryVersion: version,
  site,
  uri,
  route,
  installedBundleId: field(installed, "CFBundleIdentifier"),
  installedVersion: field(installed, "CFBundleShortVersionString"),
  installedBuild: field(installed, "CFBundleVersion"),
  chromeVersion: field(chromeBundle, "CFBundleShortVersionString"),
  accountUsed: false,
  promptSubmitted: false,
  permanentBrowserPermissionSelected: false,
};
let chrome;
let ws;
let launched;
let sequence = 0;
const pending = new Map();

function exactProcesses() {
  return run("/bin/ps", ["-axww", "-o", "pid=,command="]).split("\n").flatMap(line => {
    const match = /^\s*(\d+)\s+(.+)$/u.exec(line);
    if (!match || (match[2] !== installedExecutable && !match[2].startsWith(installedExecutable + " "))) return [];
    return [{ pid: match[1], path: installed }];
  });
}

function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, 6000);
    pending.set(id, message => {
      clearTimeout(timeout);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const { result, exceptionDetails } = await command("Runtime.evaluate", { expression, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
}

try {
  assert.equal(proof.installedBundleId, appID);
  assert.equal(proof.installedVersion, "2.35.2");
  run("/usr/bin/codesign", ["--verify", "--deep", "--strict", installed]);
  const signature = run("/bin/sh", ["-c", 'exec /usr/bin/codesign -dv --verbose=4 "$1" 2>&1', "verify", installed]);
  assert.match(signature, /(^|\n)TeamIdentifier=EQHXZ8M8AV(\n|$)/u);
  const gatekeeper = run("/bin/sh", ["-c", 'exec /usr/sbin/spctl --assess --type execute --verbose=4 "$1" 2>&1', "verify", installed]);
  assert.match(gatekeeper, /source=Notarized Developer ID/u);
  await writeFile(join(output, "browser-test-app-identity.txt"), signature + "\n" + gatekeeper + "\n");
  proof.osResolverMatchesInstalledApp = await realpath(run(observe, ["resolve", uri])) === installed;
  assert.ok(proof.osResolverMatchesInstalledApp);
  assert.deepEqual(apps(), []);
  assert.deepEqual(exactProcesses(), []);

  const profile = join(scratch, route + "-chrome-profile");
  await mkdir(profile);
  proof.stage = "rendering current production playground in Chrome";
  chrome = spawn(chromeBinary, [
    `--user-data-dir=${profile}`, "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
    "--no-first-run", "--no-default-browser-check", "--window-size=1150,750", "about:blank",
  ], { stdio: "ignore" });

  let target;
  for (let attempt = 0; attempt < 48; attempt++) {
    const port = await readFile(join(profile, "DevToolsActivePort"), "utf8").catch(() => "");
    if (port) {
      const response = await fetch(`http://127.0.0.1:${port.split("\n", 1)[0]}/json/list`);
      target = (await response.json()).find(entry => entry.type === "page" && entry.url === "about:blank");
      if (target) break;
    }
    await wait(250);
  }
  assert.ok(target, "Stock Chrome did not expose the disposable tab");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  await command("Page.enable");
  await command("Page.bringToFront");
  await command("Page.navigate", { url: site });

  for (let attempt = 0; attempt < 75; attempt++) {
    proof.button = await evaluate(`(() => {
      const anchors = document.querySelectorAll(${JSON.stringify(selector)});
      if (anchors.length !== 1) return null;
      const a = anchors[0];
      a.scrollIntoView({ block: "center" });
      const r = a.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (!a.contains(document.elementFromPoint(x, y))) return null;
      a.addEventListener("click", event => {
        window.__qaActivation = { trusted: event.isTrusted, active: navigator.userActivation.isActive, href: a.href };
      }, { once: true });
      return { url: location.href, href: a.href, text: a.innerText, x, y, width: r.width, height: r.height };
    })()`).catch(() => null);
    if (proof.button) break;
    await wait(250);
  }
  assert.equal(proof.button?.url, site);
  assert.equal(proof.button.href, uri);
  assert.equal(proof.button.text.replace(/\s+/g, " ").trim(), route === "draft" ? "Antigravity" : "Antigravity Marketplace");
  assert.ok(proof.button.width > 40 && proof.button.height > 20);
  const before = await command("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(join(output, "playground-before-click.png"), Buffer.from(before.data, "base64"));

  proof.stage = "cold browser handoff";
  assert.deepEqual(apps(), [], "Antigravity was running before the Playground button click");
  assert.deepEqual(exactProcesses(), []);
  const { x, y } = proof.button;
  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  proof.trustedActivation = await evaluate("window.__qaActivation");
  assert.deepEqual(proof.trustedActivation, { trusted: true, active: true, href: uri });

  proof.appObservations = [];
  for (let attempt = 0; attempt < 36; attempt++) {
    await wait(1000);
    const known = apps();
    const matching = exactProcesses();
    if (known.length || matching.length) proof.appObservations.push({ attempt, known, matching });
    launched = matching[0];
    for (const app of known) {
      if (await realpath(app.path).catch(() => "") === installed) launched = app;
    }
    if (launched) break;
    if (proof.browserConfirmation) {
      if (attempt % 6 === 0) capture("after-browser-confirmation.png");
      continue;
    }
    capture("browser-confirmation.png");
    const labels = recognize("browser-confirmation.png");
    await writeFile(join(output, "browser-confirmation-ocr.txt"), labels + "\n");
    try {
      proof.browserConfirmation = run(observe, ["confirm-chrome", join(output, "browser-confirmation.png"), String(chrome.pid)]);
    } catch (error) {
      if (error.status !== 2 && error.status !== 3) throw error;
    }
  }
  capture("after-browser-handoff.png");
  assert.ok(launched, "The exact signed Antigravity app did not start from the trusted production browser click");
  proof.launched = launched;
  proof.stage = "checking stock Antigravity welcome window";
  for (let attempt = 0; attempt < 15; attempt++) {
    await wait(1200);
    capture("native-welcome.png");
    const ocr = recognize("native-welcome.png");
    await writeFile(join(output, "native-welcome-ocr.txt"), ocr + "\n");
    if (apps().some(app => app.pid === launched.pid) &&
      /welcome to antigravity/iu.test(ocr) &&
      /continue with google|use business account|sign in/iu.test(ocr)) {
      proof.signedOutWelcomeVisible = true;
      break;
    }
  }
  assert.ok(proof.signedOutWelcomeVisible, "Signed Antigravity opened without a recognized welcome window");
  proof.exactNativeLogMessages = [];
  for (const logPath of mainLogs) {
    const log = await readFile(join(homedir(), logPath), "utf8").catch(() => "");
    const line = log.split("\n").find(value => value.includes(uri));
    if (line) proof.exactNativeLogMessages.push({ logPath, line });
  }
  proof.stage = "passed";
} catch (error) {
  proof.error = error.message;
  throw error;
} finally {
  await writeFile(join(output, "handoff-proof.json"), JSON.stringify(proof, null, 2) + "\n");
  ws?.close();
  chrome?.kill("SIGTERM");
  if (launched && exactProcesses().some(app => app.pid === launched.pid)) {
    process.kill(Number(launched.pid), "SIGTERM");
    for (let attempt = 0; attempt < 20 && exactProcesses().length; attempt++) await wait(250);
  }
}
