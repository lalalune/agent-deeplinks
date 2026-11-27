import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const qa = process.env.QA_DIR;
const evidence = join(qa, "evidence");
const executable = "/opt/Grok Bot/grok-bot";
const pkg = join(qa, "npm", "package");
const { getAgentLink } = await import(pathToFileURL(join(pkg, "dist", "index.js")));
assert.equal(JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).version, "0.1.67");
const marketplace = getAgentLink("grok-bot", "desktop", { action: "plugin", target: "674" });
const uri = getAgentLink("grok-bot", "desktop", { action: "team-plugin", target: "674" });
assert.equal(marketplace, "https://x.ai/bot/plugin/674");
assert.equal(uri, "grokbot://app/v1/plugin/add?id=674");
const publicListing = readFileSync(join(qa, "slack.html"), "utf8");
assert.ok(publicListing.includes(uri));
const scheme = "x-scheme-handler/grokbot";

function run(command, args) {
  const out = spawnSync(command, args, { encoding: "utf8", timeout: 5500 });
  return { status: out.status, stdout: out.stdout?.trim(), stderr: out.stderr?.trim() };
}

function applications() {
  return readdirSync("/proc").filter(pid => /^\d+$/u.test(pid)).flatMap(pid => {
    try {
      if (readlinkSync(`/proc/${pid}/exe`) !== executable) return [];
      if (!readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").includes(`HOME=${process.env.HOME}`)) return [];
      const argv = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
      return argv.some(arg => arg.startsWith("--type=")) ? [] : [{ pid: Number(pid), argv }];
    } catch {
      return [];
    }
  });
}

const proof = { version: "0.1.67", appVersion: "1.3.0", marketplace, exactAdvertisedNativeUri: uri,
  accountUsed: false, pluginControlActivated: false, sent: false,
  xdg: run("xdg-mime", ["query", "default", scheme]), gio: run("gio", ["mime", scheme]) };

function capture(name, processes) {
  const windows = run("wmctrl", ["-lp"]).stdout?.split("\n") ?? [];
  const window = windows.find(line => processes.some(proc => proc.pid === Number(line.trim().split(/\s+/u)[2])));
  if (!window) return undefined;
  const image = join(evidence, name + ".png");
  if (run("scrot", ["--overwrite", "--window", window.trim().split(/\s+/u)[0], image]).status !== 0) return undefined;
  if (!existsSync(image)) return undefined;
  const text = run("tesseract", [image, "stdout", "--psm", "11"]).stdout;
  return { window, image: name + ".png", text };
}

const children = [];
let recoverable = true;
try {
  assert.equal(proof.xdg.stdout, "grok-bot.desktop");
  assert.match(proof.gio.stdout, /Default application[^\n]+grok-bot\.desktop/u);
  assert.equal(applications().length, 0);
  const cold = spawn("xdg-open", [uri], { stdio: "ignore" });
  children.push(cold);
  const until = Date.now() + 35000;
  while (Date.now() < until) {
    const installed = applications();
    proof.coldReceiver ??= installed.find(({ argv }) => argv.some(arg => arg === uri || arg.endsWith(" " + uri)));
    if (proof.coldReceiver) {
      const frame = capture("cold-checkpoint", [proof.coldReceiver]);
      if (frame) {
        proof.coldWindow = frame;
        if (/Slack|Sign in|Log in/iu.test(frame.text ?? "")) break;
      }
    }
    await delay(480);
  }
  assert.ok(proof.coldReceiver, "Stock XDG did not start Grok Bot with the exact URI");
  assert.ok(proof.coldWindow, "The launched process had no capturable window");
  const warm = spawn("strace", ["-f", "-e", "trace=execve", "-s", "2048", "-o", join(evidence, "warm-execve.txt"),
    "xdg-open", uri], { stdio: "ignore" });
  children.push(warm);
  await delay(4500);
  const warmProcesses = applications();
  proof.warmReusedWindow = warmProcesses.length === 1 && warmProcesses[0].pid === proof.coldReceiver.pid;
  proof.warmWindow = capture("warm-checkpoint", warmProcesses);
  const warmTrace = readFileSync(join(evidence, "warm-execve.txt"), "utf8");
  proof.warmExactShellDelivery = warmTrace.split("\n").some(line => line.includes(executable) && line.includes(uri));
  assert.ok(proof.warmExactShellDelivery, "Warm XDG did not launch the stock handler with the exact URI");
  assert.ok(proof.warmReusedWindow, "The warm launch did not reuse the existing app process");
  assert.ok(proof.warmWindow);
} catch (error) {
  recoverable = false;
  proof.error = String(error);
} finally {
  writeFileSync(join(evidence, "proof.json"), JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof));
  for (const child of children) child.kill();
  for (const { pid } of applications()) {
    try { process.kill(pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  }
}
if (!recoverable) process.exitCode = 1;
