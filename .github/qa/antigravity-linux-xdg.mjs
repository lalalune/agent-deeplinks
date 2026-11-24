import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const href = process.argv[2];
const executable = process.env.ANTIGRAVITY_QA_EXE;
const evidence = join(process.env.RUNNER_TEMP, "antigravity-linux", "evidence");
const processEvidence = { href, executable, matchingProcess: null, nativeWindow: null, signedIn: false, submitted: false };

function discoverDispatchedProcess() {
  for (const id of readdirSync("/proc").filter((entry) => /^\d+$/u.test(entry))) {
    try {
      const argv = readFileSync(join("/proc", id, "cmdline"), "utf8").split("\0").filter(Boolean);
      if (argv[0] === executable && argv.includes(href) && !argv.some((arg) => arg.startsWith("--type="))) {
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
    if (processEvidence.matchingProcess) {
      const windows = execFileSync("wmctrl", ["-lp"], { encoding: "utf8", timeout: 4_000 });
      const match = windows.split("\n").find((row) => {
        const [, , id] = row.trim().split(/\s+/u);
        return Number(id) === processEvidence.matchingProcess.id && /antigravity/iu.test(row);
      });
      if (match) {
        processEvidence.nativeWindow = match;
        await sleep(1600);
        const [id] = match.trim().split(/\s+/u);
        execFileSync("import", ["-window", id, join(evidence, "native-window.png")], { timeout: 7_000 });
      }
    }
    if (!processEvidence.nativeWindow) await sleep(500);
  }
  assert.ok(processEvidence.matchingProcess, "xdg-open did not produce a stock process with the exact URI");
  assert.ok(processEvidence.nativeWindow, "The stock process opened no managed Antigravity window");
} finally {
  writeFileSync(join(evidence, "xdg-link-proof.json"), JSON.stringify(processEvidence, null, 2));
  console.log(JSON.stringify(processEvidence, null, 2));
}
