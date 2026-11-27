import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const [, , workspace, port] = process.argv;
const href = readFileSync(`${workspace}/evidence/emitted-route.txt`, "utf8").trim();
if (href !== "https://agent.meta.ai/chat") throw new Error("Unexpected Muse route");

const modes = new Set(["icon-and-name", "icon-only"]);
const client = `
  document.querySelector("a").addEventListener("click", event => {
    const result = { type: "touch", mode: location.pathname.slice(1),
      href: event.currentTarget.href, trusted: event.isTrusted,
      active: navigator.userActivation.isActive };
    navigator.sendBeacon("/event", JSON.stringify(result));
  }, { capture: true });
`;
createServer(async (req, res) => {
  const label = req.url.slice(1);
  if (req.method === "POST" && label === "event") {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 4096) { res.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    try {
      const entry = JSON.parse(Buffer.concat(chunks));
      if (entry.href === href && modes.has(entry.mode)) console.log(JSON.stringify(entry));
      res.writeHead(204).end();
    } catch { res.writeHead(400).end(); }
    return;
  }
  if (req.method !== "GET") { res.writeHead(405).end(); return; }
  if (label === "health") { res.writeHead(200).end(); return; }
  if (!modes.has(label)) { res.writeHead(404).end(); return; }
  console.log(JSON.stringify({ type: "view", mode: label, userAgent: req.headers["user-agent"] }));
  const image = '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#694afe"/></svg>';
  res.writeHead(200, { "content-type": "text/html;charset=UTF-8", "cache-control": "no-store" }).end(`<!doctype html>
    <html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Muse Android browser handoff</title>
    <style>body{margin:32px;font:18px sans-serif}a{display:inline-flex;align-items:center;gap:8px;padding:24px;background:#e9e4ff;border:2px solid #694afe;border-radius:8px}</style>
    </head><body><h1>Muse handoff test</h1>
    <a aria-label="Open Meta Muse" href="${href}" target="_blank" rel="noreferrer">${image}${label === "icon-only" ? "" : "Open Meta Muse"}</a>
    <script>${client}</script></body></html>`);
}).listen(Number(port), "127.0.0.1");
