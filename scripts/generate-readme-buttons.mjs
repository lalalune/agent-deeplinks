import { mkdir, readFile, writeFile } from "node:fs/promises";

const BUTTON_AGENTS = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "cursor", label: "Cursor" },
  { id: "claude-code", label: "Claude Code" },
  { id: "github-copilot", label: "GitHub Copilot" },
  { id: "gemini", label: "Gemini" },
  { id: "perplexity", label: "Perplexity" },
  { id: "grok", label: "Grok" },
  { id: "t3-code", label: "T3 Code" },
  { id: "grok-bot", label: "Grok Bot" },
  { id: "meta-ai", label: "Meta AI" },
  { id: "codex", label: "Codex" },
  { id: "antigravity", label: "Antigravity" },
  { id: "grok-build", label: "Grok Build" },
  { id: "kimi", label: "Kimi" },
  { id: "kimi-code", label: "Kimi Code" },
  { id: "meta-muse", label: "Meta Muse" },
  { id: "zcode", label: "ZCode" },
  { id: "openclaw", label: "OpenClaw" },
  { id: "opencode", label: "OpenCode" },
  { id: "hermes", label: "Hermes Agent" },
];

// Calibrated average character widths (px) for 13px font-weight 500 system sans-serif.
const CHAR_WIDTHS = {
  " ": 3.8,
  i: 3.4, l: 3.4, I: 3.8, j: 3.4, f: 4.4, t: 4.6, r: 4.8,
  "1": 6.4, "3": 7.6,
  c: 6.9, e: 7.2, s: 6.6, z: 6.6, k: 7.0, v: 6.8, x: 6.8, y: 6.9,
  a: 7.2, b: 7.6, d: 7.6, g: 7.5, h: 7.5, n: 7.5, o: 7.6, p: 7.6, q: 7.6, u: 7.5,
  m: 11.2, w: 9.9,
  A: 8.6, B: 8.4, C: 9.1, D: 9.2, E: 7.8, F: 7.5, G: 9.6, H: 9.4, J: 6.8,
  K: 8.6, L: 7.3, M: 11.0, N: 9.4, O: 9.9, P: 8.2, Q: 9.9, R: 8.6, S: 8.2,
  T: 7.9, U: 9.2, V: 8.5, W: 12.2, X: 8.5, Y: 8.2, Z: 8.1,
};

function measureTextWidth(text) {
  let width = 0;
  for (const ch of text) {
    width += CHAR_WIDTHS[ch] ?? 7.6;
  }
  return Math.ceil(width);
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseIconSvg(raw, id) {
  const cleaned = raw
    .replace(/^\s*<\?xml[^?]*\?>/u, "")
    .replace(/<!--[\s\S]*?-->/gu, "")
    .trim();

  const openTagMatch = cleaned.match(/^<svg\b([^>]*)>/iu);
  if (!openTagMatch || !cleaned.endsWith("</svg>")) {
    throw new Error(`Invalid SVG structure in icons/${id}.svg`);
  }

  const attrs = openTagMatch[1] ?? "";
  const viewBox = attrs.match(/\bviewBox\s*=\s*["']([^"']+)["']/iu)?.[1];
  if (!viewBox) {
    throw new Error(`Missing viewBox in icons/${id}.svg`);
  }

  const rootFill = attrs.match(/\bfill\s*=\s*["']([^"']+)["']/iu)?.[1];
  let inner = cleaned
    .slice(openTagMatch[0].length, -"</svg>".length)
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/giu, "")
    .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/giu, "")
    .trim();

  // Replace currentColor so standalone <img> rendering stays crisp on the white tile.
  const effectiveFill = rootFill ? rootFill.replace(/currentColor/giu, "#111114") : "#111114";
  inner = inner.replace(/currentColor/giu, "#111114");

  // Namespace internal IDs to prevent any collision with outer SVG elements.
  const prefix = `ic_${id.replace(/[^a-z0-9]/giu, "_")}_`;
  const ids = new Set([...inner.matchAll(/\bid="([^"]+)"/gu)].map((m) => m[1]));
  for (const oldId of ids) {
    const newId = `${prefix}${oldId}`;
    inner = inner
      .replaceAll(`id="${oldId}"`, `id="${newId}"`)
      .replaceAll(`url(#${oldId})`, `url(#${newId})`)
      .replaceAll(`href="#${oldId}"`, `href="#${newId}"`);
  }

  return { viewBox, fill: effectiveFill, inner };
}

function buildButtonSvg({ id, label }, iconRaw) {
  const { viewBox, fill, inner } = parseIconSvg(iconRaw, id);
  const textWidth = measureTextWidth(label);
  const width = 37 + textWidth + 13;
  const height = 36;
  const safeLabel = escapeXml(label);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${safeLabel}">`,
    `  <title>${safeLabel}</title>`,
    `  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="#111114" stroke="#27272a" stroke-width="1"/>`,
    `  <rect x="7" y="7" width="22" height="22" rx="5" fill="#ffffff"/>`,
    `  <svg x="10" y="10" width="16" height="16" viewBox="${viewBox}" fill="${fill}" preserveAspectRatio="xMidYMid meet" overflow="hidden">`,
    `    ${inner}`,
    `  </svg>`,
    `  <text x="37" y="22.5" fill="#fafafa" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="13" font-weight="500">${safeLabel}</text>`,
    `</svg>`,
    "",
  ].join("\n");
}

const iconsDir = new URL("../icons/", import.meta.url);
const outDir = new URL("../assets/readme-buttons/", import.meta.url);
await mkdir(outDir, { recursive: true });

for (const agent of BUTTON_AGENTS) {
  const raw = await readFile(new URL(`${agent.id}.svg`, iconsDir), "utf8");
  const svg = buildButtonSvg(agent, raw);
  if (/<!|<\s*(?:script|foreignObject)\b|\son[a-z]+\s*=|\b(?:href|src)\s*=\s*['"](?!#)/iu.test(svg)) {
    throw new Error(`Generated unsafe SVG for ${agent.id}`);
  }
  await writeFile(new URL(`${agent.id}.svg`, outDir), svg, "utf8");
}

console.log(`Generated ${BUTTON_AGENTS.length} README button SVGs in assets/readme-buttons/`);
