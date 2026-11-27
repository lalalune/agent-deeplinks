import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as wait } from 'node:timers/promises';
import { getAgentLink } from 'agent-deeplinks';

const scratch = realpathSync(process.argv[2]);
const evidence = join(scratch, 'evidence');
const fixture = join(scratch, 'fixture');
const bundle = realpathSync(process.env.T3_QA_BUNDLE);
const desktopBinary = realpathSync(process.env.T3_QA_BINARY);
const cli = realpathSync(process.env.T3_QA_CLI);
const observer = join(scratch, 'observe');
const database = join(process.env.T3CODE_HOME, 'userdata', 'statev2.sqlite');
const identity = join(process.env.T3CODE_HOME, 'userdata', 'environment-id');
let debugPort = 14637;
const bundledRoot = "t3code://app/#/";
const marker = 'T3 Mac 0.1.13 cold saved-thread draft + & %2F café ☃';
const proof = { release: 'agent-deeplinks@0.1.67', t3: '0.1.13 macOS arm64', desktopBinary,
  accountUsed: false, osHome: 'disposable GitHub-hosted runner', providerSubmission: false };
const expectedCounts = { threads: 1, runs: 0, provider_sessions: 0, provider_turns: 0 };
let phase = 'disposable Git fixture and provider binary check';
let appPid;
let seed;
let renderer;
let cliProcess;
const appLogPaths = ['private-app.stdout', 'private-app.stderr'].map(name => join(scratch, name));

function run(file, args, cwd = scratch, timeout = 7000) {
  return execFileSync(file, args, { encoding: 'utf8', timeout, killSignal: 'SIGKILL', cwd }).trim();
}

function checkpoint(nextPhase) {
  phase = nextPhase;
  const report = { ...proof, lastStage: phase };
  writeFileSync(join(evidence, 'proof.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('T3 replay checkpoint: ' + phase);
}

function queryProjection() {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    const tablePrefix = 'orchestration_v2_projection_';
    const counts = Object.fromEntries(Object.keys(expectedCounts).map(name => [
      name, db.prepare('SELECT count(*) AS n FROM ' + tablePrefix + name).get().n,
    ]));
    const rows = db.prepare('SELECT thread_id, title FROM ' + tablePrefix + 'threads').all();
    const projects = db.prepare('SELECT workspace_root FROM projection_projects').all();
    return { counts, rows, projects };
  } finally {
    db.close();
  }
}

function sanitizedBackendSignals() {
  const logDirectory = join(process.env.T3CODE_HOME, 'userdata', 'logs');
  const diagnostics = {};
  const allowlist = /\b(?:EPERM|EACCES|ETIMEDOUT|EADDRINUSE|ECONNREFUSED|ENOTFOUND|BackendReadinessTimeoutError|BackendProcessSpawnError|ProjectInvalidError|ThreadLaunchError|Skipped bootstrap project|Failed to launch bootstrap thread|SANDBOX_DENIED|SIGTERM|SIGKILL)\b/gu;
  for (const filename of ['server-child.log', 'desktop.log', 'desktop-observability.log', 'server.log']) {
    const path = join(logDirectory, filename);
    if (!existsSync(path)) continue;
    const log = readFileSync(path, 'utf8').slice(-96000);
    diagnostics[filename] = [...new Set(log.match(allowlist) ?? [])];
  }
  diagnostics.processSignals = appLogPaths.filter(existsSync)
    .flatMap(path => [...new Set(readFileSync(path, 'utf8').slice(-96000).match(allowlist) ?? [])]);
  return diagnostics;
}

function rendererDiagnostics() {
  const history = join(process.env.T3CODE_HOME, 'userdata', 'logs', 'renderer-history.ndjson');
  const events = new Set(['created', 'identified', 'dom-ready', 'render-process-gone', 'destroyed']);
  const exitReasons = new Set(['clean-exit', 'abnormal-exit', 'killed', 'crashed', 'oom', 'launch-failed', 'integrity-failure', 'memory-eviction']);
  const records = [];
  if (existsSync(history)) {
    for (const line of readFileSync(history, 'utf8').slice(-64000).split('\n')) {
      try {
        const row = JSON.parse(line);
        if (row.mainPid !== appPid || !['splash', 'main'].includes(row.surface) || !events.has(row.event)) continue;
        records.push({ surface: row.surface, event: row.event, ...(exitReasons.has(row.reason) && { reason: row.reason }) });
      } catch {}
    }
  }
  const signals = /\b(?:bootstrap resolved backend endpoint|backend ready|main window created|connecting splash shown|main window failed to load|main window render process gone|fatal startup error|ERR_[A-Z_]+)\b/gu;
  const lineSignals = appLogPaths.filter(existsSync)
    .flatMap(path => readFileSync(path, 'utf8').slice(-64000).match(signals) ?? []);
  return { history: existsSync(history), records: records.slice(-25), processSignals: [...new Set(lineSignals)].slice(-25) };
}

function runningBundle() {
  return realpathSync(run(observer, ['process', String(appPid)]));
}

function stockDispatch(uri) {
  assert.equal(runningBundle(), bundle);
  assert.equal(realpathSync(run(observer, ['resolve', uri])), bundle);
  run('/usr/bin/open', [uri]);
}

async function closeWarmApp() {
  renderer.close();
  renderer = undefined;
  assert.equal(runningBundle(), bundle);
  process.kill(appPid, 'SIGTERM');
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const count = Number(run(observer, ['running-count', bundle]));
    if (count === 0 && !run(observer, ['process', String(appPid)])) {
      proof.coldBefore = { warmPid: appPid, signedAppProcessCount: 0, previousPidNoLongerRegistered: true };
      appPid = undefined;
      return;
    }
    await wait(500);
  }
  throw new Error('The warm application did not exit before cold dispatch');
}

