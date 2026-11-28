import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";

const scratch = await realpath(process.argv[2]);
const evidence = join(scratch, "evidence");
const observer = join(scratch, "native-observe");
const bundle = await realpath((await readFile(join(scratch, "app-path.txt"), "utf8")).trim());
const appID = "com.anthropic.claudefordesktop";
assert.equal(process.env.GITHUB_ACTIONS, "true");
const call = (binary, args) => execFileSync(binary, args, { encoding: "utf8", timeout: 20000 }).trim();
const apps = () => JSON.parse(call(observer, ["application", appID]));
const ocr = file => call(observer, ["ocr", file]);
const draft = "Cowork QA exact draft + & café ☃ %2F\nKeep this unsent.";
const root = join(scratch, "fixture");
const folders = [join(root, "QA café + one"), join(root, "QA & two")];
const files = [join(folders[0], "Marker + one.txt"), join(folders[1], "Marker & two.txt")];
for (const directory of folders) await mkdir(directory, { recursive: true });
for (const file of files) await writeFile(file, "Inert agent-deeplinks QA fixture.\n");

const base = "claude://cowork/new";
const query = [["q", draft], ...folders.map(value => ["folder", value]), ...files.map(value => ["file", value])]
  .map(([name, value]) => name + "=" + encodeURIComponent(value)).join("&");
const proof = {
  accountUsed: false, promptSubmitted: false, attachmentApproval: false,
  dispatch: "Stock LaunchServices /usr/bin/open", installedBundleId: appID,
  installedVersion: call("/usr/bin/plutil", ["-extract", "CFBundleShortVersionString", "raw", join(bundle, "Contents/Info.plist")]),
  cases: [],
};
async function stop(pid) {
  if (apps().some(item => item.pid === pid && item.path === bundle)) process.kill(Number(pid), "SIGTERM");
  for (let i = 0; i < 24 && apps().length; ++i) await wait(500);
  assert.deepEqual(apps(), [], "Closed disposable Claude app still running");
}

try {
  for (const [name, uri] of [["blank", base], ["draft-and-attachments", base + "?" + query]]) {
    const observed = { name, uri, appStoppedBeforeDispatch: true, matchingResolver: false, exactDispatch: false };
    proof.cases.push(observed);
    assert.deepEqual(apps(), [], "A Claude app was running before test dispatch");
    assert.equal(await realpath(call(observer, ["resolve", uri])), bundle);
    observed.matchingResolver = true;
    call("/usr/bin/open", [uri]);
    observed.exactDispatch = true;
    let launched;
    for (let i = 0; i < 40; ++i) {
      await wait(900);
      launched = apps().find(app => app.path === bundle);
      if (launched) break;
    }
    assert.ok(launched, "Verified Claude bundle was not launched by stock resolver");
    observed.pid = launched.pid;
    try {
      for (let i = 0; i < 24; ++i) {
        await wait(1200);
        const window = call(observer, ["window", launched.pid]);
        if (!window) continue;
        const screen = join(evidence, name + ".png");
        call("/usr/sbin/screencapture", ["-x", "-l", window, screen]);
        observed.text = ocr(screen);
        observed.window = window;
        if (/Claude for Mac/iu.test(observed.text) && /^Get started$/imu.test(observed.text) && !observed.welcomeClicked) {
          const display = join(evidence, name + "-welcome-display.png");
          call("/usr/sbin/screencapture", ["-x", display]);
          try {
            observed.welcomeClicked = call(observer, ["start-claude", display, launched.pid]);
          } catch (error) {
            if (error.status !== 2 && error.status !== 3) throw error;
          }
          continue;
        }
        if (/(?:^|\n)(?:sign in|log in)$|continue with (?:google|email)/imu.test(observed.text)) {
          observed.signedOutWindowVisible = true;
          break;
        }
      }
      assert.equal(observed.signedOutWindowVisible, true, "No owned Claude sign-in window was observed");
    } finally {
      await stop(launched.pid);
    }
  }
  proof.result = "Both cold dispatches reached Claude sign-in";
} catch (error) {
  proof.result = error.message;
  process.exitCode = 1;
} finally {
  await writeFile(join(evidence, "native-proof.json"), JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof));
}
