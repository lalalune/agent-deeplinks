import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as wait } from 'node:timers/promises';
import { getAgentLink } from 'agent-deeplinks';
import { _electron } from 'playwright-core';

const scratch = realpathSync(process.argv[2]);
const evidence = join(scratch, 'evidence');
const fixture = join(scratch, 'fixture');
const cli = realpathSync(process.env.T3_QA_CLI);
const desktopBinary = realpathSync(process.env.T3_QA_BINARY);
const database = join(process.env.T3CODE_HOME, 'userdata', 'statev2.sqlite');
const identity = join(process.env.T3CODE_HOME, 'userdata', 'environment-id');
const origin = 'http://127.0.0.1:43981';
const marker = 'T3 Windows 0.1.13 warm saved thread + & literal %2F café 🧪';
const coldMarker = 'T3 Windows 0.1.13 cold saved thread + & literal %2F café 🧪';
const proof = { release: 'agent-deeplinks@0.1.66', t3: '0.1.13 win32 x64', desktopBinary, accountUsed: false };
const expectedCounts = { threads: 1, runs: 0, provider_sessions: 0, provider_turns: 0 };
let phase = 'outbound firewall and Git fixture';
let cliServer;
let serverExit;
let app;
let page;

function run(file, args, cwd = scratch) {
  return execFileSync(file, args, { encoding: 'utf8', timeout: 8000, cwd }).trim();
}

function queryProjection() {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    const tablePrefix = 'orchestration_v2_projection_';
    const counts = Object.fromEntries(Object.keys(expectedCounts).map(name => [
      name, db.prepare('SELECT count(*) AS n FROM ' + tablePrefix + name).get().n,
    ]));
    const rows = db.prepare('SELECT thread_id, title FROM ' + tablePrefix + 'threads').all();
    return { counts, rows };
  } finally {
    db.close();
  }
}

async function stopServer() {
  if (!cliServer) return;
  if (cliServer.exitCode === null && cliServer.signalCode === null) cliServer.kill('SIGTERM');
  let exit = await Promise.race([serverExit, wait(5200).then(() => null)]);
  if (!exit) {
    cliServer.kill('SIGKILL');
    exit = await Promise.race([serverExit, wait(2500).then(() => null)]);
  }
  assert.ok(exit, 'Scratch stock CLI did not stop');
  cliServer = undefined;
  return exit;
}

async function captureNative(label) {
  await page.screenshot({ path: join(evidence, label + '.png'), timeout: 8000 });
}

async function observeComposer(environmentId, threadId, expected) {
  const state = await page.waitForFunction(({ environmentId, threadId, expected }) => {
    const active = new URL(location.hash.slice(1), 'https://app.invalid/');
    const ids = active.pathname.split('/').slice(1).map(decodeURIComponent);
    if (ids.length !== 2 || ids[0] !== environmentId || ids[1] !== threadId ||
      active.searchParams.has('prompt')) return false;
    const editors = [...document.querySelectorAll('[contenteditable=true], textarea')];
    const editor = editors.find(candidate => {
      const value = candidate.value ?? candidate.innerText;
      return candidate.getClientRects().length && (candidate.isContentEditable ||
        (candidate.tagName === 'TEXTAREA' && !candidate.disabled && !candidate.readOnly)) &&
        (expected ? value === expected : value?.trim() === '');
    });
    if (!editor) return false;
    return { path: active.pathname, value: (editor.value ?? editor.innerText).replace(/^\s+$/u, ''),
      editable: true, title: document.title, retainedPromptInURL: active.searchParams.has('prompt') };
  }, { environmentId, threadId, expected }, { timeout: 24000 });
  return state.jsonValue();
}

function powerShell(script, extraEnv = {}) {
  return execFileSync(process.env.T3_QA_SHELL, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    { cwd: scratch, env: { ...process.env, ...extraEnv }, windowsHide: true, timeout: 14000, encoding: 'utf8' }).trim();
}

function stockHandler() {
  const registration = powerShell(String.raw`
    $key = 'Registry::HKEY_CLASSES_ROOT\t3code\shell\open\command'
    if (Test-Path -LiteralPath $key) { (Get-Item -LiteralPath $key).GetValue('') }
  `);
  assert.ok(registration.toLowerCase().includes(desktopBinary.toLowerCase()) && registration.includes('"%1"'),
    'The stock registration did not target the signed binary and placeholder');
  return registration;
}