async function coldDispatch(uri) {
  assert.equal(Number(run(observer, ['running-count', bundle])), 0);
  const selected = realpathSync(run(observer, ['resolve', uri]));
  assert.equal(selected, bundle);
  debugPort = 14638;
  const environmentKeys = ['HOME', 'PATH', 'SHELL', 'TMPDIR', 'LANG',
    'GIT_CONFIG_NOSYSTEM', 'GIT_TERMINAL_PROMPT', 'T3CODE_HOME', 'T3CODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD',
    'T3CODE_DISABLE_AUTO_UPDATE', 'T3CODE_TELEMETRY_ENABLED'];
  const environment = environmentKeys.flatMap(key => ['--env', key + '=' + process.env[key]]);
  const stdoutPath = join(scratch, 'private-cold.stdout');
  const stderrPath = join(scratch, 'private-cold.stderr');
  for (const path of [stdoutPath, stderrPath]) {
    writeFileSync(path, '', { flag: 'wx', mode: 0o600 });
    appLogPaths.push(path);
  }
  proof.coldDispatch = { uri, selectedBundle: selected, appSelection: 'system default via LaunchServices' };
  run('/usr/bin/open', [...environment, '--stdout', stdoutPath, '--stderr', stderrPath, '-u', uri, '--args',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=' + debugPort]);
  proof.coldDispatch.openAccepted = true;
  const deadline = Date.now() + 35000;
  while (Date.now() < deadline) {
    const pid = Number(run(observer, ['running', bundle]));
    if (pid > 0 && pid !== proof.coldBefore.warmPid) {
      appPid = pid;
      assert.equal(runningBundle(), bundle);
      proof.coldDispatch.newPid = pid;
      proof.coldDispatch.newProcessOwnedBundle = true;
      return;
    }
    await wait(450);
  }
  throw new Error('LaunchServices did not cold-start the registered signed application');
}

function targetSummary(target) {
  const url = new URL(target.url);
  return { type: target.type, protocol: url.protocol, expectedHost: url.host === 'app' };
}

async function attachRenderer() {
  const deadline = Date.now() + 85000;
  while (Date.now() < deadline) {
    try {
      const fields = run('/usr/sbin/lsof', ['-nP', '-a', '-p', String(appPid), '-iTCP:' + debugPort, '-sTCP:LISTEN', '-Fn']);
      const listeners = fields.split('\n').filter(line => line.startsWith('n'));
      const loopback = new Set(['n127.0.0.1:' + debugPort, 'n[::1]:' + debugPort]);
      if (listeners.length && listeners.every(listener => loopback.has(listener))) {
        proof.observerOwnerLoopback = true;
        const targets = await fetch('http://127.0.0.1:' + debugPort + '/json/list', { signal: AbortSignal.timeout(1800) }).then(r => r.json());
        const pages = targets.filter(target => target.type === 'page');
        proof.rendererTargets = pages.map(targetSummary);
        const page = pages.find(target => target.url.startsWith('t3code://app/'));
        if (page) return cdp(page.webSocketDebuggerUrl);
      }
    } catch (error) {
      proof.observerError = error.code ?? error.name;
    }
    await wait(600);
  }
  throw new Error('The signed app had no verified loopback renderer target');
}

async function cdp(address) {
  const url = new URL(address);
  assert.equal(url.origin, 'ws://127.0.0.1:' + debugPort);
  const socket = new WebSocket(url);
  const pending = new Map();
  const diagnostics = [];
  let next = 0;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('Renderer handshake deadline')); }, 6000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Renderer connection error')); }, { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown' && diagnostics.length < 12) {
      const details = message.params?.exceptionDetails;
      const description = details?.exception?.description ?? details?.text ?? '';
      const category = description.match(/ReferenceError|TypeError|SyntaxError|EvalError|NetworkError|ERR_[A-Z_]+/u)?.[0] ?? 'JS exception';
      diagnostics.push({ category });
    } else if (message.method === 'Network.loadingFailed' && diagnostics.length < 12) {
      const error = message.params?.errorText.match(/net::ERR_[A-Z_]+/u)?.[0];
      diagnostics.push({ category: 'network', error, type: message.params?.type });
    }
  });
  proof.rendererDiagnostics = diagnostics;
  return {
    ask(method, params = {}) {
      const id = ++next;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Renderer observation deadline')); }, 4500);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

async function state(environmentId, threadId, expected) {
  const request = await renderer.ask('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    const hash = location.hash.slice(1);
    const route = new URL(hash || '/', 'https://app.invalid/');
    const ids = route.pathname.split('/').slice(1).map(decodeURIComponent);
    const matchesThread = ids.length === 2 && ids[0] === ${JSON.stringify(environmentId)} && ids[1] === ${JSON.stringify(threadId)};
    const visible = node => Boolean(node.getClientRects().length) && getComputedStyle(node).visibility !== 'hidden';
    const body = document.body?.innerText ?? '';
    const skipButtons = [...document.querySelectorAll('button')].filter(node =>
      visible(node) && node.innerText.trim() === 'Start without an agent');
    let skipAgent = null;
    if (skipButtons.length === 1 && route.pathname.startsWith('/welcome')) {
      const box = skipButtons[0].getBoundingClientRect();
      skipAgent = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    const editor = [...document.querySelectorAll('[contenteditable=true],textarea')].find(candidate =>
      visible(candidate) && (candidate.isContentEditable ||
      (candidate.tagName === 'TEXTAREA' && !candidate.disabled && !candidate.readOnly)) &&
      ((candidate.value ?? candidate.innerText).trimEnd() === ${JSON.stringify(expected)}));
    return { packaged: location.protocol === 't3code:' && location.host === 'app', root: route.pathname === '/',
      draftRoute: route.pathname.startsWith('/draft/'), observedRoute: route.pathname,
      matchesThread, hasRetainedPromptQuery: route.searchParams.has('prompt'), title: document.title,
      visibleHeading: body.includes('New thread'), hasText: Boolean(body.trim()), visiblePanels: body.trim().length > 25,
      logoOnly: body.trim().length <= 25 && !editor, editableExact: Boolean(editor),
      observedEditorValue: editor ? (editor.value ?? editor.innerText).trimEnd() : null,
      sawLinkNotice: body.includes('Prompt added from a link'), skipAgent };
  })()` });
  return request.result?.value ?? {};
}

async function observeRenderer(environmentId, threadId, draft, predicate, deadlineMs = 20000) {
  const deadline = Date.now() + deadlineMs;
  let latest = {};
  while (Date.now() < deadline) {
    try { latest = await state(environmentId, threadId, draft); } catch (error) {
      latest = { observerError: error.name };
    }
    if (predicate(latest)) return latest;
    await wait(600);
  }
  return latest;
}

async function saveFrame(label) {
  const image = await renderer.ask('Page.captureScreenshot', { format: 'png' }).catch(() => ({}));
  if (image.data) writeFileSync(join(evidence, label + '-renderer.png'), Buffer.from(image.data, 'base64'));
  try {
    const window = JSON.parse(run(observer, ['window', String(appPid)]));
    assert.ok(Number.isInteger(window.windowId) && window.windowId > 0);
    run('/usr/sbin/screencapture', ['-x', '-l', String(window.windowId), join(evidence, label + '-window.png')]);
    return { ownedWindowId: window.windowId, windowTitle: window.title, rendererFrame: Boolean(image.data) };
  } catch (error) {
    return { windowCaptureError: error.code ?? error.name, rendererFrame: Boolean(image.data) };
  }
}

try {
  checkpoint('disposable profile and provider binary preflight');
  assert.equal(realpathSync(process.env.HOME), '/Users/runner');
  assert.ok(!existsSync(join(process.env.HOME, 'Library', 'Application Support', 't3code-v2')));
  const providerNames = ['codex', 'claude', 'agent', 'cursor-agent', 'opencode', 'gemini', 'pi', 'kiro-cli'];
  const providerPaths = [...process.env.PATH.split(':'), '/opt/homebrew/bin', '/usr/local/bin'];
  assert.ok(providerNames.every(name => providerPaths.every(dir => !existsSync(join(dir, name)))),
    'A model CLI is present on the fresh runner paths');
  proof.modelCliPresent = false;
  checkpoint('initialize disposable Git repository');
  run(process.env.T3_QA_GIT, ['init', '-q', '-b', 'main'], fixture);
  run(process.env.T3_QA_GIT, ['-c', 'user.name=T3 QA', '-c', 'user.email=qa@example.invalid', 'commit', '--allow-empty', '-qm', 'Disposable T3 fixture'], fixture);

  checkpoint('official CLI bootstraps an idle thread in the scratch Git repository');
  const cliLog = openSync(join(scratch, 'private-cli.log'), 'wx', 0o600);
  cliProcess = spawn(cli, [
    '--mode', 'web', '--host', '127.0.0.1', '--port', '43981', '--no-browser',
    '--base-dir', process.env.T3CODE_HOME, '--auto-bootstrap-project-from-cwd', fixture,
  ], { env: process.env, cwd: fixture, stdio: ['ignore', cliLog, cliLog] });
  closeSync(cliLog);
  const cliExit = new Promise((resolve, reject) => {
    cliProcess.once('error', reject);
    cliProcess.once('exit', (code, signal) => resolve({ code, signal }));
  });
  cliExit.catch(() => {});
  let environmentId;
  for (let attempt = 0; attempt < 90 && cliProcess.exitCode === null; attempt++) {
    if (existsSync(identity) && existsSync(database)) try {
      environmentId = readFileSync(identity, 'utf8').trim();
      const projection = queryProjection();
      proof.seedThreadCount = projection.rows.length;
      proof.seedProjectCount = projection.projects.length;
      if (projection.rows.length > 0 && projection.projects.length > 0) {
        seed = projection;
        break;
      }
    } catch (error) {
      proof.seedObservation = error.code ?? error.name;
    }
    await wait(500);
  }
  assert.ok(seed, 'The official CLI did not populate an idle thread');
  assert.deepEqual(seed.counts, expectedCounts);
  assert.equal(seed.rows[0].title, 'New thread');
  assert.equal(seed.projects.length, 1);
  assert.equal(realpathSync(seed.projects[0].workspace_root), realpathSync(fixture));
  const threadId = seed.rows[0].thread_id;
  assert.ok([environmentId, threadId].every(id => typeof id === 'string' && /^[A-Za-z0-9_:%.-]+$/u.test(id)));
  proof.seed = { environmentId, threadId, counts: seed.counts, projectIsDisposableGit: true };
  cliProcess.kill('SIGTERM');
  proof.cliStopped = await Promise.race([cliExit, wait(8000).then(() => null)]);
  assert.ok(proof.cliStopped);

  checkpoint('start the signed app bundle executable with the normal isolated runner OS profile');
  const outFd = openSync(appLogPaths[0], 'wx', 0o600);
  const errFd = openSync(appLogPaths[1], 'wx', 0o600);
  const desktop = spawn(desktopBinary, [
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=' + debugPort,
  ], { env: process.env, cwd: fixture, stdio: ['ignore', outFd, errFd] });
  closeSync(outFd);
  closeSync(errFd);
  desktop.once('error', error => { proof.desktopSpawnError = error.code ?? error.name; });
  appPid = desktop.pid;
  assert.ok(appPid > 0, 'The signed desktop failed to start');
  for (let attempt = 0; attempt < 30; attempt++) {
    const identified = run(observer, ['running', bundle]);
    if (Number(identified) === appPid) break;
    await wait(450);
  }
  proof.runningBundle = runningBundle();
  assert.equal(proof.runningBundle, bundle);
  proof.firstLaunchViaBundleExecutable = true;

  const escapedSegments = [environmentId, threadId].map(id =>
    encodeURIComponent(id).replace(/[.!~*'()]/gu,
      character => '%' + character.charCodeAt(0).toString(16).toUpperCase()));
  const threadPath = '/' + escapedSegments.join('/');
  checkpoint('prepare exact published release links');
  const options = { environment: environmentId, session: threadId };
  const blank = getAgentLink('t3-code', 'desktop', options);
  const draft = getAgentLink('t3-code', 'desktop', {
    session: 'https://app.t3.codes/threads' + threadPath, prompt: marker,
  });
  assert.equal(blank, 't3code://threads' + threadPath);
  assert.equal(draft, blank + '?prompt=' + encodeURIComponent(marker));
  assert.equal(realpathSync(run(observer, ['resolve', blank])), bundle);
  proof.nativeScope = { pid: appPid, blank, draft, marker };

  checkpoint('attach only to same stock app loopback renderer');
  renderer = await attachRenderer();
  await renderer.ask('Runtime.enable');
  await renderer.ask('Network.enable');
  proof.startupRenderer = await observeRenderer(environmentId, threadId, '',
    observed => observed.visiblePanels || observed.skipAgent, 40000);
  proof.startupFrame = await saveFrame('01-ordinary-startup');
  const offTarget = observed => observed.packaged && observed.visiblePanels && !observed.matchesThread && observed.editableExact;
  let ready = proof.startupRenderer;
  if (!offTarget(ready) && !ready.skipAgent) {
    checkpoint('bootstrap only the packaged root, off the target route');
    const navigation = await renderer.ask('Page.navigate', { url: bundledRoot });
    proof.bundledRootBootstrap = { used: true, error: navigation.errorText ?? null };
    ready = await observeRenderer(environmentId, threadId, '', observed =>
      observed.skipAgent || offTarget(observed), 22000);
  }
  if (ready.skipAgent) {
    const { x, y } = ready.skipAgent;
    await renderer.ask('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await renderer.ask('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    proof.startedWithoutAgent = true;
    ready = await observeRenderer(environmentId, threadId, '', offTarget);
  }
  proof.offTarget = ready;
  proof.offTargetFrame = await saveFrame('02-off-target');
  assert.ok(offTarget(ready), 'The packaged renderer did not reach a visible editable composer outside the target thread');

  checkpoint('stock LaunchServices exact existing thread without draft');
  stockDispatch(blank);
  proof.stockBlankDispatchAccepted = true;
  proof.blank = await observeRenderer(environmentId, threadId, '', observed =>
    observed.matchesThread && !observed.hasRetainedPromptQuery && observed.editableExact);
  proof.blankFrame = await saveFrame('03-existing-thread-blank');
  assert.ok(proof.blank.matchesThread && !proof.blank.hasRetainedPromptQuery && proof.blank.editableExact,
    'The exact existing thread and empty composer did not appear');

  checkpoint('return to an untouched off-target draft and close the warm signed process');
  await renderer.ask('Page.navigate', { url: bundledRoot });
  proof.beforeColdOffTarget = await observeRenderer(environmentId, threadId, '', offTarget, 30000);
  assert.ok(offTarget(proof.beforeColdOffTarget), 'Expected off-target blank composer before cold launch');
  await closeWarmApp();
  assert.deepEqual(queryProjection(), seed);

  checkpoint('stock LaunchServices cold dispatch of the exact existing thread with unique draft');
  await coldDispatch(draft);
  renderer = await attachRenderer();
  await renderer.ask('Runtime.enable');
  proof.draft = await observeRenderer(environmentId, threadId, marker, observed =>
    observed.matchesThread && !observed.hasRetainedPromptQuery && observed.editableExact, 55000);
  proof.draftFrame = await saveFrame('04-cold-existing-thread-draft');
  assert.ok(proof.draft.matchesThread && !proof.draft.hasRetainedPromptQuery && proof.draft.editableExact,
    'The exact existing thread and editable draft did not appear');
  assert.equal(proof.draft.observedEditorValue, marker);
  proof.result = 'cold-native-existing-thread-draft-visible';
} catch (error) {
  proof.result = 'failed';
  proof.failedAt = phase;
  proof.error = (error.message || error.name).split('\n')[0].replaceAll(scratch, '<scratch>').slice(0, 240);
  proof.beforeOrAtFailure = {
    stateDatabase: existsSync(database),
    persistedEnvironment: existsSync(identity),
    appPid: appPid ?? null,
    logs: sanitizedBackendSignals(),
  };
  process.exitCode = 1;
} finally {
  try {
    proof.rendererBoot = rendererDiagnostics();
  } catch (error) {
    proof.rendererDiagnosticFailure = error.code ?? error.name;
  }
  if (proof.seed) {
    try {
      const final = queryProjection();
      assert.deepEqual(final, seed);
      proof.zeroProviderAudit = final.counts;
      writeFileSync(join(evidence, 'zero-provider-audit.json'), JSON.stringify(final.counts, null, 2) + '\n');
    } catch (error) {
      proof.auditFailure = error.code ?? error.name;
      process.exitCode = 1;
    }
  }
  writeFileSync(join(evidence, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof));
  renderer?.close();
  if (appPid) {
    try {
      if (runningBundle() === bundle) process.kill(appPid, 'SIGTERM');
    } catch {}
  }
  if (cliProcess?.exitCode === null && cliProcess.signalCode === null) cliProcess.kill('SIGKILL');
}
