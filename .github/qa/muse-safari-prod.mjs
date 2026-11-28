import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const [output, probe, packagePath, installation] = process.argv.slice(2);
const run = (bin, args, options = {}) => execFileSync(bin, args, { encoding: 'utf8', timeout: 30000, ...options }).trim();
const plist = (app, key) => run('/usr/bin/plutil', ['-extract', key, 'raw', join(app, 'Contents/Info.plist')]);
const state = () => JSON.parse(run(probe, ['state']));
const [site, safari, button, copyMenu] = ['https://deeplinks.fun/', '/Applications/Safari.app', 'Meta Muse', 'Copy Link'];
const signedMuse = await realpath(installation);
const packageVersion = JSON.parse(await readFile(join(packagePath, 'package.json'), 'utf8')).version;
const { getAgentLink } = await import(pathToFileURL(join(packagePath, 'dist/index.js')));
const uri = getAgentLink('meta-muse', 'desktop');
const proof = { site, uri, packageVersion, signedMuse, accountUsed: false, consentSubmitted: false };

function capture(name, window) {
  const image = join(output, name + '.png');
  const target = window === undefined ? ['-m'] : ['-l', String(window)];
  run('/usr/sbin/screencapture', ['-x', ...target, image]);
  return { image, ocr: run(probe, ['ocr', image]) };
}

function exactLabel(ocr, label) {
  return ocr.split('\n').filter(line => line === label).length === 1;
}

let stage = 'verify signed applications and the published route';
try {
  assert.equal(packageVersion, '0.1.72');
  assert.equal(uri, 'https://agent.meta.ai/chat');
  run('/usr/bin/codesign', ['--verify', '--strict', safari]);
  proof.safariVersion = plist(safari, 'CFBundleShortVersionString');
  proof.museVersion = plist(signedMuse, 'CFBundleShortVersionString');
  assert.deepEqual(state().muse, []);

  stage = 'open the live Playground in regular Safari';
  run('/usr/bin/open', ['-a', safari, site]);
  let before;
  for (let sample = 0; sample < 30; sample++) {
    await wait(750);
    proof.before = state();
    if (proof.before.frontmost.bundleId !== 'com.apple.Safari' || !proof.before.frontmostOwnedVisibleWindows.length) continue;
    before = capture('playground-before');
    proof.beforeOCR = before.ocr;
    if (exactLabel(before.ocr, button) && /deeplinks\.fun/iu.test(before.ocr)) break;
  }
  assert.ok(before && exactLabel(before.ocr, button), 'Live Playground button was not visible');
  assert.match(before.ocr, /deeplinks\.fun/iu);

  stage = 'copy the rendered Safari link for exact comparison';
  run('/usr/bin/pbcopy', [], { input: 'Safari live Muse QA sentinel' });
  proof.contextPointer = JSON.parse(run(probe, ['context', before.image, button]));
  let context;
  for (let sample = 0; sample < 8; sample++) {
    await wait(350);
    context = capture('playground-context-menu');
    proof.contextOCR = context.ocr;
    if (exactLabel(context.ocr, copyMenu)) break;
  }
  assert.ok(context && exactLabel(context.ocr, copyMenu), 'Safari Copy Link menu item was not visible');
  proof.copyPointer = JSON.parse(run(probe, ['click', context.image, copyMenu]));
  for (let sample = 0; sample < 8; sample++) {
    await wait(250);
    proof.copiedSafariLink = run('/usr/bin/pbpaste', []);
    if (proof.copiedSafariLink !== 'Safari live Muse QA sentinel') break;
  }
  assert.equal(proof.copiedSafariLink, uri, 'Safari link differs from the published npm URL');

  stage = 'click the live button while signed Muse is stopped';
  const beforeClick = capture('playground-button');
  proof.beforeClick = state();
  assert.deepEqual(proof.beforeClick.muse, []);
  assert.ok(exactLabel(beforeClick.ocr, button));
  proof.clickPointer = JSON.parse(run(probe, ['click', beforeClick.image, button]));

  stage = 'observe the signed Muse-owned sign-in window';
  const deadline = Date.now() + 32000;
  let sample = 0;
  while (Date.now() < deadline) {
    await wait(650);
    proof.after = state();
    const [owned] = proof.after.frontmostOwnedVisibleWindows;
    if (proof.after.frontmost.bundleId === 'com.meta.endo' && proof.after.frontmost.path === signedMuse && owned) {
      proof.nativeWindow = capture('muse-sign-in', owned.id).ocr;
      if (/Welcome to Muse/iu.test(proof.nativeWindow) && /Log\s*in/iu.test(proof.nativeWindow)) break;
    }
    if (++sample % 4 === 0 && !proof.browserConfirmation && proof.after.frontmost.bundleId === 'com.apple.Safari') {
      const checkpoint = capture('safari-after-click');
      proof.browserAfterOCR = checkpoint.ocr;
      if (/Muse/iu.test(checkpoint.ocr) && /(?:allow|want).*open/iu.test(checkpoint.ocr) && exactLabel(checkpoint.ocr, 'Open')) {
        proof.browserConfirmation = JSON.parse(run(probe, ['click', checkpoint.image, 'Open']));
      }
    }
  }
  assert.equal(proof.after?.frontmost.path, signedMuse, 'Safari did not foreground the installed Muse bundle');
  assert.match(proof.nativeWindow ?? '', /Welcome to Muse/iu);
  assert.match(proof.nativeWindow ?? '', /Log\s*in/iu);
  proof.result = 'signed Muse cold-opened from the exact live Safari button and showed native sign-in';
} catch (error) {
  proof.error = { stage, message: error.message };
  process.exitCode = 1;
} finally {
  await writeFile(join(output, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof, null, 2));
}
