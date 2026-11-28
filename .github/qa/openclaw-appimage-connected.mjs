import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const [scratch] = process.argv.slice(2);
const out = join(scratch, 'evidence');
const app = join(scratch, 'OpenClaw-2026.11.10-amd64.AppImage');
const setupDriver = fileURLToPath(new URL('./openclaw-native-setup.py', import.meta.url));
const openclaw = join(scratch, 'cli', 'node_modules', 'openclaw', 'openclaw.mjs');
const workspace = join(scratch, 'project');
const desktopState = join(process.env.HOME, '.openclaw');
const gatewayHome = join(scratch, 'gateway-home');
const state = join(gatewayHome, '.openclaw');
const stock = JSON.parse(await readFile(join(openclaw, '..', 'package.json'), 'utf8'));
assert.equal(stock.version, '2026.11.10');
const uri = (await readFile(join(out, 'requested.txt'), 'utf8')).trim();
assert.equal(uri, 'openclaw://dashboard');
await mkdir(state, { mode: 0o700, recursive: true });

async function socketPort(listener) {
  await new Promise((resolve, reject) => listener.listen(0, '127.0.0.1', resolve).once('error', reject));
  return listener.address().port;
}

const report = { version: stock.version, libraryVersion: '0.1.70', uri, modelRequests: 0 };
const fakeModel = createServer(socket => { report.modelRequests += 1; socket.destroy(); });
const modelPort = await socketPort(fakeModel);
const probe = createServer();
const port = await socketPort(probe);
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const prefix = '/openclaw-runtime-proof';
const token = randomBytes(32).toString('hex');
const configFile = join(state, 'openclaw.json');
const env = {
  ...process.env,
  OPENCLAW_SKIP_CHANNELS: '1', OPENCLAW_SKIP_PROVIDERS: '1', OPENCLAW_NO_RESPAWN: '1',
  NODE_COMPILE_CACHE: join(scratch, 'node-compile-cache'),
};
const gatewayEnv = { ...env, HOME: gatewayHome, OPENCLAW_STATE_DIR: state, OPENCLAW_CONFIG_PATH: configFile };

await writeFile(configFile, JSON.stringify({
  gateway: { mode: 'local', bind: 'loopback', port, auth: { mode: 'token', token }, controlUi: { enabled: true, basePath: prefix } },
  agents: {
    defaults: { workspace, skipBootstrap: true, model: 'ollama/qwen3:0.6b' },
    entries: { 'desktop-proof': { name: 'Desktop proof', workspace, model: 'ollama/qwen3:0.6b' } },
  },
  models: { providers: { ollama: {
    baseUrl: `http://127.0.0.1:${modelPort}`, api: 'ollama',
    models: [{ id: 'qwen3:0.6b', name: 'Qwen3 0.6B local fixture' }],
  } } },
  desktop: { host: { enabled: false } },
  plugins: { enabled: false }, cron: { enabled: false }, browser: { enabled: false },
  discovery: { mdns: { mode: 'off' } },
}), { mode: 0o600 });

function command(program, args, extra = {}) {
  return spawnSync(program, args, { cwd: workspace, env, encoding: 'utf8', timeout: 12_000, ...extra });
}

function checked(program, args, extra) {
  const result = command(program, args, extra);
  assert.equal(result.status, 0, `${program} ${args[0]} failed: ${(result.stderr ?? '').replaceAll(token, '[redacted]')}`);
  return result.stdout;
}

async function logged(program, args, label, childEnv = env) {
  const file = await open(join(scratch, `${label}.raw.log`), 'w', 0o600);
  const child = spawn(program, args, { cwd: workspace, env: childEnv, stdio: ['ignore', file.fd, file.fd] });
  await file.close();
  return child;
}

async function awaitValue(description, timeout, sample) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await sample();
    if (value) return value;
    await delay(1000);
  }
  assert.fail(description);
}

