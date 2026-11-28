import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, openSync, closeSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const scratch = process.argv[2];
const evidence = join(scratch, "evidence");
const fixture = join(scratch, "fixture");
const binary = realpathSync("/opt/T3 Code (Beta)/t3code");
const cli = join(scratch, "cli", "t3");
const database = join(process.env.T3CODE_HOME, "userdata", "statev2.sqlite");
const identity = join(process.env.T3CODE_HOME, "userdata", "environment-id");
const load = createRequire(join(scratch, "package.json"));
const { chromium } = load("playwright-core");
const { getAgentLink } = await import(pathToFileURL(join(scratch, "library/dist/index.js")));
const mime = "x-scheme-handler/t3code";
const marker = "LinuxProof8296 T3 saved thread + & %2F café ☃\nSecond line stays unsent";
const expectedCounts = { threads: 1, runs: 0, provider_sessions: 0, provider_turns: 0 };
const proof = { revision: "T3 Code 0.1.13 Linux amd64 DEB", libraryVersion: "0.1.72", binary,
  accountUsed: false, providerConnected: false, promptSubmitted: false };
const observerOrigin = "http://127.0.0.1:14637";

function run(file, args, options = {}) {
  const result = spawnSync(file, args, { encoding: "utf8", env: process.env, timeout: 6500, ...options });
  return { code: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function check(file, args, options) {
  const result = run(file, args, options);
  assert.equal(result.code, 0, file + " did not complete");
  return result.stdout;
}

function checkpoint(stage) {
  proof.lastStage = stage;
  writeFileSync(join(evidence, "proof.json"), JSON.stringify(proof, null, 2) + "\n");
  console.log("T3 scratch replay: " + stage);
}

function projection() {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    const prefix = "orchestration_v2_projection_";
    const counts = Object.fromEntries(Object.keys(expectedCounts).map(name => [
      name, db.prepare("SELECT count(*) AS n FROM " + prefix + name).get().n,
    ]));
    const thread = db.prepare("SELECT thread_id, title FROM " + prefix + "threads").all();
    const projects = db.prepare("SELECT workspace_root FROM projection_projects").all();
    return { counts, thread, projects };
  } finally {
    db.close();
  }
}

function registration() {
  const selected = check("xdg-mime", ["query", "default", mime]).trim();
  assert.ok(["t3code.desktop", "com.t3tools.T3Code.desktop"].includes(selected), "No installed T3 XDG handler");
  const gio = check("gio", ["mime", mime]);
  assert.ok(gio.startsWith("Default application for “" + mime + "”: " + selected), "XDG and GIO disagreed");
  const userEntry = join(process.env.XDG_DATA_HOME, "applications", selected);
  const path = existsSync(userEntry) ? userEntry : join("/usr/share/applications", selected);
  const entry = readFileSync(path, "utf8");
  const selectedExec = entry.split("\n").find(line => line.startsWith("Exec="));
  assert.equal(selectedExec, 'Exec="' + binary + '" %U');
  assert.ok(entry.split("\n").some(line => line.startsWith("MimeType=") && line.includes(mime + ";")));
  writeFileSync(join(evidence, "selected-handler.desktop"), entry);
  return { selected, selectedExec };
}

function owned() {
  return readdirSync("/proc").filter(name => /^\d+$/u.test(name)).flatMap(pid => {
    try {
      const executable = realpathSync(join("/proc", pid, "exe"));
      if (!executable.startsWith(dirname(binary) + "/")) return [];
      const argv = readFileSync(join("/proc", pid, "cmdline"), "utf8").split("\0").filter(Boolean);
      return [{ pid: Number(pid), executable, argv }];
    } catch {
      return [];
    }
  });
}

function stopOwned() {
  for (const { pid } of owned()) {
    try { process.kill(pid, "SIGTERM"); }
    catch (error) { if (error.code !== "ESRCH") throw error; }
  }
}

async function eventually(description, ms, sample) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const result = await sample();
    if (result) return result;
    await wait(400);
  }
  throw new Error(description);
}

function foreground(pid) {
  const id = run("xdotool", ["getactivewindow"]).stdout.trim();
  const visible = run("xdotool", ["search", "--onlyvisible", "--pid", String(pid)]).stdout.trim().split("\n");
  if (!visible.includes(id) || !id) return null;
  const title = run("xdotool", ["getwindowname", id]).stdout.trim();
  return /T3 Code/u.test(title) ? { id, title, pid } : null;
}

function findMarker(png) {
  const words = run("tesseract", [png, "stdout", "--psm", "11", "tsv"], { timeout: 15000 }).stdout;
  for (const row of words.split("\n")) {
    const [level, , , , , , left, top, width, height, , label] = row.split("\t");
    if (level === "5" && /^linuxproof8296$/iu.test(label ?? "")) {
      return { x: Math.round(Number(left) + Number(width) / 2), y: Math.round(Number(top) + Number(height) / 2) };
    }
  }
  return null;
}

