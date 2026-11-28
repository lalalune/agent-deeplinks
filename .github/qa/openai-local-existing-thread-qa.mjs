import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as wait } from "node:timers/promises";
import { getAgentLink } from "agent-deeplinks";

const scratch = process.argv[2];
const evidence = join(scratch, "evidence");
const cwd = join(scratch, "Empty Codex project");
const pidExe = "/usr/lib/chatgpt/ChatGPT";
const title = "QA existing Codex local thread café";
const alpha = join(scratch, "Codex QA workspace Alpha");
const bravo = join(scratch, "Codex QA workspace Bravo");
const missing = join(scratch, "Codex QA workspace absent");
const alphaOrigin = "https://example.invalid/codex-qa/alpha.git";
const bravoOrigin = "git@example.invalid:codex-qa/bravo.git";
const roots = [alpha, bravo];
const debugPort = 14637;
const proof = { title, cwd, publishedPackage: "agent-deeplinks@0.1.68", accountUsed: false, gatewayRequests: [] };
mkdirSync(cwd);

function command(binary, args, timeout = 4500) {
  const result = spawnSync(binary, args, { encoding: "utf8", timeout });
  return { status: result.status, out: result.stdout?.trim() ?? "", error: result.stderr?.trim() ?? "" };
}
for (const [root, origin] of [[alpha, alphaOrigin], [bravo, bravoOrigin]]) {
  mkdirSync(root);
  assert.equal(command("git", ["init", "--quiet", root]).status, 0);
  assert.equal(command("git", ["-C", root, "remote", "add", "origin", origin]).status, 0);
  assert.deepEqual(readdirSync(root), [".git"]);
}
function owned() {
  return readdirSync("/proc").flatMap(id => {
    if (!/^\d+$/u.test(id)) return [];
    try {
      if (realpathSync(join("/proc", id, "exe")) !== pidExe) return [];
      const argv = readFileSync(join("/proc", id, "cmdline"), "utf8").split("\0").filter(Boolean);
      return argv.join(" ").includes(" --type=") ? [] : [{ pid: Number(id), argv }];
    } catch { return []; }
  });
}
function snapshot(name) {
  const image = join(evidence, name + ".png");
  const capture = command("scrot", [image]);
  if (capture.status !== 0) return { capture };
  const recognized = command("tesseract", [image, "stdout", "--psm", "11"], 8500);
  return { screenshot: name + ".png", visibleText: recognized.out };
}
function stateRecord(thread) {
  return { id: thread.id, name: thread.name, cwd: thread.cwd, modelProvider: thread.modelProvider,
    ephemeral: thread.ephemeral, turns: thread.turns?.length ?? null };
}

function appServer(executable) {
  const program = spawn(executable, ["app-server", "--listen", "stdio://"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: program.stdout });
  const pending = new Map();
  let next = 0;
  let diagnostic = "";
  program.stderr.on("data", chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-2500); });
  lines.on("line", line => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const done = pending.get(message.id);
    if (!done) return;
    pending.delete(message.id);
    clearTimeout(done.timeout);
    if (message.error) done.reject(new Error(message.error.message));
    else done.resolve(message.result);
  });
  program.on("exit", code => {
    for (const active of pending.values()) {
      clearTimeout(active.timeout);
      active.reject(new Error("App server exited (" + code + "): " + diagnostic));
    }
    pending.clear();
  });
  return {
    request(method, params) {
      const id = ++next;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error("App server deadline: " + method + ": " + diagnostic));
        }, 6500);
        pending.set(id, { timeout, reject, resolve });
        program.stdin.write(JSON.stringify({ id, method, params }) + "\n");
      });
    },
    notify(method) { program.stdin.write(JSON.stringify({ method }) + "\n"); },
    async close() {
      const exited = new Promise(resolve => program.once("exit", resolve));
      program.stdin.end();
      await Promise.race([exited, wait(1800)]);
      if (program.exitCode === null) program.kill("SIGTERM");
    },
  };
}
async function initialize(client) {
  await client.request("initialize", { clientInfo: { name: "agent_deeplinks_qa", title: "Agent Deeplinks QA", version: "0.1.68" } });
  client.notify("initialized");
}