async function ownedApp() {
  for (const name of await readdir('/proc')) {
    if (!/^\d+$/u.test(name)) continue;
    try {
      const processEnv = (await readFile(`/proc/${name}/environ`, 'utf8')).split('\0');
      if (!processEnv.includes(`APPIMAGE=${app}`)) continue;
      const argv = (await readFile(`/proc/${name}/cmdline`, 'utf8')).split('\0').filter(Boolean);
      if (argv[0] === 'openclaw-desktop' || argv[0]?.endsWith('/openclaw-desktop')) {
        return { pid: Number(name), argv };
      }
    } catch {}
  }
  return null;
}

function capture(label) {
  const png = join(scratch, `${label}.png`);
  checked('scrot', ['--overwrite', png]);
  const text = checked('tesseract', [png, 'stdout', '--psm', '11']);
  return { png, text };
}

async function evidenceFrame(captured, label) {
  assert.ok(!captured.text.includes(token), 'The screenshot exposed the disposable Gateway token');
  await writeFile(join(out, `${label}.png`), await readFile(captured.png));
}

async function setupAction(action, name) {
  const accessibility = command('/usr/bin/python3', [setupDriver, action, name], { timeout: 14_000 });
  if (accessibility.status === 0) return 'AT-SPI';
  await awaitValue(`The native setup did not show the ${name} control`, 18_000, () => {
    const png = join(scratch, 'setup-control.png');
    checked('scrot', ['--overwrite', png]);
    const lines = new Map();
    for (const row of checked('tesseract', [png, 'stdout', '--psm', '11', 'tsv']).split('\n')) {
      const [level, page, block, paragraph, line, , left, top, width, height, , word] = row.split('\t');
      if (level !== '5' || !word?.trim()) continue;
      const key = [page, block, paragraph, line].join(':');
      const words = lines.get(key) ?? [];
      words.push({ word, x: Number(left), y: Number(top), width: Number(width), height: Number(height) });
      lines.set(key, words);
    }
    const matches = [...lines.values()].filter(words =>
      words.map(({ word }) => word.toLowerCase()).join(' ') === name.toLowerCase());
    const words = matches.at(-1);
    if (!words) return false;
    const x = Math.floor((words[0].x + words.at(-1).x + words.at(-1).width) / 2);
    const y = Math.floor(words[0].y + (action === 'focus' ? 33 : words[0].height / 2));
    checked('xdotool', ['mousemove', String(x), String(y), 'click', '1']);
    return true;
  });
  return 'X11 pointer with displayed text';
}

async function currentAdmissions() {
  const raw = await readFile(join(scratch, 'gateway.raw.log'), 'utf8');
  return raw.split('\n').filter(line => (
    /\bclient connected\b/u.test(line) && /\bclient=openclaw-linux\b/u.test(line) && /\brole=operator\b/u.test(line)
  )).map(line => Object.fromEntries([...line.matchAll(/\b(client|mode|role|auth)=([a-z0-9._-]+)/gu)]
    .map(([, name, value]) => [name, value])));
}

const authGate = /pairing\s*link\s*is\s*no longer valid|pairing required|token mismatch|no access to this gateway|connect to a gateway/iu;
const dashboard = /main session/iu;