async function attachPackagedRenderer(pid) {
  const listener = await eventually("The stock app did not expose a matching loopback renderer observer", 38000, () => {
    const rows = run("ss", ["-H", "-ltnp", "sport = :14637"]).stdout.trim().split("\n").filter(Boolean);
    return rows.length === 1 && rows[0].includes("127.0.0.1:14637") && rows[0].includes("pid=" + pid + ",");
  });
  assert.equal(listener, true);
  proof.warmObserverMatchedAppPid = true;
  const browser = await chromium.connectOverCDP(observerOrigin, { timeout: 12000 });
  try {
    const page = await eventually("The packaged app had no renderer target", 20000, () =>
      browser.contexts().flatMap(context => context.pages()).find(page => page.url().startsWith("t3code://app/")));
    return { browser, page };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

const manager = spawn("openbox", [], { stdio: "ignore" });
let browser;
let cliProcess;
let gioEvents;
let launchedMessages = "";
try {
  const activeLinks = JSON.parse(readFileSync(join(evidence, "links.json"), "utf8")).map(link => link.ifname);
  assert.deepEqual(activeLinks, ["lo"]);
  assert.deepEqual(JSON.parse(readFileSync(join(evidence, "routes.json"), "utf8")), []);
  proof.loopbackOnly = true;
  checkpoint("seed one idle thread using the published CLI");
  check("git", ["init", "-q", "-b", "main"], { cwd: fixture });
  check("git", ["-c", "user.name=T3 QA", "-c", "user.email=qa@example.invalid",
    "commit", "--allow-empty", "-qm", "Disposable Linux fixture"], { cwd: fixture });
  const log = openSync(join(scratch, "private-cli.log"), "wx", 0o600);
  cliProcess = spawn(cli, ["--mode", "web", "--host", "127.0.0.1", "--port", "43981", "--no-browser",
    "--base-dir", process.env.T3CODE_HOME, "--auto-bootstrap-project-from-cwd", fixture,],
    { cwd: fixture, env: process.env, stdio: ["ignore", log, log] });
  closeSync(log);
  const cliExit = new Promise((resolve, reject) => {
    cliProcess.once("error", reject);
    cliProcess.once("exit", (code, signal) => resolve({ code, signal }));
  });
  cliExit.catch(() => {});
  const seed = await eventually("Stock CLI did not seed one idle project and thread", 55000, () => {
    if (!existsSync(database) || !existsSync(identity)) return null;
    try {
      const state = projection();
      return state.thread.length === 1 && state.projects.length === 1 ? state : null;
    } catch {
      return null;
    }
  });
  assert.deepEqual(seed.counts, expectedCounts);
  assert.equal(realpathSync(seed.projects[0].workspace_root), realpathSync(fixture));
  const environmentId = readFileSync(identity, "utf8").trim();
  const threadId = seed.thread[0].thread_id;
  const threadPath = [environmentId, threadId].map(encodeURIComponent).join("/");
  const blank = getAgentLink("t3-code", "desktop", { environment: environmentId, session: threadId });
  const draft = getAgentLink("t3-code", "desktop", {
    session: "https://app.t3.codes/threads/" + threadPath, prompt: marker,
  });
  assert.equal(blank, "t3code://threads/" + threadPath);
  assert.equal(draft, blank + "?prompt=" + encodeURIComponent(marker));
  proof.fixture = { environmentId, threadId, blank, draft, marker, initialCounts: seed.counts };
  cliProcess.kill("SIGTERM");
  proof.cliStopped = await Promise.race([cliExit, wait(8000).then(() => null)]);
  assert.ok(proof.cliStopped);

  checkpoint("start the stock package directly with a loopback renderer observer");
  const desktopLog = openSync(join(scratch, "private-desktop.log"), "wx", 0o600);
  const desktop = spawn(binary, [
    "--no-sandbox", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=14637",
  ], { env: process.env, cwd: fixture, stdio: ["ignore", desktopLog, desktopLog] });
  closeSync(desktopLog);
  desktop.once("error", error => { proof.warmSpawnError = error.code; });
  proof.warmPid = desktop.pid ?? null;
  try {
    proof.warmWindow = await eventually("The packaged app did not own a foreground setup window", 30000,
      () => foreground(desktop.pid));
    check("scrot", ["--overwrite", join(evidence, "ordinary-startup.png")]);
    const connected = await attachPackagedRenderer(desktop.pid);
    browser = connected.browser;
    const page = connected.page;
    await page.waitForFunction(() => document.body?.innerText?.trim(), undefined, { timeout: 25000 })
      .catch(async () => {
        proof.packagedRootBootstrap = true;
        await page.goto("t3code://app/#/", { waitUntil: "domcontentloaded", timeout: 12000 });
      });
    const skip = page.getByRole("button", { name: "Start without an agent", exact: true });
    if (await skip.waitFor({ timeout: 9000 }).then(() => true, () => false)) {
      await skip.click({ timeout: 8000 });
      await page.waitForFunction(() => !location.hash.includes("/welcome"), undefined, { timeout: 15000 });
      proof.onboardedWithoutAgent = true;
    }
    checkpoint("dispatch the exact plain saved-thread link through the stock desktop handler");
    proof.registration = registration();
    proof.warmBaseline = page.url().split("#")[1] ?? "";
    check("xdg-open", [blank]);
    await page.waitForFunction(({ environmentId, threadId }) => {
      const parts = new URL(location.href).hash.slice(1).split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
      return parts[0] === environmentId && parts[1] === threadId;
    }, { environmentId, threadId }, { timeout: 35000 });
    const edit = page.locator("[contenteditable=true][data-lexical-editor=true]").filter({ visible: true });
    await edit.first().waitFor({ state: "visible", timeout: 18000 });
    assert.equal(await edit.first().evaluate(node => node.innerText.trim()), "");
    proof.warmBlank = { exactThreadVisible: true, emptyEditor: true, pid: desktop.pid, page: page.url() };
    check("scrot", ["--overwrite", join(evidence, "warm-blank-thread.png")]);
  } catch (error) {
    proof.warmObserverFailure = error.name;
    proof.warmCheckpoint = proof.lastStage;
    if (foreground(desktop.pid)) check("scrot", ["--overwrite", join(evidence, "warm-last-visible.png")]);
  }
  if (browser) await browser.close().catch(() => {});
  browser = undefined;
  stopOwned();
  await eventually("An installed T3 process remained before cold dispatch", 19000, () => owned().length === 0);
  proof.processAbsentBeforeCold = true;
  proof.registration = registration();

  checkpoint("cold-dispatch the exact saved-thread draft URL through stock XDG and GIO");
  gioEvents = spawn("dbus-monitor", ["--session",
    "type='signal',interface='org.gtk.gio.DesktopAppInfo',member='Launched'"], { stdio: ["ignore", "pipe", "ignore"] });
  gioEvents.stdout.on("data", data => { launchedMessages = (launchedMessages + data.toString()).slice(-8000); });
  await wait(300);
  check("xdg-open", [draft]);
  const cold = await eventually("Stock XDG did not start a new owner with the exact URI argument", 40000, () =>
    owned().find(info => info.executable === binary && info.argv.includes(draft) && info.pid !== proof.warmPid));
  proof.coldApp = cold;
  await eventually("The GIO launch trace did not contain the exact URI", 4000, () => launchedMessages.includes(draft));
  proof.gioLaunchedContainsExactUri = true;

  checkpoint("verify foreground draft with X11 and the native editor's Copy command");
  const png = join(evidence, "cold-composer.png");
  const candidate = await eventually("The cold app did not show the draft in its foreground window", 70000, () => {
    const frame = foreground(cold.pid);
    if (!frame) return null;
    check("scrot", ["--overwrite", png]);
    const point = findMarker(png);
    return point ? { frame, point } : null;
  });
  proof.savedForegroundWindow = candidate.frame;
  const position = candidate.point;
  check("xdotool", ["mousemove", String(position.x), String(position.y), "click", "1"]);
  check("xdotool", ["key", "--clearmodifiers", "ctrl+a", "ctrl+c"]);
  const copied = await eventually("The foreground native editor did not copy the exact multiline draft", 9000, () => {
    const clip = run("xclip", ["-selection", "clipboard", "-o"]);
    return clip.code === 0 && clip.stdout === marker ? clip.stdout : null;
  });
  assert.equal(copied, marker);
  const ocr = run("tesseract", [png, "stdout", "--psm", "11"], { timeout: 15000 }).stdout;
  proof.exactVisibleEditorText = copied;
  proof.visibleLinkNotice = /prompt added from a link/iu.test(ocr);
  proof.finalProjection = projection().counts;
  assert.deepEqual(proof.finalProjection, expectedCounts);
  checkpoint("complete");
} finally {
  if (gioEvents) gioEvents.kill("SIGTERM");
  if (launchedMessages) writeFileSync(join(evidence, "gio-launch.txt"), launchedMessages);
  if (browser) await browser.close().catch(() => {});
  if (cliProcess?.exitCode === null) cliProcess.kill("SIGTERM");
  stopOwned();
  manager.kill("SIGTERM");
  writeFileSync(join(evidence, "proof.json"), JSON.stringify(proof, null, 2) + "\n");
}

