import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { getAgentLink } from "../../dist/index.js";

const scratch = realpathSync(join(process.env.RUNNER_TEMP, "zcode-mac-qa"));
const evidence = join(scratch, "evidence");
const application = join(scratch, "apps", "ZCode.app");
const info = join(application, "Contents", "Info.plist");
const run = (file, args, timeout = 8000) => execFileSync(file, args, { encoding: "utf8", timeout }).trim();
const name = run("/usr/bin/plutil", ["-extract", "CFBundleExecutable", "raw", info]);
const binary = join(application, "Contents", "MacOS", name);
const fixture = join(scratch, "ZCode QA + & café ☃");
mkdirSync(fixture);
const directory = realpathSync(fixture);
assert.deepEqual(readdirSync(directory), []);

const uri = getAgentLink("zcode", "desktop", { directory });
assert.ok(uri);
assert.equal(new URL(uri).searchParams.get("path"), directory);
assert.equal(getAgentLink("zcode", "desktop", { path: directory }), null);

const profile = {
  HOME: "home",
  ZCODE_HOME: "zcode-home",
  ZCODE_DATA_BASE_DIR: "zcode-data",
  ZCODE_DESKTOP_HOME_DIR: "desktop-home",
  ZCODE_DESKTOP_USER_DATA_DIR: "desktop-user",
  ZCODE_DESKTOP_SESSION_DATA_DIR: "desktop-session",
};
const appEnvironment = [];
for (const [key, name] of Object.entries(profile)) {
  const path = join(scratch, name);
  mkdirSync(path, { mode: 0o700 });
  appEnvironment.push("--env", key + "=" + path);
}
for (const key of ["ZAI_API_KEY", "ZHIPUAI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
  appEnvironment.push("--env", key + "=");
}
const proof = {
  package: "ZCode 4.0.0 macOS Apple Silicon",
  application,
  binary,
  directory,
  uri,
  workspaceApproved: false,
  accountUsed: false,
  promptSubmitted: false,
  captures: [],
};

function appProcesses() {
  return run("/bin/ps", ["-axww", "-o", "pid=,command="]).split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(.+)$/u);
    if (!match || (match[2] !== binary && !match[2].startsWith(binary + " "))) return [];
    return [{ pid: Number(match[1]), command: match[2] }];
  });
}

function stopApp() {
  for (const { pid } of appProcesses()) {
    try { process.kill(pid, "SIGTERM"); }
    catch (error) { if (error.code !== "ESRCH") throw error; }
  }
}

const observer = join(scratch, "observe");
try {
  run("/usr/bin/swiftc", [".github/qa/zcode-macos-observe.swift", "-o", observer], 90000);
  proof.stockHandler = run(observer, ["resolve", uri]);
  assert.ok(proof.stockHandler, "LaunchServices did not resolve a handler");
  assert.equal(realpathSync(proof.stockHandler), application);
  assert.deepEqual(appProcesses(), []);
  run("/usr/bin/open", [...appEnvironment, uri]);
  proof.stockOpenAccepted = true;
  for (let attempt = 0; attempt < 30 && !proof.process; attempt++) {
    proof.process = appProcesses()[0];
    if (!proof.process) await wait(400);
  }
  assert.ok(proof.process, "LaunchServices accepted the URL but did not cold-launch ZCode");

  const targetLabel = basename(directory).replace(" ☃", "");
  for (const [name, delay] of [["early", 3500], ["settled", 7000], ["final", 10000]]) {
    await wait(delay);
    const screenshot = join(evidence, name + ".png");
    const capture = { name };
    proof.captures.push(capture);
    try {
      run("/usr/sbin/screencapture", ["-x", screenshot]);
      capture.screenshot = true;
      const ocr = run(observer, ["recognize", screenshot], 15000).normalize("NFC");
      writeFileSync(join(evidence, name + "-ocr.txt"), ocr + "\n");
      capture.folderReview = /Open this folder in ZCode/iu.test(ocr);
      capture.fixtureLabel = ocr.includes(targetLabel);
      capture.visiblePath = ocr.replace(/\s+/gu, "").includes(directory.replace(/\s+/gu, "").replace("☃", ""));
      if (capture.folderReview && capture.visiblePath) break;
    } catch (error) {
      capture.error = String(error.message);
    }
  }
  proof.generatedScratchState = Object.fromEntries(Object.entries(profile).map(([key, name]) => [key, readdirSync(join(scratch, name)).length]));
  assert.deepEqual(readdirSync(directory), [], "The fixture should still be empty");
} finally {
  writeFileSync(join(evidence, "proof.json"), JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
  stopApp();
}