const service = createServer((request, response) => {
  const method = request.method;
  const route = request.url;
  const status = method === "GET" && route === "/v1/models" ? 200 : 405;
  proof.gatewayRequests.push({ method, route: route === "/v1/models" || route === "/v1/responses" ? route : "other", status });
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(status === 200
    ? { object: "list", data: [{ id: "gpt-6-sol", object: "model" }] }
    : { error: { message: "QA gateway serves model metadata only" } }));
});
await new Promise(resolve => service.listen(0, "127.0.0.1", resolve));
const port = service.address().port;
writeFileSync(join(process.env.CODEX_HOME, "config.toml"),
  `model = "gpt-6-sol"
model_provider = "qa-local"
web_search = "disabled"
approval_policy = "never"
sandbox_mode = "read-only"
[model_providers.qa-local]
name = "QA loopback metadata only"
base_url = "http://127.0.0.1:${port}/v1"
wire_api = "responses"
requires_openai_auth = false
`);
const manager = spawn("openbox", ["--sm-disable"], { stdio: "ignore" });
const bus = spawn("dbus-monitor", ["--session","type='signal',interface='org.gtk.gio.DesktopAppInfo',member='Launched'"], { stdio: ["ignore","pipe","ignore"] });
let gio = "";
bus.stdout.on("data", part => gio += part);

