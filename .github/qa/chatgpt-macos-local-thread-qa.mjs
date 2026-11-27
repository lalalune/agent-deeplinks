import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as wait } from 'node:timers/promises';
import { getAgentLink } from 'agent-deeplinks';

const scratch = realpathSync(process.argv[2]);
const bundle = realpathSync(process.argv[3]);
const cli = realpathSync(process.argv[4]);
const evidence = join(scratch, 'evidence');
const observer = join(scratch, 'observe');
const home = join(scratch, 'home');
const codexHome = join(home, '.codex');
const work = join(scratch, 'fixture');
const profile = join(scratch, 'electron-profile');
const title = 'Agent Deeplinks QA Local Thread 9F17';
for (const directory of [home, codexHome, work, profile]) mkdirSync(directory, { mode: 0o700 });
assert.equal(process.env.GITHUB_ACTIONS, 'true');
const providerRequests = [];
const proof = { packageVersion: "0.1.47", accountUsed: false, taskCreateClicked: false, taskSaved: false, title, bundle, providerRequests, milestones: [] };
const workflowSummary = process.env.GITHUB_STEP_SUMMARY;
let phase = 'prepare disposable home and bundled app-server';

function save() {
  writeFileSync(join(evidence, 'proof.json'), JSON.stringify({ ...proof, lastStage: phase }, null, 2) + '\n');
}

function checkpoint(message) {
  phase = message;
  save();
  console.log('ChatGPT macOS fixture: ' + phase);
}

function witnessed(stage, details = {}) {
  const record = { stage, ...details };
  proof.milestones.push(record);
  save();
  const message = JSON.stringify(record);
  console.log('::notice title=ChatGPT Mac QA::' + message.replaceAll('%', '%25'));
  if (workflowSummary) {
    try {
      appendFileSync(workflowSummary, '- `' + message.replaceAll('`', '') + '`\n');
    } catch (error) {
      proof.summaryWriteError = error.code ?? error.name;
    }
  }
}

function windowState(screen) {
  if (!screen) return null;
  return {
    pid: screen.pid,
    windowId: screen.windowId,
    lines: screen.recognizedLines,
    workPreferencePage: screen.archivedPreferenceMatch,
    taskOfferPage: screen.archivedTaskOfferMatch,
    skipConfirmation: screen.archivedSkipConfirmationMatch,
    skipVisible: Boolean(screen.controls.skip),
    accountGateLabels: screen.accountGateLabels,
    baseline: screen.baseline,
    codexCaptionOCR: screen.codexModeVisible,
    codexSidebarArchiveMatch: screen.codexSidebarArchiveMatch,
    codexHomeArchiveMatch: screen.codexHomeArchiveMatch,
    workspaceNavigationVisible: screen.workspaceNavigationVisible,
    upperMainTitle: screen.upperMainTitle,
    targetTitleAnywhere: screen.targetTitleAnywhere,
    sidebarTargetTitle: screen.sidebarTargetTitle,
  };
}

function run(file, args, timeout = 6500) {
  return execFileSync(file, args, { encoding: 'utf8', cwd: work, timeout, killSignal: 'SIGKILL' }).trim();
}

function appServer() {
  const program = spawn(cli, ['app-server', '--listen', 'stdio://'], { cwd: work,
    env: { HOME: home, CODEX_HOME: codexHome, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'en_US.UTF-8' },
    stdio: ['pipe', 'pipe', 'ignore'] });
  const lines = createInterface({ input: program.stdout });
  let next = 0;
  const pending = new Map();
  lines.on('line', line => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const done = pending.get(message.id);
    if (!done) return;
    pending.delete(message.id);
    clearTimeout(done.timer);
    if (message.error) done.reject(new Error('Bundled app-server RPC rejected: ' + done.method));
    else done.resolve(message.result);
  });
  return {
    request(method, params) {
      const id = ++next;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('Bundled app-server RPC deadline: ' + method));
        }, 6500);
        pending.set(id, { timer, resolve, reject, method });
        program.stdin.write(JSON.stringify({ id, method, params }) + '\n');
      });
    },
    notify(method) { program.stdin.write(JSON.stringify({ method }) + '\n'); },
    async close() {
      const exited = new Promise(resolve => program.once('exit', resolve));
      program.stdin.end();
      await Promise.race([exited, wait(1600)]);
      if (program.exitCode === null) program.kill('SIGTERM');
      lines.close();
    },
  };
}

