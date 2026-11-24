import { getAgentRoute } from "./catalog.js";
import type { AgentId, LinkField, Platform } from "./catalog.js";
import { iconSources } from "./generated-icons.js";

export * from "./catalog.js";

export interface LinkOptions extends Partial<Record<LinkField, string>> {
  /** Permit routes whose client behavior still needs confirmation. */
  allowExperimental?: boolean;
  /** Permit a route that submits the supplied prompt when opened. */
  allowSend?: boolean;
  /** Apply the provider's iOS Universal Link exclusion when available. */
  browserOnly?: boolean;
}

const ownerAndRepo = /^[\w.-]+\/[\w.-]+$/u;
const conversationId = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu;
const githubRepo = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/iu;
const hiddenPathCharacters = /[\p{Cc}\p{Cf}]/u;
const qualifiedSkill = /^[\w.@-]+(?:\/[\w.@-]+)+$/u;
const invalidSessionId = /[\\/\u0000]|\.\./u;
const openCodePairingUrl = /^([A-Za-z]+:\/\/[^/@\\?#]+)\/auth\/connect\/([A-Za-z0-9_-]+)$/u;
const sshHostPattern = /^(?:[A-Za-z0-9._][A-Za-z0-9._-]{0,63}@)?([A-Za-z0-9.:_][A-Za-z0-9.:_-]{0,252})$/u;
const sshFolderCharacters = /^[\p{L}\p{N}\p{M}\p{P} +<=>^`|~$]+$/u;
const excludedSshFolderCharacters = /[\\'\u2018-\u201b\p{Default_Ignorable_Code_Point}\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff\u{10800}-\u{10fff}\u{1e800}-\u{1efff}\u{13441}\u{13442}\u{16910}\u{16fe4}]/u;

function parseServerUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function isOpenClawLocalHost(hostname: string): boolean {
  // Apply OpenClaw's plaintext policy to the canonical hostname returned by URL.
  const host = hostname.replace(/\.$/u, "");
  if (["localhost", "0.0.0.0", "::", "::1"].includes(host) || host.endsWith(".local")) return true;
  if (/^(?:f[cd][\da-f]{2}:|fe[89ab][\da-f]:|::ffff:7f[\da-f]{2}:)/u.test(host)) return true;
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/u.test(host)) return false;
  const [first, second = 0] = host.split(".").map(Number);
  return first === 10 || first === 127 || (first === 192 && second === 168) ||
    (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31);
}

function getOpenClawGatewayLink(address: string, platform: "desktop" | "ios"): string | null {
  const match = /^(?:https?|wss?):\/\/([^/\s@\\?#]+)(\/[^\\?#]*)?$/iu.exec(address);
  if (!match || hiddenPathCharacters.test(address)) return null;
  let gateway: URL;
  try {
    gateway = new URL(address);
  } catch {
    return null;
  }
  if (gateway.port === "0") return null;
  if (platform === "desktop") {
    return gateway.protocol === "https:"
      ? `openclaw://gateway/add?url=${encodeURIComponent(gateway.href)}`
      : null;
  }
  const [, authority = "", path] = match;
  if (path && path !== "/") return null;
  const tls = gateway.protocol === "https:" || gateway.protocol === "wss:";
  const host = gateway.hostname.replace(/^\[|\]$/gu, "");
  if (!tls && !isOpenClawLocalHost(host)) return null;
  // The URL parser removes an explicit default scheme port, which the native setup form still needs.
  const explicitPort = /:(\d+)$/u.exec(authority)?.[1];
  const port = explicitPort === undefined ? (tls ? 443 : 18789) : Number(explicitPort);
  return `openclaw://gateway?host=${encodeURIComponent(host)}&port=${port}&tls=${tls ? 1 : 0}`;
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

function isSshFolder(folder: string): boolean {
  const withoutMarks = folder.replace(/\p{M}+/gu, "");
  return /^(?:\/(?!\/)|~(?:\/|$))/u.test(folder) &&
    folder.length <= 1024 && withoutMarks === withoutMarks.trim() &&
    !/^\/\.(?:vol|file)(?:\/|$)/iu.test(folder) &&
    sshFolderCharacters.test(folder) && !excludedSshFolderCharacters.test(folder) &&
    !folder.split("/").includes("..") && !/\p{M}{4,}/u.test(folder) && !/ {3}/u.test(withoutMarks) &&
    (folder.match(/ /gu)?.length ?? 0) <= 8;
}

function isSshTarget(host: string, port?: string, folder?: string): boolean {
  const hostname = sshHostPattern.exec(host)?.[1];
  if (!hostname || hiddenPathCharacters.test(host)) return false;
  // Match Claude Desktop’s check for host values that resemble JSON scalars.
  try {
    if (String(JSON.parse(host)) !== host) return false;
  } catch {
    // Ordinary hostnames are not JSON values.
  }
  if (port && (!/^[1-9]\d{0,4}$/u.test(port) || Number(port) > 65535 || /^[^:]+:\d+$/u.test(hostname))) return false;
  return !folder || isSshFolder(folder);
}

function parseWorkspaceUri(value: string): URL | null {
  if (value !== value.trim() || hiddenPathCharacters.test(value) ||
    !/^(?:file:\/|vscode-remote:\/\/)/iu.test(value)) return null;
  try {
    const url = new URL(value);
    if (!url.pathname.startsWith("/") || url.username || url.password || url.search || url.hash) return null;
    return url.protocol === "file:" || (url.protocol === "vscode-remote:" && url.hostname !== "") ? url : null;
  } catch {
    return null;
  }
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
  if (!route) return null;

  const { allowExperimental: _allowExperimental, allowSend: _allowSend, browserOnly, ...fields } = options;
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
  if ((fields.sshHost || fields.sshPort || fields.sshFolder) &&
    (fields.folder || !isSshTarget(fields.sshHost ?? "", fields.sshPort, fields.sshFolder))) return null;
  if (fields.model && !fields.provider) return null;
  if (fields.mode && !route.modes?.includes(fields.mode)) return null;
  if (fields.branch && (!fields.repo || hiddenPathCharacters.test(fields.branch))) return null;
  if (fields.session && invalidSessionId.test(fields.session)) return null;
  if (fields.workspace) {
    const workspace = parseWorkspaceUri(fields.workspace);
    if (!workspace) return null;
    fields.workspace = workspace.href;
  }
  if (fields.pr && (!fields.repo || fields.branch || !/^[1-9]\d*$/u.test(fields.pr) ||
    !Number.isSafeInteger(Number(fields.pr)))) return null;
  if (fields.customAgent &&
    (fields.repo || !fields.customAgent.trim() || hiddenPathCharacters.test(fields.customAgent))) return null;
  const fragment = browserOnly && route.browserOnlyFragment
    ? `#${encodeURIComponent(route.browserOnlyFragment)}`
    : "";
  if (route.launchUrl && Object.values(fields).every((value) => !value)) return `${route.launchUrl}${fragment}`;
  if ((route.experimental && !options.allowExperimental) ||
    (route.behavior === "send" && !options.allowSend)) return null;
  if (route.sessionUrl && fields.session) {
    if (!conversationId.test(fields.session) ||
      Object.entries(fields).some(([field, value]) => field !== "session" && value)) return null;
    return `${route.sessionUrl}/${fields.session}`;
  }
  if (agent === "openclaw" && (platform === "desktop" || platform === "ios") && fields.server) {
    return fields.prompt ? null : getOpenClawGatewayLink(fields.server, platform);
  }
  if (route.required?.some((field) => !fields[field]?.trim())) return null;
  if (agent === "github-copilot" && platform !== "vscode" &&
    !fields.repo && !fields.prompt?.trim() && !fields.customAgent?.trim()) return null;

  let baseUrl = route.launcher?.appUrl ?? route.url;
  if (fields.server) {
    const server = parseServerUrl(fields.server);
    if (!server) return null;
    if (agent === "opencode") {
      const origin = getOpenCodeOrigin(server);
      if (!origin) return null;
      baseUrl = fields.directory ? `${origin}/${encodeDirectory(fields.directory)}/session` : origin;
    } else if (agent === "t3-code") {
      if (server.pathname !== "/") return null;
      baseUrl = `${server.origin}/new`;
    } else {
      baseUrl = server.href;
    }
  }

  const query: string[] = [];
  for (const [field, parameter] of Object.entries(route.fields ?? {})) {
    if (!parameter) continue;
    if (field === "repo" && fields.cwd) continue;
    const value = fields[field as LinkField];
    if (value !== undefined && value !== "") {
      const wellFormed = value.replace(/[\ud800-\udfff]/gu, "\ufffd");
      const encoded = encodeURIComponent(wellFormed);
      query.push(`${parameter}=${route.encodeQueryValuesTwice ? encodeURIComponent(encoded) : encoded}`);
    }
  }
  for (const [name, value] of Object.entries(route.query ?? {})) {
    query.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }
  const parameters = query.length ? `?${query.join("&")}` : "";
  const target = `${baseUrl}${parameters}${fragment}`;
  const url = route.launcher
    ? `${route.url}?${encodeURIComponent(route.launcher.parameter)}=${encodeURIComponent(target)}`
    : target;
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

/** Convert an OpenCode CLI pairing URL to the Android app's native pairing review. */
export function getOpenCodeAndroidPairingLink(pairingUrl: string): string | null {
  if (typeof pairingUrl !== "string" || hiddenPathCharacters.test(pairingUrl)) return null;
  const [, address, code] = openCodePairingUrl.exec(pairingUrl.trim()) ?? [];
  if (!address || !code) return null;
  const server = parseServerUrl(address);
  if (!server || server.port === "0") return null;
  return `opencode://pair?code=${code}&url=${encodeURIComponent(server.origin)}`;
}

/** Return a self-contained SVG URL for an agent with a bundled brand asset. */
export function getAgentIcon(agent: AgentId): string | null {
  return Object.hasOwn(iconSources, agent) ? iconSources[agent] ?? null : null;
}
