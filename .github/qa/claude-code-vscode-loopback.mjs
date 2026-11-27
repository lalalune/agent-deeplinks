import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const qa = realpathSync(process.env.QA_HOME);
const evidence = join(qa, 'evidence');
const fixture = join(qa, 'fixture');
const modules = join(qa, 'node_modules');
const { chromium } = await import(pathToFileURL(join(modules, 'playwright-core', 'index.mjs')));
const { getAgentLink } = await import(pathToFileURL(join(modules, 'agent-deeplinks', 'dist', 'index.js')));
const marker = 'Claude Code VS Code unsent + & café ☃ %2F';
const uri = getAgentLink('claude-code', 'vscode', { prompt: marker });
const uriOnce = new URL(uri).searchParams.get('prompt');
assert.equal(uriOnce, encodeURIComponent(marker));
assert.equal(decodeURIComponent(uriOnce), marker);
assert.deepEqual(readdirSync(fixture), []);

const record = { library: 'agent-deeplinks@0.1.66', extension: 'anthropic.claude-code@2.1.332', marker, uri,
  exactNestedEncoding: true, profile: 'disposable', noAccount: true, draftSubmitted: false,
  gatewayRequests: [], gatewayWriteAttempts: 0, onboardingActions: [] };
const gatewayToken = 'disposable-loopback-model-list-only';
const gateway = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  const read = request.method === 'GET' || request.method === 'HEAD';
  if (!read) record.gatewayWriteAttempts++;
  const modelList = read && path === '/v1/models';
  const authorized = request.headers.authorization === `Bearer ${gatewayToken}`;
  record.gatewayRequests.push({ method: request.method, route: modelList ? '/v1/models' : '(other)',
    status: modelList ? 200 : read ? 404 : 405, authorized });
  response.writeHead(modelList ? 200 : read ? 404 : 405, { 'content-type': 'application/json' });
  if (modelList) {
    response.end(JSON.stringify({ data: [{ type: 'model', id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6 QA', created_at: '2026-02-17T00:00:00Z' }], has_more: false, first_id: 'claude-sonnet-4-6', last_id: 'claude-sonnet-4-6' }));
  } else response.end('{}');
});
await new Promise((resolve, reject) => { gateway.once('error', reject); gateway.listen(0, '127.0.0.1', resolve); });
const gatewayEnv = {
  ANTHROPIC_BASE_URL: `http://127.0.0.1:${gateway.address().port}`,
  ANTHROPIC_AUTH_TOKEN: gatewayToken,
  ANTHROPIC_MODEL: 'claude-sonnet-4-6',
  CLAUDE_CONFIG_DIR: join(qa, 'claude'),
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
};
const settings = {
  'workbench.startupEditor': 'none',
  'telemetry.telemetryLevel': 'off',
  'extensions.autoUpdate': false,
  'extensions.verifySignature': true,
  'update.mode': 'none',
  'claudeCode.disableLoginPrompt': true,
  'claudeCode.environmentVariables': Object.entries(gatewayEnv).map(([name, value]) => ({ name, value })),
};
writeFileSync(join(process.env.XDG_CONFIG_HOME, 'Code', 'User', 'settings.json'), JSON.stringify(settings, null, 2));
record.documentedExtensionSettings = ['claudeCode.disableLoginPrompt', 'claudeCode.environmentVariables'];

const run = (file, args, options = {}) => spawnSync(file, args, { encoding: 'utf8', timeout: 10000, ...options });
const outputFile = name => join(evidence, name);
const screenshot = name => run('import', ['-window', 'root', outputFile(name)]).status === 0;
const expectedHandler = process.env.QA_VSCODE_HANDLER;
const scheme = 'x-scheme-handler/vscode';
assert.equal(run('xdg-mime', ['default', expectedHandler, scheme]).status, 0);
assert.equal(run('xdg-mime', ['query', 'default', scheme]).stdout.trim(), expectedHandler);
record.stockHandler = expectedHandler;
const port = 39347;
const seedName = 'Claude native draft QA baseline.txt';
const seed = join(qa, seedName);
writeFileSync(seed, 'Stock editor baseline before protocol dispatch.\n', { flag: 'wx', mode: 0o600 });
const editor = spawn('code', ['--new-window', '--disable-gpu', '--log', 'trace', '--extensions-dir', join(qa, 'extensions'),
  '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, fixture, seed], { stdio: 'ignore', detached: true });
const endpoint = `http://127.0.0.1:${port}`;
let browser;
let page;

async function until(check, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await delay(650);
  }
  return null;
}

function readOcr(name) {
  if (!screenshot(name)) return { text: '', words: [] };
  const enlarged = join(qa, 'private-ocr.png');
  if (run('convert', [outputFile(name), '-resize', '150%', '-colorspace', 'gray', enlarged]).status !== 0) return { text: '', words: [] };
  const tsv = run('tesseract', [enlarged, 'stdout', '--psm', '6', 'tsv']).stdout ?? '';
  const words = tsv.split('\n').map(line => line.split('\t')).filter(fields => fields[0] === '5' && fields[11]);
  return { text: words.map(fields => fields[11]).join(' '), words };
}

function clickOcr(words, label) {
  const parts = label.split(' ');
  const index = words.findIndex((first, start) => parts.every((word, offset) => {
    const current = words[start + offset];
    return current?.[11] === word && first.slice(1, 5).join() === current.slice(1, 5).join();
  }));
  if (index < 0) return false;
  const first = words[index].map(Number);
  const last = words[index + parts.length - 1].map(Number);
  const x = Math.round((first[6] + last[6] + last[8]) / 3);
  const y = Math.round((first[7] + first[9] / 2) / 1.5);
  return run('xdotool', ['mousemove', String(x), String(y), 'click', '1']).status === 0;
}

async function matchEditor() {
  for (const frame of page.frames()) {
    let result;
    try {
      result = await frame.evaluate(expected => {
        const candidates = document.querySelectorAll('textarea, input, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
        for (const box of candidates) {
          const nodeText = box.value ?? box.innerText ?? box.textContent;
          const style = getComputedStyle(box);
          if ((nodeText === expected || nodeText === expected + '\n') && box.getClientRects().length &&
              style.visibility === 'visible' && !box.disabled && !box.readOnly && box.getAttribute('aria-disabled') !== 'true') {
            return { value: nodeText, role: box.getAttribute('role'), tag: box.tagName, editable: box.isContentEditable || box.matches('textarea,input'), label: box.getAttribute('aria-label') };
          }
        }
        return null;
      }, marker);
    } catch { continue; }
    if (result?.editable) return { ...result, method: 'visible editable in live extension renderer' };
  }
  return null;
}

async function prepareWorkbench() {
  const onboarding = page.locator('.onboarding-a-overlay');
  if (await onboarding.isVisible()) {
    for (const label of ['Continue without Signing In', 'Get Started']) {
      const action = onboarding.getByRole('button', { name: label, exact: true });
      if (await action.isVisible()) {
        await action.click({ timeout: 3500 });
        record.onboardingActions.push(label);
        return false;
      }
    }
    return false;
  }
  const trust = page.locator('.monaco-dialog-box').filter({ hasText: 'Do you trust the authors' });
  const trustButton = trust.getByRole('button', { name: 'Yes, I trust the authors', exact: true });
  if (await trustButton.isVisible()) {
    const text = await trust.innerText({ timeout: 3500 });
    assert(text.includes(fixture) || text.includes('fixture'), 'VS Code trust dialog lacked the disposable fixture');
    assert.deepEqual(readdirSync(fixture), []);
    await trustButton.click({ timeout: 3500 });
    record.vscodeFixtureTrusted = true;
    return false;
  }
  const restricted = page.locator('.part.banner').filter({ hasText: 'Restricted Mode is intended for safe code browsing' });
  const manageTrust = restricted.getByText('Manage', { exact: true });
  const workspaceTrust = page.locator('.workspace-trust-editor');
  if (!record.vscodeFixtureTrusted && (await manageTrust.isVisible() || await workspaceTrust.isVisible())) {
    assert((await page.title()).includes(' - fixture - '), 'Unexpected workspace in the Workspace Trust window');
    assert.deepEqual(readdirSync(fixture), []);
    if (!(await workspaceTrust.isVisible())) await manageTrust.click({ timeout: 3500 });
    const trustFolder = workspaceTrust.getByRole('button', { name: /^Trust(?:, Keyboard Shortcut:.*)?$/ });
    if (await trustFolder.isVisible()) {
      await trustFolder.click({ timeout: 3500 });
      record.vscodeFixtureTrusted = true;
    }
    return false;
  }
  const workbench = page.locator('.monaco-workbench');
  const editorTab = workbench.locator('.tabs-container [role="tab"]').filter({ hasText: seedName });
  if (await editorTab.isVisible() && !(await restricted.isVisible()) &&
      !(await page.locator('.monaco-dialog-box').first().isVisible())) {
    record.baselineTitle = await page.title();
    return true;
  }
  return false;
}

try {
  assert(await until(async () => (await fetch(endpoint + '/json/version', { signal: AbortSignal.timeout(1000) }).catch(() => null))?.ok, 30));
  browser = await chromium.connectOverCDP(endpoint, { timeout: 6000 });
  page = await until(() => browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().includes('workbench')), 25);
  assert(page, 'Native workbench CDP page did not appear');
  await page.locator('.monaco-workbench').waitFor({ timeout: 18000 });
  await delay(3500);
  assert(await until(prepareWorkbench, 35), 'Normal stock workbench did not finish onboarding');
  screenshot('stock-workbench-ready.png');

  const trace = outputFile('xdg-open-execve.txt');
  const dispatch = run('strace', ['-f', '-e', 'trace=execve', '-s', '650', '-o', trace, 'xdg-open', uri], { timeout: 13000 });
  record.xdgOpenStatus = dispatch.status;
  record.exactStockHandlerArgument = readFileSync(trace, 'utf8').split('\n').some(line => line.includes('execve("/usr/share/code/code"') && line.includes('"--open-url"') && line.includes(`"${uri}"`));
  assert(record.exactStockHandlerArgument, 'The stock VS Code launch argument did not preserve the exact URI');

  const uriDialog = page.locator('.monaco-dialog-box').filter({hasText: /Claude Code|anthropic[.]claude-code/i});
  const deadline = Date.now() + 75000;
  do {
    const open = uriDialog.getByText('Open', { exact: true });
    if (!record.confirmedOnce && await open.isVisible()) {
      screenshot('uri-confirmation.png');
      await open.click({ timeout: 3500 });
      record.confirmedOnce = true;
    }
    record.editor = await matchEditor();
    if (record.editor) break;
    if (!record.claudeFolderTrusted) {
      const screen = readOcr('visible-checkpoint.png');
      if (screen.text.includes('Trust this folder in Claude Code?')) {
        assert(screen.text.includes(fixture), 'Claude Code trust dialog did not name the exact empty disposable fixture');
        assert(clickOcr(screen.words, 'Trust folder'), 'The exact Claude Code trust action was unavailable');
        record.claudeFolderTrusted = true;
      }
    }
    await delay(850);
  } while (Date.now() < deadline);

  if (!record.editor) {
    const lastScreen = readOcr('final-screen.png');
    record.finalText = lastScreen.text.slice(0, 1400);
    record.nativeFrameCount = page.frames().length;
    // If a webview is inaccessible to CDP, copy only from a confidently located
    // composer line. Focus and select are the only keyboard actions in this fallback.
    if (clickOcr(lastScreen.words, 'Claude Code VS Code unsent')) {
      run('xdotool', ['key', '--clearmodifiers', 'ctrl+a', 'ctrl+c']);
      await delay(200);
      const copied = run('xclip', ['-selection', 'clipboard', '-o']).stdout;
      if (copied === marker) record.editor = { value: copied, editable: true, method: 'native X11 copy from the focused composer' };
    }
  }
  if (record.editor) screenshot('exact-unsent-composer.png');
  assert(record.editor?.editable && [marker, marker + '\n'].includes(record.editor.value), 'Exact visible editable draft not observed');
  assert.equal(record.gatewayWriteAttempts, 0, 'The loopback fixture saw a non-read request');
  record.result = 'exact visible unsent draft';
} catch (error) {
  if (page) {
    record.lastWorkbench = await page.locator('body').innerText({ timeout: 3000 }).then(value => value.slice(0, 1800), () => null);
  }
  screenshot('final-qa-window.png');
  record.error = error.message.split('\n')[0];
  process.exitCode = 1;
} finally {
  const logs = join(process.env.XDG_CONFIG_HOME, 'Code', 'logs');
  record.extensionActivationLogged = existsSync(logs) && readdirSync(logs, { recursive: true }).filter(name => name.endsWith('/exthost.log')).some(name => {
    const lines = readFileSync(join(logs, name), 'utf8').split('\n');
    return lines.some(line => /(?:activateExtension|ExtensionService#_doActivateExtension).+anthropic\.claude-code/i.test(line));
  });
  writeFileSync(outputFile('proof.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify(record));
  await browser?.close().catch(() => {});
  try { process.kill(-editor.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  gateway.close();
  gateway.closeAllConnections();
}
