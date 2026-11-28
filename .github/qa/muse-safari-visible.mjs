import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const [output, probe, packagePath, installation, variantName] = process.argv.slice(2);
const run = (program, args) => execFileSync(program, args, { encoding: "utf8", timeout: 30000 }).trim();
const field = (app, key) => run("/usr/bin/plutil", ["-extract", key, "raw", join(app, "Contents/Info.plist")]);
const signedMuse = await realpath(installation);
const published = JSON.parse(await readFile(join(packagePath, "package.json"), "utf8"));
const { getAgentLink } = await import(pathToFileURL(join(packagePath, "dist/index.js")));
const icon = await readFile(join(packagePath, "icons/meta-muse.svg"));
const uri = getAgentLink("meta-muse", "desktop");
assert.equal(published.version, "0.1.70");
assert.equal(uri, "https://agent.meta.ai/chat");

const safari = "/Applications/Safari.app";
run("/usr/bin/codesign", ["--verify", "--strict", safari]);
const proof = {
  stage: "stock Safari fixture",
  packageVersion: published.version,
  exactNpmURL: uri,
  safariVersion: field(safari, "CFBundleShortVersionString"),
  museInstallation: signedMuse,
  museVersion: field(signedMuse, "CFBundleShortVersionString"),
  variants: {},
  consentOrAccountSubmitted: false,
};
const expectedResult = "Safari cold-launched the signed Muse app and showed its sign-in surface";
const variants = {
  "new-tab": { target: "_blank", rel: "noopener noreferrer", marker: "Open Meta Muse in Safari" },
  "same-tab": { target: "_self", rel: "", marker: "Launch Meta Muse from Safari" },
};
const state = () => JSON.parse(run(probe, ["state"]));

function capture(name, windowId) {
  const image = join(output, name + ".png");
  const target = windowId === undefined ? ["-m"] : ["-l", String(windowId)];
  run("/usr/sbin/screencapture", ["-x", ...target, image]);
  const ocr = run(probe, ["ocr", image]);
  return { image, ocr };
}

const server = createServer(async (incoming, response) => {
  const requestURL = new URL(incoming.url, "http://127.0.0.1");
  const variant = variants[requestURL.pathname.slice(1)];
  if (incoming.method === "POST" && requestURL.pathname === "/activation") {
    let body = "";
    for await (const chunk of incoming) body += chunk;
    const evidence = JSON.parse(body);
    if (Object.hasOwn(proof.variants, evidence.name)) proof.variants[evidence.name].activation = evidence;
    response.writeHead(204).end();
    return;
  }
  if (incoming.method === "GET" && requestURL.pathname === "/meta-muse.svg") {
    response.writeHead(200, { "content-type": "image/svg+xml" }).end(icon);
    return;
  }
  if (incoming.method !== "GET" || !variant) {
    response.writeHead(404).end();
    return;
  }

  const name = requestURL.pathname.slice(1);
  proof.variants[name].safariUserAgent = incoming.headers["user-agent"];
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(`<!DOCTYPE html><html lang="en"><meta charset="utf-8"><title>Muse Safari click fixture</title>
    <style>body{background:#f5ead4;font:24px -apple-system;margin:36px}a{display:inline-flex;align-items:center;gap:12px;background:#242944;color:#fff;text-decoration:none;font-size:30px;padding:25px 35px;border-radius:12px}</style>
    <h1>Muse handoff fixture</h1><a href="${uri}" target="${variant.target}" rel="${variant.rel}"><img src="/meta-muse.svg" width="25" height="25" alt="">${variant.marker}</a>
    <script>
      const link = document.querySelector("a");
      link.addEventListener("click", event => {
        navigator.sendBeacon("/activation", JSON.stringify({
          name: ${JSON.stringify(name)}, href: link.href, target: link.target, rel: link.rel,
          trusted: event.isTrusted, active: navigator.userActivation.isActive,
        }));
      }, { once: true });
    </script></html>`);
});

