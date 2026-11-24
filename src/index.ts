import { getAgentRoute } from "./catalog.js";
import type { AgentId, LinkField, Platform } from "./catalog.js";
import { iconSources } from "./generated-icons.js";

export * from "./catalog.js";

export interface LinkOptions extends Partial<Record<LinkField, string>> {
  /** Permit routes whose client behavior still needs confirmation. */
  allowExperimental?: boolean;
  /** Permit a route that submits the supplied prompt when opened. */
  allowSend?: boolean;
}

const ownerAndRepo = /^[\w.-]+\/[\w.-]+$/u;
const githubRepo = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/iu;
const hiddenPathCharacters = /[\p{Cc}\p{Cf}]/u;
const qualifiedSkill = /^[\w.@-]+(?:\/[\w.@-]+)+$/u;

function parseServerUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function getOpenCodeOrigin(url: URL): string | null {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return url.pathname === "/" && (url.protocol === "https:" || local) ? url.origin : null;
}

function encodeDirectory(directory: string): string {
  const bytes = new TextEncoder().encode(directory);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function isLocalPath(path: string): boolean {
  return (/^\/(?!\/)|^[a-z]:[\\/]/iu.test(path)) &&
    !hiddenPathCharacters.test(path) &&
    !path.split(/[\\/]/u).includes("..");
}

/**
 * Build an agent URL. Returns null for an unavailable route, invalid input,
 * or a route that requires an explicit opt-in.
 */
export function getAgentLink(
  agent: AgentId,
  platform: Platform,
  options: LinkOptions = {},
): string | null {
  const route = getAgentRoute(agent, platform);
  if (!route || (route.experimental && !options.allowExperimental) ||
    (route.behavior === "send" && !options.allowSend)) return null;

  const { allowExperimental: _allowExperimental, allowSend: _allowSend, ...fields } = options;
  for (const [field, value] of Object.entries(fields)) {
    if (value !== undefined && (typeof value !== "string" || !Object.hasOwn(route.fields ?? {}, field))) {
      return null;
    }
  }
  if (agent === "grok-bot" && fields.prompt) {
    fields.prompt = fields.prompt.replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ");
  }
  if (fields.prompt && route.promptLimit) {
    const promptLength = route.promptLimitUnit === "grapheme"
      ? Array.from(new Intl.Segmenter().segment(fields.prompt)).length
      : fields.prompt.length;
    if (promptLength > route.promptLimit) return null;
  }
  if (fields.repo && !fields.cwd && !ownerAndRepo.test(fields.repo) &&
    (agent !== "t3-code" || !githubRepo.test(fields.repo))) return null;
  if ([fields.cwd, fields.path, fields.directory, fields.folder].some((path) => path !== undefined && !isLocalPath(path))) {
    return null;
  }
  if (fields.model && !fields.provider) return null;
  if (route.launchUrl && Object.values(fields).every((value) => !value)) return route.launchUrl;
  if (route.required?.some((field) => !fields[field]?.trim())) return null;

  let baseUrl = route.url;
  if (fields.server) {
    const server = parseServerUrl(fields.server);
    if (!server) return null;
    if (agent === "opencode") {
      const origin = getOpenCodeOrigin(server);
      if (!origin) return null;
      baseUrl = fields.directory ? `${origin}/${encodeDirectory(fields.directory)}/session` : origin;
    } else {
      baseUrl = server.href;
    }
  }

  const query: string[] = [];
  for (const [field, parameter] of Object.entries(route.fields ?? {})) {
    if (!parameter) continue;
    if (field === "repo" && fields.cwd) continue;
    if (field === "originUrl" && fields.path) continue;
    const value = fields[field as LinkField];
    if (value !== undefined && value !== "") {
      const wellFormed = value.replace(/[\ud800-\udfff]/gu, "\ufffd");
      query.push(`${parameter}=${encodeURIComponent(wellFormed)}`);
    }
  }
  for (const [name, value] of Object.entries(route.query ?? {})) {
    query.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }
  const url = query.length ? `${baseUrl}?${query.join("&")}` : baseUrl;
  return route.urlLimit && url.length > route.urlLimit ? null : url;
}

/** Open Hermes Desktop's install review for a qualified skill or a direct skill URL. */
export function getHermesSkillLink(identifier: string): string | null {
  if (typeof identifier !== "string" || hiddenPathCharacters.test(identifier)) return null;
  const skill = identifier.trim().replace(/[\ud800-\udfff]/gu, "\ufffd");
  const reference = skill.startsWith("well-known:") ? skill.slice("well-known:".length) : skill;
  const isQualified = qualifiedSkill.test(skill) && !skill.split("/").some((part) => part === "." || part === "..");
  if (!isQualified) {
    try {
      const url = new URL(reference);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    } catch {
      return null;
    }
  }
  return `hermes://skill/install?identifier=${encodeURIComponent(skill)}`;
}

/** Return a self-contained SVG URL for an agent with a bundled brand asset. */
export function getAgentIcon(agent: AgentId): string | null {
  return Object.hasOwn(iconSources, agent) ? iconSources[agent] ?? null : null;
}
