import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const [scratch, installed] = process.argv.slice(2);
const app = realpathSync(installed);
const output = join(scratch, 'evidence');
const profile = join(scratch, 'profile');
const probe = join(scratch, 'observe');
const library = join(scratch, 'library/package');
const { getAgentLink } = await import(pathToFileURL(join(library, 'dist/index.js')));
const packageVersion = JSON.parse(readFileSync(join(library, 'package.json'), 'utf8')).version;
const id = 'bc-8da7657c-0caf-49d1-8a21-81e0761b0eb0';
const uri = getAgentLink('cursor', 'desktop', { cloudAgent: id });
const run = (binary, args) => execFileSync(binary, args, { encoding: 'utf8', timeout: 20000 }).trim();
const state = () => JSON.parse(run(probe, ['state']));
const signedOut = (ocr) => /log[\s-]?in|sign[\s-]?in|sign[\s-]?up/iu.test(ocr);
const proof = { packageVersion, installedApp: app, id, uri, accountUsed: false, chatSubmitted: false };

function matchingLines() {
  const directory = join(profile, 'logs');
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true }).filter(path => path.endsWith('.log')).flatMap(path => {
    const file = join(directory, path);
    if (!existsSync(file)) return [];
    return readFileSync(file, 'utf8').split('\n').filter(line => line.includes(id)).map(line => ({ path, line: line.trim().slice(0, 800) }));
  });
}

function ownedWindow(snapshot, name) {
  if (snapshot.frontmost.path !== app) return null;
  const [window] = snapshot.frontmostOwnedVisibleWindows;
  if (!window) return null;
  const image = join(output, name + '.png');
  run('/usr/sbin/screencapture', ['-x', '-l', String(window.id), image]);
  return { window, owner: snapshot.frontmost, ocr: run(probe, ['ocr', image]) };
}

let stage = 'resolve installed Cursor';
try {
  assert.equal(packageVersion, '0.1.71');
  assert.equal(uri, `cursor://anysphere.cursor-deeplink/background-agent?bcId=${id}`);
  proof.version = readFileSync(join(output, 'version.txt'), 'utf8').trim();
  proof.routeResolver = run(probe, ['resolve', uri]);
  assert.equal(proof.routeResolver, app);
  assert.deepEqual(state().cursor, []);

  stage = 'open stock classic editor in a fresh profile';
  const document = join(scratch, 'Cloud Agent link QA.txt');
  writeFileSync(document, 'Disposable editor baseline for the Cursor Cloud Agent link test.\n');
  run('/usr/bin/open', ['-a', app, '--args', '--classic', '--disable-telemetry', '--disable-updates',
    '--skip-welcome', '--user-data-dir', profile, document]);
  const waitForEditor = Date.now() + 48000;
  while (Date.now() < waitForEditor) {
    proof.before = ownedWindow(state(), 'before');
    if (proof.before && /Cloud Agent link QA|Disposable editor baseline|Get Started|Explorer/u.test(proof.before.ocr)) break;
    await wait(800);
  }
  assert.match(proof.before?.ocr ?? '', /Cloud Agent link QA|Disposable editor baseline|Get Started|Explorer/u, 'classic editor baseline missing');
  assert.deepEqual(matchingLines(), []);

  stage = 'dispatch exact library URL through stock LaunchServices';
  run('/usr/bin/open', [uri]);
  proof.stockDispatchExit = 0;

  stage = 'observe exact Agent lookup and signed-out native surface';
  const waitForLookup = Date.now() + 48000;
  while (Date.now() < waitForLookup) {
    proof.cursorAfter = state();
    proof.after = ownedWindow(proof.cursorAfter, 'after');
    proof.exactIdLog = matchingLines();
    proof.lookupLog = proof.exactIdLog.filter(({ line }) => /agent|lookup|failed|error|unauth/i.test(line.replace(id, '')));
    if (proof.after && signedOut(proof.after.ocr) && proof.lookupLog.length) break;
    await wait(1000);
  }
  assert.ok(proof.lookupLog?.length, 'Cursor did not log the exact synthetic Agent ID in a lookup line');
  assert.equal(proof.after?.owner.path, app, 'the installed signed app did not own the observed window');
  assert.ok(signedOut(proof.after.ocr), 'the signed-out native endpoint was not visible');
  proof.samePrimary = proof.before.owner.pid === proof.after.owner.pid;
  proof.result = 'exact Cloud Agent lookup and native signed-out destination observed';
} catch (error) {
  proof.error = { stage, message: error.message };
  process.exitCode = 1;
} finally {
  writeFileSync(join(output, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof, null, 2));
}