async function withServer(action) {
  const client = appServer();
  try {
    await client.request('initialize', { clientInfo: { name: 'agent_deeplinks_qa', title: 'Agent Deeplinks QA', version: '0.1.37' } });
    client.notify('initialized');
    return await action(client);
  } finally {
    await client.close();
  }
}

const provider = createServer((request, response) => {
  const metadataRead = request.method === 'GET' && request.url === '/v1/models';
  providerRequests.push({ method: request.method, route: metadataRead ? '/v1/models' : 'other' });
  response.writeHead(metadataRead ? 200 : 405, { 'content-type': 'application/json' });
  response.end(JSON.stringify(metadataRead ? { object: 'list', data: [{ id: 'gpt-6-sol', object: 'model' }] } :
    { error: { message: 'QA fixture is metadata only' } }));
});
await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
writeFileSync(join(codexHome, 'config.toml'), `model = "gpt-6-sol"
model_provider = "qa-local"
web_search = "disabled"
approval_policy = "never"
sandbox_mode = "read-only"
[model_providers.qa-local]
name = "QA loopback metadata only"
base_url = "http://127.0.0.1:${provider.address().port}/v1"
wire_api = "responses"
requires_openai_auth = false
`, { mode: 0o600 });

let signedPid;
let audit;
const candidate = join(scratch, 'candidate-window.png');
const knownWorkPage = join(scratch, 'known-work-preference.png');
const knownTaskOffer = join(scratch, 'known-task-offer.png');
const knownSkipConfirmation = join(scratch, 'known-skip-confirmation.png');
const knownCodexBaseline = join(scratch, 'known-codex-baseline.png');

function observeOwnedWindow(args, timeout) {
  try {
    return run(observer, args, timeout);
  } catch (error) {
    if (error.code !== 'ETIMEDOUT') throw error;
    proof.captureStatus = 'temporary observer timeout: ' + args[0];
    proof.observerTimeouts = (proof.observerTimeouts ?? 0) + 1;
    return null;
  }
}

function snapshot() {
  const pid = observeOwnedWindow(['running', bundle], 6000);
  if (!pid || !/^[1-9][0-9]*$/u.test(pid)) return null;
  if (signedPid) assert.equal(Number(pid), signedPid, 'The stock app PID changed during the test');
  signedPid = Number(pid);
  const lookup = observeOwnedWindow(['window', pid], 6000);
  if (!lookup) return null;
  const window = JSON.parse(lookup);
  if (existsSync(candidate)) unlinkSync(candidate);
  try {
    run('/usr/sbin/screencapture', ['-x', '-l', String(window.windowId), candidate], 9500);
  } catch (error) {
    proof.captureStatus = error.code ?? error.name;
    return null;
  }
  const recognized = observeOwnedWindow(['screen', candidate, title, String(window.width), String(window.height),
    knownWorkPage, knownTaskOffer, knownSkipConfirmation, knownCodexBaseline], 13000);
  if (!recognized) return null;
  const screen = JSON.parse(recognized);
  if (screen.uncertainWindowPixels) proof.captureStatus = 'uncertain window geometry';
  else proof.captureStatus = 'captured owned window';
  return { ...window, ...screen, pid: signedPid };
}

async function screenUntil(accept, deadline, retainAfterSkip = false) {
  do {
    const screen = snapshot();
    if (screen?.recognizedLines) {
      proof.window = screen;
      copyFileSync(candidate, join(evidence, 'last-owned-window.png'));
      if (retainAfterSkip && !proof.firstWindowAfterSkip) {
        proof.firstWindowAfterSkip = windowState(screen);
        copyFileSync(candidate, join(evidence, 'first-window-after-skip.png'));
        witnessed('first owned window after Skip', proof.firstWindowAfterSkip);
      }
      if (screen.accountGate) {
        copyFileSync(candidate, join(evidence, 'visible-account-gate.png'));
        proof.accountGateLabels = screen.accountGateLabels;
        throw new Error('Visible account or access gate: ' + screen.accountGateLabels.join(', '));
      }
      if (accept(screen)) return screen;
    }
    await wait(450);
  } while (Date.now() < deadline);
  return null;
}

function clickExact(screen, caption) {
  const control = screen.controls[caption];
  assert.ok(control, 'Expected one visible owned control: ' + caption);
  const args = ['click', String(signedPid), bundle, String(screen.windowId), String(control.x), String(control.y)];
  if (caption === 'skip' || caption === 'go to chatgpt') args.push('move-first');
  const response = run(observer, args);
  assert.equal(response, 'posted', response === 'event-access-required' ?
    'The hosted runner requires macOS input permission; no permission was requested' :
    'The owned signed window could not safely receive the stock UI action: ' + response);
  (proof.uiActions ??= []).push(caption);
  save();
}