let gateway;
let windowManager;
let appProcess;
try {
  const validation = command(process.execPath, [openclaw, 'config', 'validate'], { env: gatewayEnv, timeout: 95_000 });
  assert.equal(validation.status, 0, (validation.stdout + validation.stderr).replaceAll(token, '[redacted]'));
  assert.equal(command('xdg-mime', ['query', 'default', 'x-scheme-handler/openclaw']).stdout.trim(), '');
  assert.equal(await readFile(join(desktopState, 'openclaw.json'), 'utf8').catch(() => ''), '');
  windowManager = await logged('openbox', [], 'wm');
  const keyring = command('gnome-keyring-daemon', ['--unlock', '--components=secrets'], { input: 'temporary-hosted-fixture\n' });
  report.secretServiceExit = keyring.status;
  gateway = await logged(process.execPath, [
    openclaw, 'gateway', 'run', '--bind', 'loopback', '--port', String(port), '--verbose', '--ws-log', 'compact',
  ], 'gateway', gatewayEnv);
  report.gatewayReady = await awaitValue('The stock Gateway did not become ready', 165_000, async () => {
    const response = await fetch(`${origin}/readyz`, { signal: AbortSignal.timeout(1200) }).catch(() => null);
    return response?.ok && { http: response.status, ready: (await response.json()).ready };
  });

  appProcess = await logged(app, [], 'desktop');
  report.app = await awaitValue('No stock AppImage inner desktop process appeared', 55_000, ownedApp);
  const entry = await awaitValue('AppImage did not register its own handler', 35_000, () =>
    command('xdg-mime', ['query', 'default', 'x-scheme-handler/openclaw']).stdout.trim());
  assert.match(entry, /^[A-Za-z0-9._-]+\.desktop$/u);
  const desktop = await readFile(join(process.env.XDG_DATA_HOME, 'applications', entry), 'utf8');
  assert.ok(desktop.includes(app) && desktop.includes('%u') && desktop.includes('x-scheme-handler/openclaw'));
  await writeFile(join(out, 'native-entry.txt'), desktop.split('\n').filter(line => /^(Exec|Name|MimeType)=/u.test(line)).join('\n'));

  const setupWindow = await awaitValue('No foreground window for the stock setup wizard', 45_000, () => {
    const visible = command('xdotool', ['search', '--onlyvisible', '--pid', String(report.app.pid)]).stdout.trim().split('\n');
    const current = command('xdotool', ['getactivewindow']).stdout.trim();
    return visible.includes(current) && current;
  });
  report.disposableSetup = { window: setupWindow, route: 'Direct connection from the native setup wizard', origin, prefix };
  const setupPage = await awaitValue('No welcome or location page in the native setup window', 35_000, () => {
    const captured = capture('before-credentials');
    return /get started|on another computer|where should your assistant live/iu.test(captured.text) ? captured : null;
  });
  await evidenceFrame(setupPage, 'before-credentials');
  report.disposableSetup.beforeCredentialsText = setupPage.text;
  report.disposableSetup.inputs = [];
  if (!/on another computer|where should your assistant live/iu.test(setupPage.text)) {
    report.disposableSetup.inputs.push(await setupAction('click', 'Get started'));
  }
  report.disposableSetup.inputs.push(await setupAction('click', 'On another computer'));
  report.disposableSetup.inputs.push(await setupAction('focus', 'Gateway URL'));
  checked('xdotool', ['type', '--clearmodifiers', '--file', '-'], { input: origin + prefix });
  report.disposableSetup.inputs.push(await setupAction('focus', 'Gateway token'));
  checked('xdotool', ['type', '--clearmodifiers', '--file', '-'], { input: token });
  report.disposableSetup.inputs.push(await setupAction('click', 'Connect to Gateway'));

  const initial = await awaitValue('AppImage did not visibly attach to the live Control UI', 120_000, () => {
    const window = command('xdotool', ['search', '--onlyvisible', '--pid', String(report.app.pid)]);
    if (window.status !== 0) return null;
    const captured = capture('initial');
    return dashboard.test(captured.text) && !authGate.test(captured.text)
      ? { window: window.stdout.trim().split('\n')[0], captured } : null;
  });
  await evidenceFrame(initial.captured, 'initial');
  report.initial = { window: initial.window, ocr: initial.captured.text };
  report.initial.admissions = await awaitValue('No live native operator admission after the ordinary Direct setup', 35_000, async () => {
    const admissions = await currentAdmissions();
    return admissions.length ? admissions : null;
  });
  const desktopConfig = JSON.parse(await readFile(join(desktopState, 'openclaw.json'), 'utf8'));
  assert.equal(desktopConfig.gateway.mode, 'remote');
  assert.equal(desktopConfig.gateway.remote.transport, 'direct');
  report.disposableSetup.persistedTransport = desktopConfig.gateway.remote.transport;
  const persistedEndpoint = new URL(desktopConfig.gateway.remote.url.replace(/^ws:/u, 'http:'));
  assert.equal(persistedEndpoint.origin, origin);
  report.disposableSetup.persistedEndpoint = persistedEndpoint.origin + persistedEndpoint.pathname;
  const xprops = checked('xprop', ['-id', initial.window, '_NET_WM_PID']);
  assert.match(xprops, new RegExp(`= ${report.app.pid}\\b`));
  checked('xdotool', ['windowminimize', initial.window]);
  await awaitValue('OpenClaw window remained mapped after minimize', 10_000, () =>
    !command('xdotool', ['search', '--onlyvisible', '--pid', String(report.app.pid)]).stdout.trim().split('\n').includes(initial.window));

  report.stockGio = checked('gio', ['open', uri]);
  const foreground = await awaitValue('The Dashboard link did not restore the same window', 40_000, () => {
    const active = command('xdotool', ['getactivewindow']).stdout.trim();
    const mapped = command('xdotool', ['search', '--onlyvisible', '--pid', String(report.app.pid)]).stdout.trim().split('\n');
    return active === initial.window && mapped.includes(initial.window) ? active : null;
  });
  report.restored = { foreground, sameWindow: foreground === initial.window, samePid: (await ownedApp())?.pid === report.app.pid };
  assert.equal(report.restored.samePid, true);
  const after = capture('restored-dashboard');
  assert.match(after.text, dashboard);
  assert.doesNotMatch(after.text, authGate);
  await evidenceFrame(after, 'restored-dashboard');
  report.restored.ocr = after.text;

  process.kill(report.app.pid, 'SIGTERM');
  await awaitValue('The first owned AppImage process did not stop', 18_000, async () => !(await ownedApp()));
  report.absentBeforeCold = true;
  const beforeColdAdmissions = (await currentAdmissions()).length;
  checked('gio', ['open', uri]);
  report.coldApp = await awaitValue('Cold GIO did not deliver the exact Dashboard URL to the new AppImage process', 50_000, async () => {
    const cold = await ownedApp();
    return cold && cold.pid !== report.app.pid && cold.argv.includes(uri) ? cold : null;
  });
  report.coldDashboard = await awaitValue('The cold AppImage did not show its connected Dashboard', 100_000, () => {
    const window = command('xdotool', ['search', '--onlyvisible', '--pid', String(report.coldApp.pid)]);
    const active = command('xdotool', ['getactivewindow']).stdout.trim();
    if (window.status !== 0 || !window.stdout.trim().split('\n').includes(active)) return null;
    const captured = capture('cold-dashboard');
    return dashboard.test(captured.text) && !authGate.test(captured.text)
      ? { window: active, foreground: true, text: captured.text } : null;
  });
  await evidenceFrame({ png: join(scratch, 'cold-dashboard.png'), text: report.coldDashboard.text }, 'cold-dashboard');
  report.coldDashboard.admissions = await awaitValue('The cold Dashboard showed no new native operator admission', 35_000, async () => {
    const admissions = (await currentAdmissions()).slice(beforeColdAdmissions);
    return admissions.length ? admissions : null;
  });
  const coldProperties = checked('xprop', ['-id', report.coldDashboard.window, '_NET_WM_PID']);
  assert.equal(Number(coldProperties.trim().split(' = ').at(-1)), report.coldApp.pid);
  assert.equal(report.modelRequests, 0);
  console.log('Stock GIO restored the warm Dashboard and cold-opened a new connected Dashboard with exact argv.');
} finally {
  fakeModel.close();
  const remaining = await ownedApp();
  if (remaining) {
    try { process.kill(remaining.pid, 'SIGTERM'); } catch {}
  }
  for (const child of [appProcess, gateway, windowManager]) child?.kill('SIGTERM');
  report.gatewayAdmissions = await currentAdmissions().catch(() => []);
  await writeFile(join(out, 'proof.json'), JSON.stringify(report, null, 2));
}
