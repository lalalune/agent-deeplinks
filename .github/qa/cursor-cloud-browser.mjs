import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const [scratch, installation] = process.argv.slice(2);
const output = join(scratch, "evidence", "browser");
await mkdir(output, { recursive: true });
const observe = join(scratch, "browser-observe");
const chromeBundle = "/Applications/Google Chrome.app";
const chromeBinary = join(chromeBundle, "Contents/MacOS/Google Chrome");
const appID = "com.todesktop.230313mzl4w4u92";
const run = (file, args) => execFileSync(file, args, { encoding: "utf8", timeout: 30000 }).trim();
const field = (app, name) => run("/usr/bin/plutil", ["-extract", name, "raw", join(app, "Contents/Info.plist")]);
const apps = () => JSON.parse(run(observe, ["application", appID]));
const capture = file => run("/usr/sbin/screencapture", ["-x", join(output, file)]);
const recognize = file => run(observe, ["ocr", join(output, file)]);
const installed = await realpath(installation);
const installedExecutable = join(installed, "Contents/MacOS", field(installed, "CFBundleExecutable"));
const packageDir = join(scratch, "library/package");
const { getAgentLink } = await import(pathToFileURL(join(packageDir, "dist/index.js")));
const version = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8")).version;
const syntheticID = "bc-3fa04ccf-ab79-409b-9152-98c0accb9031";
const uri = getAgentLink("cursor", "desktop", { cloudAgent: syntheticID });
assert.equal(version, "0.1.71");
assert.equal(uri, "cursor://anysphere.cursor-deeplink/background-agent?bcId=" + syntheticID);
const selector = 'a[aria-label="Open Cursor Cloud Agent"]';
const site = "https://deeplinks.fun/";

const proof = {
  stage: "verifying exact installed app and browser",
  libraryVersion: version,
  site,
  uri,
  syntheticID,
  installedBundleId: field(installed, "CFBundleIdentifier"),
  installedVersion: field(installed, "CFBundleShortVersionString"),
  installedBuild: field(installed, "CFBundleVersion"),
  chromeVersion: field(chromeBundle, "CFBundleShortVersionString"),
  accountUsed: false,
  chatSubmitted: false,
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
  assert.equal(proof.installedVersion, "3.32.10");
  run("/usr/bin/codesign", ["--verify", "--deep", "--strict", installed]);
  const signature = run("/bin/sh", ["-c", 'exec /usr/bin/codesign -dv --verbose=4 "$1" 2>&1', "verify", installed]);
  assert.match(signature, /(^|\n)TeamIdentifier=VDXQ22DGB9(\n|$)/u);
  const gatekeeper = run("/bin/sh", ["-c", 'exec /usr/sbin/spctl --assess --type execute --verbose=4 "$1" 2>&1', "verify", installed]);
  assert.match(gatekeeper, /source=Notarized Developer ID/u);
  await writeFile(join(output, "browser-test-app-identity.txt"), signature + "\n" + gatekeeper + "\n");
  proof.osResolverMatchesInstalledApp = await realpath(run(observe, ["resolve", uri])) === installed;
  assert.ok(proof.osResolverMatchesInstalledApp);
  assert.deepEqual(apps(), []);
  assert.deepEqual(exactProcesses(), []);

  const profile = join(scratch, "chrome-profile");
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


  let formReady = false;
  for (let attempt = 0; attempt < 75; attempt++) {
    formReady = await evaluate(`(() => {
      const configure = document.querySelector('button[aria-label="Configure Cursor Cloud Agent"]');
      if (!configure) return false;
      if (configure.getAttribute("aria-expanded") !== "true") configure.click();
      const input = document.querySelector('[aria-label="Cursor Cloud Agent link"] input');
      if (!input) return false;
      input.focus();
      return true;
    })()`).catch(() => false);
    if (formReady) break;
    await wait(250);
  }
  assert.equal(formReady, true);
  await command("Input.insertText", { text: syntheticID });

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
  assert.equal(proof.button.text.replace(/\s+/g, " ").trim(), "Open Cursor Cloud Agent");
  assert.ok(proof.button.width > 40 && proof.button.height > 20);
  const before = await command("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(join(output, "playground-before-click.png"), Buffer.from(before.data, "base64"));

  proof.stage = "cold browser handoff";
  assert.deepEqual(apps(), [], "Cursor was running before the Playground button click");
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
      proof.browserConfirmation = run(observe, ["confirm-chrome", join(output, "browser-confirmation.png"), String(chrome.pid), new URL(site).hostname]);
    } catch (error) {
      if (error.status !== 2 && error.status !== 3) throw error;
    }
  }
  capture("after-browser-handoff.png");
  assert.ok(launched, "The exact signed Cursor app did not start from the trusted production browser click");
  proof.launched = launched;
  proof.stage = "checking stock Cursor welcome window";
  for (let attempt = 0; attempt < 15; attempt++) {
    await wait(1200);
    capture("native-welcome.png");
    const ocr = recognize("native-welcome.png");
    await writeFile(join(output, "native-welcome-ocr.txt"), ocr + "\n");
    const signedOut = /cursor/iu.test(ocr) && /log in|sign in|sign up|continue with google/iu.test(ocr);
    const owner = run(observe, ["frontmost"]);
    if (String(owner) === String(launched.pid) && apps().some(app => app.pid === launched.pid) && signedOut) {
      proof.nativeWindow = "signed-out";
      break;
    }
  }
  assert.ok(proof.nativeWindow, "Signed Cursor opened without a recognized native window");
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