try {
  run('/usr/bin/git', ['init', '-q', '-b', 'main']);
  proof.cliVersion = run(cli, ['--version']);
  checkpoint('seed and reread one local thread with no turn');
  const id = await withServer(async client => {
    const created = await client.request('thread/start', { model: 'gpt-6-sol', cwd: work, approvalPolicy: 'never', sandbox: 'read-only' });
    assert.match(created.thread.id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu);
    await client.request('thread/name/set', { threadId: created.thread.id, name: title });
    return created.thread.id;
  });
  audit = () => withServer(async client => {
    const { thread } = await client.request('thread/read', { threadId: id, includeTurns: true });
    const state = { id: thread.id, name: thread.name, cwd: thread.cwd, provider: thread.modelProvider, turns: thread.turns.length };
    assert.deepEqual(state, { id, name: title, cwd: work, provider: 'qa-local', turns: 0 });
    return state;
  });
  proof.seed = await audit();
  witnessed('disposable local thread verified', { turns: proof.seed.turns });
  const uri = getAgentLink('codex', 'desktop', { action: 'settings' });
  assert.equal(uri, 'codex://settings');
  checkpoint('launch the signed desktop with the disposable local profile');
  assert.equal(run(observer, ['resolve', uri]), bundle);
  assert.equal(run(observer, ['running', bundle]), '');
  const environment = { HOME: home, CFFIXED_USER_HOME: home, CODEX_HOME: codexHome,
    OPENAI_API_KEY: '', CHATGPT_API_KEY: '', CODEX_API_KEY: '', CODEX_ACCESS_TOKEN: '' };
  const env = Object.entries(environment).flatMap(([name, value]) => ['--env', name + '=' + value]);
  run('/usr/bin/open', ['-a', bundle, ...env, '--args', '--user-data-dir=' + profile]);
  proof.stockAppLaunch = true;

  checkpoint('observe the known first-run work preference');
  const first = await screenUntil(screen => screen.archivedPreferenceMatch && screen.engineeringSelection === 'unchecked', Date.now() + 44000);
  assert.ok(first, 'The known first-run work question was not visible');
  copyFileSync(candidate, join(evidence, 'first-run-before.png'));
  witnessed('archived Work preferences visible', windowState(first));
  assert.notEqual(first.suggestions, 'uncertain', 'Unable to read the visible personalization checkbox safely');
  assert.ok(['checked', 'unchecked'].includes(first.suggestions));
  checkpoint('choose the Engineering preference in the disposable profile');
  clickExact(first, 'engineering');
  await wait(600);
  const selected = await screenUntil(screen => screen.archivedPreferenceMatch && screen.engineeringSelection === 'checked', Date.now() + 14000);
  assert.ok(selected, 'The engineering selection did not visibly change');
  copyFileSync(candidate, join(evidence, 'first-run-engineering-selected.png'));
  assert.ok(['checked', 'unchecked'].includes(selected.suggestions));
  checkpoint('turn off personalized suggestions and verify the visible checkbox');
  if (selected.suggestions === 'checked') clickExact(selected, 'suggest personalized tasks');
  const updated = await screenUntil(screen => screen.archivedPreferenceMatch && screen.engineeringSelection === 'checked' &&
    screen.suggestions === 'unchecked', Date.now() + 14000);
  assert.ok(updated, 'The personalized suggestions opt-in did not visibly turn off');
  proof.personalizedSuggestions = false;
  copyFileSync(candidate, join(evidence, 'first-run-suggestions-off.png'));
  witnessed('Engineering selected and personalized suggestions off');
  checkpoint('continue first-run and locate the archived optional task offer');
  clickExact(updated, 'continue');
  const taskOffer = await screenUntil(next => next.archivedTaskOfferMatch && !next.archivedPreferenceMatch, Date.now() + 25000);
  assert.ok(taskOffer, 'The archived optional task screen and unique Skip were not visible');
  copyFileSync(candidate, join(evidence, 'first-run-known-task-offer.png'));
  witnessed('archived optional task screen and unique Skip visible', windowState(taskOffer));
  checkpoint('skip the known task offer and identify the stock confirmation');
  clickExact(taskOffer, 'skip');
  witnessed('stock pointer click posted to the unique Skip');
  const confirmation = await screenUntil(next => next.archivedSkipConfirmationMatch, Date.now() + 24000, true);
  assert.ok(confirmation, 'The archived Skip setup dialog and unique Go to ChatGPT were not visible');
  copyFileSync(candidate, join(evidence, 'skip-setup-confirmation.png'));
  witnessed('stock Skip setup dialog and unique Go to ChatGPT visible', windowState(confirmation));
  checkpoint('confirm the optional Skip setup and wait for the account-free local Codex workspace');
  clickExact(confirmation, 'go to chatgpt');
  witnessed('stock pointer click posted to the unique Go to ChatGPT');
  const baseline = await screenUntil(next => !next.archivedPreferenceMatch && !next.archivedTaskOfferMatch &&
    !next.archivedSkipConfirmationMatch && next.baseline && !next.targetTitleAnywhere && next.title !== title, Date.now() + 40000);
  assert.ok(baseline, 'The first-run flow did not reach the archived account-free local Codex workspace');
  copyFileSync(candidate, join(evidence, 'local-baseline-before-dispatch.png'));
  witnessed('account-free local Codex baseline visible', windowState(baseline));

  proof.destinations = [];
  const cases = [
    { label: "settings", target: "", anchors: /^General$/iu },
    { label: "browser-use", target: "browser-use", anchors: /Browsing data|Browser permissions|Clear.*history|^Browser$/iu },
    { label: "google-chrome", target: "computer-use/google-chrome", anchors: /Google Chrome|Chrome extension/iu },
    { label: "connections", target: "connections", anchors: /^Connections$/iu },
    { label: "connection-computer", target: "connections/computer", anchors: /Control this|Set up this|This computer/iu },
    { label: "connection-devices", target: "connections/devices", anchors: /Control other|Other devices|Device list/iu },
    { label: "connection-ssh", target: "connections/ssh", anchors: /SSH connections from this|Connect to.*SSH/iu },
  ];
  for (const route of cases) {
    checkpoint('warm stock LaunchServices ' + route.label);
    const options = { action: 'settings', ...(route.target && { target: route.target }) };
    const native = getAgentLink('codex', 'desktop', options);
    const expected = uri + (route.target ? '/' + route.target : '');
    assert.equal(getAgentLink('chatgpt', 'desktop', options), expected);
    assert.equal(native, expected);
    assert.equal(run(observer, ['resolve', native]), bundle);
    assert.equal(run(observer, ['running', bundle]), String(signedPid));
    const item = { uri: native, exactStockDispatch: false };
    proof.destinations.push(item);
    run('/usr/bin/open', [native]);
    item.exactStockDispatch = true;
    await wait(3300);
    const matchesRoute = next => next.navigationText?.some(row => row.left >= 0.31 && route.anchors.test(row.text));
    const reached = await screenUntil(matchesRoute, Date.now() + 11500);
    const captured = reached ?? proof.window;
    item.visibleRouteAnchor = Boolean(reached);
    item.owner = captured ? { pid: captured.pid, windowId: captured.windowId, title: captured.title } : null;
    item.ocr = captured?.navigationText ?? [];
    if (existsSync(candidate) && captured) {
      item.screenshot = route.label + '.png';
      copyFileSync(candidate, join(evidence, item.screenshot));
    }
    witnessed('stock dispatch observed', { uri: native, visibleRouteAnchor: item.visibleRouteAnchor,
      title: item.owner?.title, texts: item.ocr.filter(row => row.left >= 0.31).map(row => row.text).slice(0, 35) });
  }
  assert.ok(proof.destinations.every(item => item.exactStockDispatch));
  proof.result = 'dispatch and observation completed';
} catch (error) {
  proof.result = 'failed';
  proof.error = String(error.message).split('\n')[0].replaceAll(scratch, '<scratch>').slice(0, 240);
  process.exitCode = 1;
} finally {
  try {
    if (audit) proof.final = await audit();
    assert.equal(providerRequests.length, 0, 'The isolated provider received requests');
  } catch (error) {
    proof.providerAuditError = error.message;
    proof.result = 'failed';
    process.exitCode = 1;
  }
  witnessed('terminal result and no-send audit', {
    result: proof.result,
    lastStage: phase,
    error: proof.error,
    observerTimeouts: proof.observerTimeouts ?? 0,
    providerRequests: providerRequests.length,
    finalTurns: proof.final?.turns,
    window: windowState(proof.window),
  });
  save();
  console.log(JSON.stringify(proof));
  provider.closeAllConnections();
  provider.close();
  if (signedPid) {
    try {
      if (run(observer, ['running', bundle]) === String(signedPid)) process.kill(signedPid, 'SIGTERM');
    } catch {}
  }
}
