import { getAgentRoute } from "./catalog.js";
import type { AgentActionField, AgentActionId, AgentId, AgentRoute, LinkField, Platform } from "./catalog.js";
import { getActionDefinition } from "./actions.js";
import { iconSources } from "./generated-icons.js";

export * from "./catalog.js";

export interface LinkOptions extends Partial<Record<LinkField | AgentActionField, string>> {
  /** Open an app, plugin, skill, or other provider-specific destination. */
  action?: AgentActionId;
  /** Permit routes whose client behavior still needs confirmation. */
  allowExperimental?: boolean;
  /** Permit a route that submits the supplied prompt when opened. */
  allowSend?: boolean;
  /** Apply the provider's iOS Universal Link exclusion when available. */
  browserOnly?: boolean;
}

const ownerAndRepo = /^[\w.-]+\/[\w.-]+$/u;
const conversationId = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu;
const cursorCloudAgentUrl = /^https:\/\/cursor\.com(\/(?:t\/[a-z0-9_-]+\/)?agents\/(bc-[\da-f-]+))\/?(?:[?#][^\s]*)?$/iu;
const grokBuildCloudAgentUrl = /^https:\/\/grok\.com(\/build(?:\/t\/[a-z0-9_-]+)?\/(bc-[\da-fA-F-]+))\/?(?:[?#][^\s]*)?$/u;
const codexCloudTaskId = /^task_[A-Za-z0-9_-]+$/u;
const codexCloudTaskPath = /^https:\/\/chatgpt\.com(?:\/app)?(\/codex\/(?:cloud\/)?tasks\/[A-Za-z0-9_-]+)\/?(?:[?#][^\s]*)?$/u;
const claudeCodeCloudSessionId = /^(?:session|cse)_[A-Za-z0-9_-]+$/u;
const githubRepo = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/iu;
const hiddenPathCharacters = /[\p{Cc}\p{Cf}]/u;
const invalidSessionId = /[\\/\u0000]|\.\./u;
const copiedCodexThreadUrl = /^codex:\/\/threads\/([a-fA-F\d-]+)\?hostId=([A-Za-z\d._*%\-]+)$/u;
const opaqueCodexHostId = /^(?:[a-zA-Z0-9._:~!*'()-]|%[a-fA-F0-9]{2})+$/u;
const sshHostPattern = /^(?:[A-Za-z0-9._][A-Za-z0-9._-]{0,63}@)?([A-Za-z0-9.:_][A-Za-z0-9.:_-]{0,252})$/u;
const sshFolderCharacters = /^[\p{L}\p{N}\p{M}\p{P} +<=>^`|~$]+$/u;
const excludedSshFolderCharacters = /[\\'\u2018-\u201b\p{Default_Ignorable_Code_Point}\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff\u{10800}-\u{10fff}\u{1e800}-\u{1efff}\u{13441}\u{13442}\u{16910}\u{16fe4}]/u;

function getCopiedCodexThreadLink(value: string): string | null {
  const [, id = "", encodedHostId] = copiedCodexThreadUrl.exec(value) ?? [];
  if (!encodedHostId || !conversationId.test(id) || hiddenPathCharacters.test(value)) return null;
  const query = `hostId=${encodedHostId}`;
  const params = new URLSearchParams(query);
  const hostId = params.get("hostId");
  return hostId && hostId !== "local" && opaqueCodexHostId.test(hostId) && params.toString() === query
    ? value
    : null;
}

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

function getOpenClawBrowserTarget(address: string, sessionAddress: string | undefined, hasDraft: boolean): string | null {
  const gateway = parseServerUrl(address);
  if (!gateway) return null;
  if (!sessionAddress && !hasDraft) return gateway.href;

  const basePath = gateway.pathname.replace(/\/+$/u, "");
  if (!sessionAddress) return `${gateway.origin}${basePath}/chat`;

  const target = sessionAddress.trim();
  const galleryQuery = "?dashboard=expanded";
  const fromGallery = target.endsWith(galleryQuery);
  const session = parseServerUrl(fromGallery ? target.slice(0, -galleryQuery.length) : target);
  if (!session || session.origin !== gateway.origin || !session.pathname.startsWith(`${basePath}/`)) return null;

  const sessionPath = session.pathname.slice(basePath.length);
  if (sessionPath.startsWith("/beam/")) {
    const beam = /^\/beam\/(?:([a-z0-9]+(?:-[a-z0-9]+)*)-)?[a-f0-9]{12,32}$/u.exec(sessionPath);
    return beam && (beam[1]?.length ?? 0) <= 48 && !fromGallery && !hasDraft ? session.href : null;
  }
  const route = /^\/(chat|dashboard|focus\/dashboard)\/[^/]/u.exec(sessionPath)?.[1];
  if (!route || (fromGallery && route !== "chat") || (hasDraft && route === "focus/dashboard")) return null;
  if (fromGallery && hasDraft) {
    return `${session.origin}${basePath}/dashboard${sessionPath.slice("/chat".length)}`;
  }
  return `${session.origin}${session.pathname}${fromGallery ? galleryQuery : ""}`;
}

function encodeT3ThreadSegment(value: string | undefined): string | null {
  const id = value?.trim();
  if (!id || id === "." || id === ".." || hiddenPathCharacters.test(id)) return null;
  try {
    return encodeURIComponent(id).replace(/[.!~*'()]/gu,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  } catch {
    return null;
  }
}

function encodeLinkValue(value: string): string {
  return encodeURIComponent(value.replace(/[\ud800-\udfff]/gu, "\ufffd"));
}

function getLinkParameters(
  route: Pick<AgentRoute, "encodeQueryValuesTwice" | "query"> & { fields?: Readonly<Record<string, string | undefined>> },
  fields: Readonly<Record<string, string | undefined>>,
  baseUrl: string,
): string {
  const query: string[] = [];
  for (const [field, parameter] of Object.entries(route.fields ?? {})) {
    if (!parameter || (field === "repo" && fields.cwd)) continue;
    const value = fields[field];
    if (value !== undefined && value !== "") {
      const encoded = encodeLinkValue(value);
      query.push(`${parameter}=${route.encodeQueryValuesTwice ? encodeURIComponent(encoded) : encoded}`);
    }
  }
  for (const [name, value] of Object.entries(route.query ?? {})) {
    query.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }
  return query.length ? `${baseUrl.includes("?") ? "&" : "?"}${query.join("&")}` : "";
}

function getOpenCodeOrigin(url: URL): string | null {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return url.pathname === "/" && (url.protocol === "https:" || local) ? url.origin : null;
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function isOpenCodeSessionId(session: string): boolean {
  return session.startsWith("ses") && !/[^A-Za-z0-9_-]/u.test(session);
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
  const { action, allowExperimental, allowSend, browserOnly, ...fields } = options;
  const actionRoute = action === undefined ? undefined : getActionDefinition(agent, platform, action);
  const route = action === undefined ? getAgentRoute(agent, platform) : actionRoute;
  if (!route) return null;

  for (const [field, value] of Object.entries(fields)) {
    if (value !== undefined && (typeof value !== "string" || !Object.hasOwn(route.fields ?? {}, field))) {
      return null;
    }
  }
  if (actionRoute) {
    if ((actionRoute.experimental && !allowExperimental) ||
      (actionRoute.behavior === "send" && !allowSend) ||
      actionRoute.required.some((field) => !fields[field]?.trim())) return null;
    const baseUrl = actionRoute.prepare(fields, actionRoute.url);
    if (!baseUrl) return null;
    const url = baseUrl + getLinkParameters(actionRoute, fields, baseUrl);
    return actionRoute.urlLimit && url.length > actionRoute.urlLimit ? null : url;
  }
  const codexDesktopSession = platform === "desktop" && (agent === "codex" || agent === "chatgpt");
  const openClawBrowser = agent === "openclaw" && (platform === "web" || platform === "android");
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
  if (!codexDesktopSession && !openClawBrowser && agent !== "t3-code" && fields.session && invalidSessionId.test(fields.session)) return null;
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
  if ((route.experimental && !allowExperimental) ||
    (route.behavior === "send" && !allowSend)) return null;
  if (route.sessionUrl && fields.session) {
    const sessionId = agent === "claude-code" ? claudeCodeCloudSessionId : conversationId;
    if (Object.entries(fields).some(([field, value]) => field !== "session" && value)) return null;
    if (!sessionId.test(fields.session)) return codexDesktopSession ? getCopiedCodexThreadLink(fields.session) : null;
    return `${route.sessionUrl}/${fields.session}${fragment}`;
  }
  if (agent === "grok-build" && fields.cloudAgent) {
    if (hiddenPathCharacters.test(fields.cloudAgent)) return null;
    const url = grokBuildCloudAgentUrl.exec(fields.cloudAgent);
    const id = url?.[2] ?? fields.cloudAgent;
    if (!id.startsWith("bc-") || !conversationId.test(id.slice(3))) return null;
    return `https://grok.com${url?.[1] ?? `/build/${id}`}`;
  }
  if (agent === "cursor" && fields.cloudAgent) {
    if (fields.prompt) return null;
    const url = cursorCloudAgentUrl.exec(fields.cloudAgent);
    const id = url?.[2] ?? fields.cloudAgent;
    if (!id.startsWith("bc-") || !conversationId.test(id.slice(3))) return null;
    return platform === "desktop"
      ? `cursor://anysphere.cursor-deeplink/background-agent?bcId=${id}`
      : `https://cursor.com${url?.[1] ?? `/agents/${id}`}`;
  }
  if (agent === "codex" && fields.task) {
    const taskPath = codexCloudTaskId.test(fields.task)
      ? `/codex/tasks/${fields.task}`
      : codexCloudTaskPath.exec(fields.task)?.[1];
    if (!taskPath) return null;
    return `https://chatgpt.com${taskPath}${platform === "web" && browserOnly ? "#no_universal_links" : ""}`;
  }
  if (agent === "t3-code" && (fields.environment || fields.session)) {
    const environment = encodeT3ThreadSegment(fields.environment);
    const thread = encodeT3ThreadSegment(fields.session);
    if (!environment || !thread || fields.server || fields.repo || fields.provider || fields.model) return null;
    const base = platform === "web" ? "https://app.t3.codes/threads" : "t3code://threads";
    const draft = fields.prompt?.trim() ? `?prompt=${encodeLinkValue(fields.prompt)}` : "";
    return `${base}/${environment}/${thread}${draft}`;
  }
  if (agent === "opencode" && platform === "android") {
    if (fields.session) {
      return !fields.mode && isOpenCodeSessionId(fields.session)
        ? `opencode://session/${fields.session}` : null;
    }
    return fields.mode ? `opencode://${fields.mode}-session` : route.url;
  }
  if (agent === "openclaw" && (platform === "desktop" || platform === "ios") && fields.server) {
    return fields.prompt ? null : getOpenClawGatewayLink(fields.server, platform);
  }
  if (route.required?.some((field) => !fields[field]?.trim())) return null;
  if (agent === "github-copilot" && platform !== "vscode" &&
    !fields.repo && !fields.prompt?.trim() && !fields.customAgent?.trim()) return null;

  let baseUrl = route.launcher?.appUrl ?? route.url;
  if (openClawBrowser) {
    const target = getOpenClawBrowserTarget(fields.server || route.url, fields.session, Boolean(fields.prompt));
    if (!target) return null;
    baseUrl = target;
  } else if (fields.server) {
    const server = parseServerUrl(fields.server);
    if (!server) return null;
    if (agent === "opencode") {
      const origin = getOpenCodeOrigin(server);
      if (!origin) return null;
      if (fields.session) {
        if (fields.directory || !isOpenCodeSessionId(fields.session)) return null;
        return `${origin}/server/${encodeBase64Url(origin)}/session/${fields.session}`;
      }
      baseUrl = fields.directory ? `${origin}/${encodeBase64Url(fields.directory)}/session` : origin;
    } else if (agent === "t3-code") {
      if (server.pathname !== "/") return null;
      baseUrl = `${server.origin}/new`;
    } else {
      baseUrl = server.href;
    }
  }

  const target = `${baseUrl}${getLinkParameters(route, fields, baseUrl)}${fragment}`;
  const url = route.launcher
    ? `${route.url}?${encodeURIComponent(route.launcher.parameter)}=${encodeURIComponent(target)}`
    : target;
  return route.urlLimit && url.length > route.urlLimit ? null : url;
}

/** Open Hermes Desktop's install review for a qualified skill or a direct skill URL. */
export function getHermesSkillLink(identifier: string): string | null {
  return getAgentLink("hermes", "desktop", { action: "skill-install", target: identifier });
}

/** Convert an OpenCode CLI pairing URL to the Android app's native pairing review. */
export function getOpenCodeAndroidPairingLink(pairingUrl: string): string | null {
  return getAgentLink("opencode", "android", { action: "server-pair", target: pairingUrl });
}

/** Return a self-contained SVG URL for an agent with a bundled brand asset. */
export function getAgentIcon(agent: AgentId): string | null {
  return Object.hasOwn(iconSources, agent) ? iconSources[agent] ?? null : null;
}