function dispatch(uri) {
  const observed = JSON.parse(powerShell(String.raw`
    $ErrorActionPreference = 'Stop'
    $proc = Start-Process -FilePath $env:T3_QA_URI -PassThru
    if (!$proc) { throw 'Shell did not report a process' }
    $child = Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue
    $expected = '"' + $env:T3_QA_URI + '"'
    $sameBinary = $child -and $child.ExecutablePath -ieq $env:T3_QA_BINARY
    $verified = $sameBinary -and $child.CommandLine.EndsWith(' ' + $expected, [StringComparison]::Ordinal)
    [ordered]@{ pid = $proc.Id; shellInput = $env:T3_QA_URI; capturedExactChildArgument = [bool]$verified } |
      ConvertTo-Json -Compress
  `, { T3_QA_URI: uri }));
  assert.equal(observed.shellInput, uri);
  return observed;
}

try {
  const containment = JSON.parse(readFileSync(join(evidence, 'installer-and-egress.json'), 'utf8'));
  assert.equal(containment.egress.scopedOutboundBlockCount, 2);
  assert.equal(containment.egress.activeFirewallEnabled, true);
  proof.nonLoopbackEgressBlocked = true;
  run('git', ['init', '-q', '-b', 'main'], fixture);
  run('git', ['-c', 'user.name=T3 QA', '-c', 'user.email=qa@example.invalid', 'commit', '--allow-empty', '-qm', 'Disposable T3 fixture'], fixture);

  phase = 'official loopback CLI bootstraps one idle thread';
  const log = openSync(join(scratch, 'private-server.log'), 'wx', 0o600);
  cliServer = spawn(cli, [
    '--mode', 'web', '--host', '127.0.0.1', '--port', '43981', '--no-browser',
    '--base-dir', process.env.T3CODE_HOME, '--auto-bootstrap-project-from-cwd', fixture,
  ], {
    cwd: fixture, env: { ...process.env, TERM: 'dumb', NO_COLOR: '1' },
    stdio: ['ignore', log, log],
  });
  serverExit = new Promise(resolve => cliServer.once('exit', (code, signal) => resolve({ code, signal })));
  closeSync(log);
  let seed;
  let environmentId;
  for (let attempt = 0; attempt < 65 && cliServer.exitCode === null; attempt++) {
    try {
      const reply = await fetch(origin + '/health', { signal: AbortSignal.timeout(800) });
      proof.seedHttp = reply.status;
      await reply.body?.cancel();
      if (reply.ok && existsSync(identity) && existsSync(database)) {
        environmentId = readFileSync(identity, 'utf8').trim();
        const projection = queryProjection();
        proof.seedThreadCount = projection.counts.threads;
        if (projection.rows.length > 0) { seed = projection; break; }
      }
    } catch (error) {
      // Keep only fixed diagnostic metadata, without logs or request/auth contents.
      if (existsSync(database)) proof.seedObservationError = error.code ?? error.name;
    }
    await wait(580);
  }
  proof.seedDatabaseExists = existsSync(database);
  proof.seedIdentityExists = existsSync(identity);
  proof.seedProcessExit = cliServer.exitCode;
  assert.ok(seed, 'The stock server did not populate the idle thread');
  assert.deepEqual(seed.counts, expectedCounts);
  assert.equal(seed.rows[0].title, 'New thread');
  const threadId = seed.rows[0].thread_id;
  assert.ok([environmentId, threadId].every(id => typeof id === 'string' && /^[A-Za-z0-9_:%.-]+$/u.test(id)));
  proof.seed = { environmentId, threadId, counts: seed.counts };
  proof.cliExit = await stopServer();

  phase = 'launch stock desktop and complete no-agent startup';
  app = await _electron.launch({ executablePath: desktopBinary, args: ['--disable-gpu'], env: process.env, timeout: 35000 });
  page = await app.firstWindow({ timeout: 20000 });
  await page.waitForFunction(() => location.hostname === 'app' && document.body?.innerText?.trim(), undefined, { timeout: 22000 });
  const skip = page.getByRole('button', { name: 'Start without an agent', exact: true });
  if (await skip.waitFor({ timeout: 8000 }).then(() => true, () => false)) {
    await skip.click({ timeout: 5000 });
    await page.waitForFunction(() => !location.hash.startsWith('#/welcome'), undefined, { timeout: 16000 });
    proof.startedWithoutAgent = true;
  }
  const escapedSegments = [environmentId, threadId].map(id =>
    encodeURIComponent(id).replace(/[.!~*'()]/gu,
      character => '%' + character.charCodeAt(0).toString(16).toUpperCase()));
  const threadPath = '/' + escapedSegments.join('/');
  await page.goto('t3code://app/#/', { waitUntil: 'domcontentloaded', timeout: 13000 });
  assert.equal(new URL(page.url()).hash, '#/', 'The test must begin off the target thread');
  assert.deepEqual(queryProjection(), seed);
  proof.association = stockHandler();
  proof.nativeStartupOffTarget = true;

  phase = 'stock Windows Shell dispatch of the exact existing thread without draft';
  const options = { environment: environmentId, session: threadId };
  const blank = getAgentLink('t3-code', 'desktop', options);
  const withPrompt = getAgentLink('t3-code', 'desktop', { ...options, prompt: marker });
  const copiedThreadUrl = 'https://app.t3.codes/threads' + threadPath;
  assert.equal(blank, 't3code://threads' + threadPath);
  assert.equal(withPrompt, blank + '?prompt=' + encodeURIComponent(marker));
  proof.blankDispatch = dispatch(blank);
  assert.equal(proof.blankDispatch.capturedExactChildArgument, true);
  proof.blank = { uri: blank, ...await observeComposer(environmentId, threadId, '') };
  assert.equal(proof.blank.value, '');
  await captureNative('01-native-existing-thread-blank');

  phase = 'stock Windows Shell dispatch of the exact existing thread with unsent draft';
  proof.draftDispatch = dispatch(withPrompt);
  assert.equal(proof.draftDispatch.capturedExactChildArgument, true);
  proof.draft = { uri: withPrompt, ...await observeComposer(environmentId, threadId, marker) };
  assert.equal(proof.draft.value, marker);
  await captureNative('02-native-existing-thread-unsent-unicode');

  phase = 'cold Windows Shell dispatch of the exact saved thread and distinct unsent draft';
  const warmComposer = page.locator('[contenteditable=true]').filter({ hasText: marker });
  if (await warmComposer.count() === 1) await warmComposer.fill('');
  else {
    const input = page.locator('textarea').filter({ visible: true });
    assert.equal(await input.count(), 1, 'Expected one visible textarea composer');
    assert.equal(await input.inputValue(), marker);
    await input.fill('');
  }
  assert.equal((await observeComposer(environmentId, threadId, '')).value, '');
  proof.clearedWarmDraftBeforeCold = true;
  await page.goto('t3code://app/#/', { waitUntil: 'domcontentloaded', timeout: 13000 });
  assert.equal(new URL(page.url()).hash, '#/');
  await app.close();
  app = undefined;
  page = undefined;
  const coldPath = join(evidence, 'cold-proof.json');
  const coldUri = getAgentLink('t3-code', 'desktop', { session: copiedThreadUrl, prompt: coldMarker });
  assert.equal(coldUri, blank + '?prompt=' + encodeURIComponent(coldMarker));
  try {
    execFileSync(process.env.T3_QA_SHELL, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', join(scratch, 'cold.ps1')], {
      cwd: scratch,
      env: { ...process.env, T3_QA_URI: coldUri, T3_QA_EXPECTED: coldMarker, T3_QA_EVIDENCE: evidence },
      windowsHide: true, timeout: 62000, encoding: 'utf8',
    });
  } finally {
    if (existsSync(coldPath)) proof.cold = JSON.parse(readFileSync(coldPath, 'utf8'));
  }
  assert.equal(proof.cold.exactChildArgument, true);
  assert.equal(proof.cold.before.stopped, true);
  assert.equal(proof.cold.visibleDraft.value, coldMarker);

  phase = 'verify zero runs, provider sessions and turns';
  const after = queryProjection();
  assert.deepEqual(after, seed);
  proof.finalCounts = after.counts;
  proof.result = 'passed';
} catch (error) {
  proof.result = 'failed';
  proof.failedAt = phase;
  proof.error = (error.message || error.name).split('\n')[0].replaceAll(scratch, '<scratch>').slice(0, 240);
  if (page && proof.nativeStartupOffTarget) {
    proof.lastHashPath = new URL(page.url()).hash.split('?')[0];
    await captureNative('03-last-native-window').catch(() => {});
  }
  process.exitCode = 1;
} finally {
  if (cliServer) await stopServer().catch(() => {});
  if (app) await app.close().catch(() => {});
  writeFileSync(join(evidence, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof));
}