let stage = "official bundled CLI";
let desktop;
try {
  const list = readFileSync(join(scratch, "bundled-codex-paths.txt"), "utf8").trim().split("\n").filter(Boolean);
  const executable = list.find(path => path === "/usr/lib/chatgpt/resources/codex") ?? list.find(path => path.startsWith("/usr/lib/chatgpt/resources/"));
  assert.ok(executable, "The signed desktop package did not provide a named Codex CLI executable");
  proof.bundledCli = { path: executable, version: command(executable, ["--version"]) };
  assert.equal(proof.bundledCli.version.status, 0);
  stage = "create local named thread without a turn";
  const client = appServer(executable);
  try {
    await initialize(client);
    const created = await client.request("thread/start", { model: "gpt-6-sol", cwd, approvalPolicy: "never", sandbox: "read-only" });
    proof.created = stateRecord(created.thread);
    assert.match(proof.created.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu);
    await client.request("thread/name/set", { threadId: proof.created.id, name: title });
  } finally {
    await client.close();
  }
  stage = "read persisted local thread in separate bundled app-server";
  const reader = appServer(executable);
  try {
    await initialize(reader);
    const persisted = await reader.request("thread/read", { threadId: proof.created.id, includeTurns: false });
    proof.persisted = stateRecord(persisted.thread);
    assert.equal(proof.persisted.id, proof.created.id);
    assert.equal(proof.persisted.name, title);
  } finally {
    await reader.close();
  }

  stage = "warm stock desktop with supported credential-free provider";
  const link = getAgentLink("codex", "desktop", { session: proof.created.id });
  proof.exactLink = link;
  proof.sameChatGPTLink = getAgentLink("chatgpt", "desktop", { session: proof.created.id }) === link;
  assert.equal(link, "codex://threads/" + proof.created.id);
  assert.equal(proof.sameChatGPTLink, true);
  const mime = "x-scheme-handler/codex";
  proof.gioBefore = command("gio", ["mime", mime]);
  assert.match(proof.gioBefore.out, /chatgpt\.desktop/u);
  proof.stockSelected = command("xdg-mime", ["default", "chatgpt.desktop", mime]);
  assert.equal(proof.stockSelected.status, 0);
  desktop = spawn("chatgpt", ["--remote-debugging-address=127.0.0.1", "--remote-debugging-port=" + debugPort], { stdio: "ignore" });
  const before = await inspectFor(15000, state => state.text.includes("Sign in") || state.text.includes("New chat") || state.text.includes(title));
  proof.before = before.map(truncate);
  proof.beforeWindow = snapshot("before");
  const onboarding = before.find(state => state.skipWorkSetup);
  if (onboarding) {
    const { x, y } = onboarding.skipWorkSetup;
    proof.skippedExactWorkPreference = true;
    await callRenderer(onboarding.debuggerUrl, "Input.dispatchMouseEvent",
      { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await callRenderer(onboarding.debuggerUrl, "Input.dispatchMouseEvent",
      { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    const afterSetup = await inspectFor(18000, state => !state.skipWorkSetup && state.text.trim());
    proof.afterSetup = afterSetup.map(truncate);
    proof.afterSetupWindow = snapshot("after-optional-setup");
    assert.ok(afterSetup.some(state => !state.skipWorkSetup && state.text.trim()),
      "The native preference screen remained visible");
    assert.ok(!afterSetup.some(state => /^(Welcome to ChatGPT[\s\S]*Sign in|Sign in to ChatGPT|Sign in to continue|Continue to sign in)/iu.test(state.text.trim())),
      "The stock desktop stopped at account sign-in after skipping optional preferences");
  }

  stage = "existing local thread XDG dispatch";
  proof.existingDispatch = dispatch(link);
  const after = await inspectFor(20000, state => activeExistingThread(state));
  proof.after = after.map(truncate);
  proof.existingWindow = snapshot("existing-active-thread");
  proof.exactExistingThreadVisible = after.some(activeExistingThread);
  proof.newDrafts = {};
  stage = "stock workspace new-draft XDG dispatches";
  for (const [name, expectedRoot, options] of [
    ["register-alpha", alpha, { path: alpha }],
    ["register-bravo", bravo, { path: bravo }],
    ["origin-only-alpha", alpha, { originUrl: alphaOrigin }],
    ["missing-path-fallback-bravo", bravo, { path: missing, originUrl: bravoOrigin }],
    ["existing-path-precedence-alpha", alpha, { path: alpha, originUrl: bravoOrigin }],
  ]) {
    const test = { name, expectedRoot, marker: "Codex QA " + name + " + & café ☃\nUnsaved second line.", options };
    const url = getAgentLink("codex", "desktop", { prompt: test.marker, ...options });
    const params = [["prompt", test.marker], ...Object.entries(options)];
    assert.equal(url, "codex://threads/new?" + params.map(([key, value]) => key + "=" + encodeURIComponent(value)).join("&"));
    const result = { ...test, url, dispatch: dispatch(url), gatewayRequestsBefore: proof.gatewayRequests.length };
    proof.newDrafts[name] = result;
    const visibleDraft = state => state.editorDocuments.some(editor => editor.value === test.marker) && !state.hasTrustDialog;
    const accountGate = state => /^(Welcome to ChatGPT[\s\S]*Sign in|Sign in to ChatGPT|Sign in to continue|Continue to sign in)/iu.test(state.text.trim());
    let native = await inspectFor(18000, state => visibleDraft(state) || accountGate(state) || Boolean(state.exactScratchTrust));
    if (name.startsWith("register-")) {
      const gate = native.find(state => state.exactScratchTrust);
      if (gate) {
        const control = gate.exactScratchTrust;
        assert.equal(control.path, expectedRoot);
        assert.equal(realpathSync(control.path), expectedRoot);
        assert.deepEqual(readdirSync(expectedRoot), [".git"]);
        result.folderReview = { screen: snapshot(name + "-review"), native: native.map(truncate), path: control.path };
        await callRenderer(gate.debuggerUrl, "Input.dispatchMouseEvent",
          { type: "mousePressed", x: control.x, y: control.y, button: "left", clickCount: 1 });
        await callRenderer(gate.debuggerUrl, "Input.dispatchMouseEvent",
          { type: "mouseReleased", x: control.x, y: control.y, button: "left", clickCount: 1 });
        result.approvedScratchGitFixtureOnly = true;
        native = await inspectFor(19000, state => visibleDraft(state) || accountGate(state));
      }
    }
    result.native = native.map(truncate);
    result.window = snapshot(name + "-new-draft");
    result.exactEditableDraft = native.some(visibleDraft);
    result.gatewayRequestsAfter = proof.gatewayRequests.length;
  }
  stage = "audit persisted local threads and gateway after observation";
  const audit = appServer(executable);
  try {
    await initialize(audit);
    const refreshed = await audit.request("thread/read", { threadId: proof.created.id, includeTurns: true });
    proof.storedExistingThreadAfter = stateRecord(refreshed.thread);
    assert.equal(proof.storedExistingThreadAfter.id, proof.created.id);
    assert.equal(proof.storedExistingThreadAfter.turns, 0, "The local fixture has an unexpected stored turn");

  } finally {
    await audit.close();
  }
  for (const root of roots) {
    assert.deepEqual(readdirSync(root), [".git"]);
    assert.equal(command("git", ["-C", root, "status", "--porcelain"]).out, "");
  }
  assert.equal(proof.gatewayRequests.length, 0, "Unexpected gateway request");
  assert.equal(proof.exactExistingThreadVisible, true, "Existing fixture did not become the active thread header and Recents row");
  assert.ok(Object.values(proof.newDrafts).every(result => result.exactEditableDraft),
    "At least one new chat did not visibly prefill the exact editable draft");
} catch (error) {
  proof.blocker = { stage, message: error.message };
  process.exitCode = 1;
} finally {
  proof.exactGioDelivery = Boolean(proof.exactLink && gio.includes(proof.exactLink));
  for (const draft of Object.values(proof.newDrafts ?? {})) {
    draft.exactGioDelivery = gio.includes(draft.url);
  }
  if (gio) writeFileSync(join(evidence, "gio-launch.txt"), gio);
  writeFileSync(join(evidence, "proof.json"), JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
  for (const app of owned()) {
    try { process.kill(app.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  }
  if (desktop) desktop.kill("SIGTERM");
  bus.kill("SIGTERM");
  manager.kill("SIGTERM");
  service.close();
}

function dispatch(uri) {
  const child = spawn("xdg-open", [uri], { stdio: "ignore" });
  const result = { uri };
  child.on("exit", (code, signal) => { Object.assign(result, { code, signal }); });
  return result;
}
function activeExistingThread(state) {
  return state.title === title && state.visibleTitlePositions.some(position => position.x < 340 && position.ariaCurrent === "page") &&
    state.visibleTitlePositions.some(position => position.x >= 340);
}
function truncate({ debuggerUrl, ...state }) { return { ...state, text: state.text.slice(0, 2000) }; }
async function inspectFor(ms, success) {
  const deadline = Date.now() + ms;
  let states = [];
  while (Date.now() < deadline) {
    const sockets = command("ss", ["-ltnp", "sport", "=", ":" + debugPort]).out;
    if (sockets.includes("127.0.0.1:" + debugPort)) {
      const targets = await fetch("http://127.0.0.1:" + debugPort + "/json/list", { signal: AbortSignal.timeout(900) })
        .then(response => response.json()).catch(() => []);
      const results = await Promise.allSettled(targets.filter(target => target.type === "page").map(inspect));
      states = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
      if (states.some(success)) break;
    }
    await wait(650);
  }
  return states;
}
async function inspect(target) {
  const response = await callRenderer(target.webSocketDebuggerUrl, "Runtime.evaluate", {
    expression: `(() => {
      const text = document.body?.innerText ?? "";
      const expected = ["What type of work do you do?", "Customize ChatGPT to fit the way you work", "Suggest personalized tasks"];
      let skipWorkSetup = null;
      if (expected.every(value => text.includes(value))) {
        const skips = Array.from(document.querySelectorAll("button,[role=button]"))
          .filter(button => button.innerText.trim() === "Skip" && button.getClientRects().length);
        if (skips.length === 1) {
          const bounds = skips[0].getBoundingClientRect();
          skipWorkSetup = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        }
      }
      const visible = element => element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden";
      const editors = Array.from(document.querySelectorAll(
        'textarea, input[type="text"], input:not([type]), [contenteditable="true"], [role="textbox"]'
      )).filter(element => visible(element) && !element.disabled && !element.readOnly &&
        element.getAttribute("aria-disabled") !== "true" &&
        (element.isContentEditable || element.matches("textarea,input")));
      const editorDocuments = editors.map(element => {
        if (typeof element.value === "string") return { kind: element.tagName, value: element.value };
        const paragraphs = Array.from(element.children).filter(child => child.matches("p, div"));
        if (paragraphs.length && paragraphs.length === element.children.length) {
          const blocks = paragraphs.map(block => block.textContent);
          return { kind: "contenteditable", blocks, value: blocks.join(String.fromCharCode(10)) };
        }
        return { kind: "contenteditable", value: element.textContent };
      });
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).filter(visible);
      const folderDialog = dialogs.find(dialog => dialog.innerText.includes("Trust this folder?"));
      let exactScratchTrust = null;
      if (folderDialog) {
        const expectedPaths = ${JSON.stringify(roots)};
        const pathNode = Array.from(folderDialog.querySelectorAll("*"))
          .find(node => node.childElementCount === 0 && expectedPaths.includes(node.textContent.trim()) && visible(node));
        const choices = Array.from(folderDialog.querySelectorAll('button,[role="button"]'))
          .filter(node => node.innerText.trim() === "Trust folder" && visible(node));
        if (pathNode && choices.length === 1 && folderDialog.innerText.includes("Cancel")) {
          const bounds = choices[0].getBoundingClientRect();
          exactScratchTrust = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, path: pathNode.textContent.trim() };
        }
      }
      const expectedTitle = ${JSON.stringify(title)};
      const visibleTitlePositions = Array.from(document.querySelectorAll("body *"))
        .filter(element => element.childElementCount === 0 && element.innerText?.trim() === expectedTitle && visible(element))
        .map(element => {
          const { x, y } = element.getBoundingClientRect();
          const row = element.closest("button,[role=button],a,li");
          return { x, y, ariaCurrent: row?.getAttribute("aria-current"), ariaSelected: row?.getAttribute("aria-selected"),
            state: row?.getAttribute("data-state") };
        });
      const workspaceNames = ${JSON.stringify(roots.map(root => root.split("/").at(-1)))};
      const buttons = Array.from(document.querySelectorAll('button,[role="button"],[role="combobox"]')).filter(visible);
      const composerWorkspaceControls = buttons.flatMap(button => {
        const { x, y, width, height } = button.getBoundingClientRect();
        const nearbyEditor = editors.some(editor => {
          const editorBounds = editor.getBoundingClientRect();
          return x + width > editorBounds.x - 180 && x < editorBounds.right + 50 &&
            y + height > editorBounds.y - 90 && y < editorBounds.bottom + 140;
        });
        const label = [button.innerText, button.title, button.getAttribute("aria-label")].filter(Boolean).join(" | ");
        return nearbyEditor && workspaceNames.some(name => label.includes(name)) ? [{ label, x, y }] : [];
      });
      return { location: location.href, text, title: document.title, skipWorkSetup, editorDocuments, visibleTitlePositions, composerWorkspaceControls, hasTrustDialog: Boolean(folderDialog), exactScratchTrust };
    })()`, returnByValue: true,
  });
  return { ...response.result.value, debuggerUrl: target.webSocketDebuggerUrl };
}
async function callRenderer(debuggerUrl, method, params) {
  const url = new URL(debuggerUrl);
  assert.equal(url.origin, "ws://127.0.0.1:" + debugPort);
  const socket = new WebSocket(url);
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.close(); reject(new Error("renderer timeout")); }, 1800);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id: 1, method, params })), { once: true });
    socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      if (message.result) resolve(message.result);
      else reject(new Error("renderer operation unavailable"));
    });
    socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("renderer socket unavailable")); }, { once: true });
  });
}
