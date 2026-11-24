import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const href = process.argv[2];
const executable = process.env.ANTIGRAVITY_QA_EXE;
const evidence = join(process.env.RUNNER_TEMP, "antigravity-linux", "evidence");
const processEvidence = { href, executable, matchingProcess: null, nativeWindow: null, enumeratedWindows: [], exactVendorLog: false, signedIn: false, submitted: false };

function discoverDispatchedProcess() {
  for (const id of readdirSync("/proc").filter((entry) => /^\d+$/u.test(entry))) {
    try {
      const argv = readFileSync(join("/proc", id, "cmdline"), "utf8").split("\0").filter(Boolean);
      if (readlinkSync(join("/proc", id, "exe")) === executable && argv.includes(href) && !argv.some((arg) => arg.startsWith("--type="))) {
        return { id: Number(id), argv };
      }
    } catch {
      // A process can exit between listing and reading /proc.
    }
  }
  return null;
}

try {
  for (let i = 0; i < 120 && !processEvidence.nativeWindow; i++) {
    processEvidence.matchingProcess ??= discoverDispatchedProcess();
    const output = readFileSync(join(evidence, "xdg-open.log"), "utf8");
    processEvidence.exactVendorLog = output.split("\n").some((line) => line.endsWith("Launched with deep link: " + href));
    const windows = execFileSync("wmctrl", ["-lp"], { encoding: "utf8", timeout: 4_000 });
    processEvidence.enumeratedWindows = windows.split("\n").filter(Boolean);
    const match = processEvidence.enumeratedWindows.find((row) => {
      const [, , pid] = row.trim().split(/\s+/u);
      if (!/antigravity/iu.test(row) || !/^\d+$/u.test(pid)) return false;
      try {
        return readlinkSync(join("/proc", pid, "exe")) === executable;
      } catch {
        return false;
      }
    });
    if (match && processEvidence.exactVendorLog) {
      processEvidence.nativeWindow = match;
      await sleep(2500);
      const [id] = match.trim().split(/\s+/u);
      execFileSync("import", ["-window", id, join(evidence, "native-window.png")], { timeout: 7_000 });
    }
    if (!processEvidence.nativeWindow) await sleep(500);
  }
  assert.ok(processEvidence.exactVendorLog, "The stock application did not report receipt of the exact XDG URI");
  assert.ok(processEvidence.nativeWindow, "The stock process opened no managed Antigravity window");
} finally {
  writeFileSync(join(evidence, "xdg-link-proof.json"), JSON.stringify(processEvidence, null, 2));
  console.log(JSON.stringify(processEvidence, null, 2));
}