async function stopExactMuse() {
  for (const app of state().muse) {
    assert.equal(app.path, signedMuse);
    process.kill(app.pid);
  }
  for (let sample = 0; sample < 32; sample++) {
    if (state().muse.length === 0) return;
    await wait(250);
  }
  assert.deepEqual(state().muse, []);
}

try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  assert.deepEqual(state().muse, [], "Muse must be stopped after associated-domain approval");
  for (const [name, variant] of Object.entries(variants).filter(([key]) => key === variantName)) {
    proof.stage = name;
    const observation = { fixture: variant };
    proof.variants[name] = observation;
    run("/usr/bin/open", ["-a", safari, `http://127.0.0.1:${server.address().port}/${name}`]);
    for (let sample = 0; sample < 28; sample++) {
      await wait(500);
      observation.before = state();
      if (observation.before.frontmost.bundleId !== "com.apple.Safari" || !observation.before.frontmostOwnedVisibleWindows.length) continue;
      const screenshot = capture(`${name}-before`);
      observation.beforeOCR = screenshot.ocr;
      if (!screenshot.ocr.split("\n").includes(variant.marker)) continue;
      assert.deepEqual(state().muse, []);
      observation.pointer = JSON.parse(run(probe, ["click", screenshot.image, variant.marker]));
      break;
    }
    if (!observation.pointer) {
      observation.result = "no visible Safari fixture button";
      continue;
    }

    for (let sample = 0; sample < 26; sample++) {
      await wait(500);
      observation.after = state();
      const front = observation.after.frontmost;
      if (front.bundleId === "com.meta.endo" && front.path === signedMuse && observation.after.frontmostOwnedVisibleWindows.length) break;
    }

    const screenshot = capture(`${name}-after`);
    observation.afterOCR = screenshot.ocr;
    assert.deepEqual(observation.activation, {
      name, href: uri, target: variant.target, rel: variant.rel, trusted: true, active: true,
    });
    assert.match(observation.safariUserAgent, /Version\/[\d.]+ Safari\/[\d.]+/u);
    const signedNativeWindow = observation.after.frontmost.bundleId === "com.meta.endo" &&
      observation.after.frontmost.path === signedMuse && observation.after.frontmostOwnedVisibleWindows.length;
    if (signedNativeWindow) {
      for (let sample = 0; sample < 12; sample++) {
        const current = state();
        const [window] = current.frontmostOwnedVisibleWindows;
        if (window && current.frontmost.bundleId === "com.meta.endo") {
          try {
            observation.nativeWindowOCR = capture(`${name}-muse-window`, window.id).ocr;
          } catch (error) {
            observation.nativeWindowCaptureError = String(error);
          }
        }
        if (/(?:Welcome to Muse|Log in|sign in|create an account)/iu.test(observation.nativeWindowOCR ?? "")) break;
        await wait(500);
      }
    }
    if (signedNativeWindow && /(?:Welcome to Muse|Log in|sign in|create an account)/iu.test(observation.nativeWindowOCR ?? "")) {
      observation.result = expectedResult;
    } else if (observation.after.frontmost.bundleId === "com.apple.Safari" && observation.after.muse.length === 0 &&
      /muse\.ai/iu.test(screenshot.ocr) && /(?:Welcome to Muse|Log in|create an account|Meet Muse)/iu.test(screenshot.ocr)) {
      observation.result = "Safari stayed in the browser and showed the Muse website";
    } else {
      observation.result = "click delivered with trusted activation; destination unconfirmed";
    }
    await stopExactMuse();
  }
  proof.stage = "complete";
  assert.equal(proof.variants[variantName].result, expectedResult, "Safari-to-Muse sign-in checkpoint");
} catch (error) {
  proof.error = String(error);
  throw error;
} finally {
  server.closeAllConnections();
  server.close();
  await writeFile(join(output, "proof.json"), JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}
