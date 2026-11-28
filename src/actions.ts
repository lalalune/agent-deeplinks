import type { AgentId, AgentRoute, Platform } from "./catalog.js";

export type AgentActionId =
  | "app" | "plugin" | "plugin-install" | "plugin-chat" | "team-plugin"
  | "skill" | "skill-install" | "template-install" | "connector" | "mcp-install"
  | "custom-gpt" | "gem" | "project" | "shared-chat" | "team-bot" | "bot-template" | "bot-marketplace" | "bot-page" | "remote-session" | "server-pair"
  | "settings" | "add-ssh-host" | "skills" | "automations" | "command" | "rule" | "pull-request" | "marketplace" | "install" | "ide-open"
  | "cowork" | "add-environment" | "local-web";

export type AgentActionField = "target" | "tool" | "appPath" | "marketplace" | "config" | "prompt" | "content" | "folders" | "files";

export interface AgentActionInput {
  readonly field: AgentActionField;
  readonly label: string;
  readonly placeholder?: string;
  readonly choices?: readonly { readonly label: string; readonly value: string }[];
}

export interface AgentActionRoute extends Omit<AgentRoute, "fields" | "required"> {
  readonly id: AgentActionId;
  readonly label: string;
  readonly inputs: readonly AgentActionInput[];
  readonly fields: Readonly<Partial<Record<AgentActionField, string>>>;
  readonly required: readonly AgentActionField[];
}

type Fields = Partial<Record<Exclude<AgentActionField, "folders" | "files">, string>>;
type ActionDefinition = AgentActionRoute & {
  readonly prepare: (fields: Fields, url: string) => string | null;
};

const simpleId = /^[a-z0-9][a-z0-9_-]*$/iu;
const uuidShareFormat = {
  id: /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu,
  example: "12345678-1234-4234-9234-123456789abc",
};
const grokShareFormat = {
  id: /^[a-z0-9_-]{1,128}={0,2}_[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu,
  example: "bGVnYWN5_b5ff0ac4-5283-424e-b722-b42379c923f5",
};
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const qualifiedPlugin = /^[a-z0-9][a-z0-9_.-]*@[a-z0-9][a-z0-9_.-]*$/iu;
const pluginName = /^[a-z0-9][a-z0-9_.-]*$/iu;
const numericId = /^\d+$/u;
const unsafeCharacters = /[\p{Cc}\p{Cf}\ud800-\udfff]/u;
const chatgptPlugins = "https://chatgpt.com/plugins/";
const appSpec = "https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#deep-links";
const desktopPlugins = "https://learn.chatgpt.com/docs/reference/commands";
const grokPlugins = "https://docs.x.ai/grok-bot/deep-links#add-a-plugin";
const grokAndroidPluginCheck = "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/grok-bot-android-plugin/proof.json";
const grokMobileAssociation = "https://app-site-association.cdn-apple.com/a/v1/x.ai";
const antigravityPlugins = "https://antigravity.google/docs/build-plugins#share-deep-links-to-your-plugin";
const antigravityMarketplaceDocs = "https://antigravity.google/docs/marketplace/#open-plugins-with-deep-links";
const antigravitySessionDocs = "https://antigravity.google/docs/remote-control/#enable-remote-control-in-an-active-session-remote-control";
const cursorCustomizationName = /^(?!(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$)(?!.*\.\.)[a-z0-9_.-]{1,100}$/iu;
const cursorDeeplinkDocs = "https://cursor.com/docs/reference/deeplinks";
const cursorMcpDocs = "https://cursor.com/docs/mcp/install-links";
const cursorOriginDocs = "https://cursor.com/docs/origin/pull-requests";
const cursorOriginPullRequestPath = /^[A-Za-z0-9][A-Za-z0-9_-]*\/(?!\.{1,2}\/)[A-Za-z0-9_.-]+\/pull\/[1-9][0-9]*$/u;
const cursorOriginPullRequestChecks = "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/cursor-origin-pull-request/proof.json";
const t3PullRequestSource = "https://github.com/pingdotgg/t3code/blob/v0.1.13/packages/shared/src/promptLinks.ts";
const t3AddEnvironmentSource = "https://github.com/pingdotgg/t3code/blob/7deb51b5503c172eb3abddc6f0efec701e685cd4/apps/mobile/src/Stack.tsx#L313-L317";
const t3PullRequestUrl = /^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)\/pull\/(\d+)(?:[/?#].*)?$/iu;
const t3PullRequestShorthand = /^([^/\s#]+)\/([^/\s#]+)(?:\/|#)(\d+)$/u;
const t3PullRequestOwner = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/u;
const t3PullRequestRepository = /^(?!\.+$)[A-Za-z0-9._-]{1,100}$/u;
const t3PromptLimit = 8_000;
const chatgptShareDocs = "https://help.openai.com/en/articles/7925741-sharing-conversations-and-scheduled-tasks-in-chatgpt";
const claudeShareDocs = "https://support.claude.com/en/articles/16762437-public-links-for-shared-chats";
const claudeDesktopLinkDocs = "https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link";
const claudeCoworkPromptLimit = 14_000;
const sharedChatBrowserChecks = "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/shared-chat-browser/proof.json";
const sharedChatAppleChecks = "https://github.com/lalalune/agent-deeplinks/actions/runs/45687467247/artifacts/15056787932";
const grokShareDocs = "https://x.ai/legal/faq";
const grokShareAndroidChecks = "https://github.com/lalalune/agent-deeplinks/actions/runs/45693298941/artifacts/15058854516";
const grokShareAndroid14Checks = "https://github.com/lalalune/agent-deeplinks/actions/runs/46086846186/artifacts/15238959705";
const grokShareChecks = "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/grok-public-share/proof.json";
const openCodePairDocs = "https://opencode.ai/docs/cli/commands#pair";
const openCodePairSource = "https://github.com/anomalyco/opencode-android/blob/v0.8.9/server/src/main/kotlin/ai/opencode/server/OpenCodePairingLink.kt";
const openCodePairingUrl = /^([A-Za-z]+:\/\/[^/@\\?#]+)\/auth\/connect\/([A-Za-z0-9_-]+)$/u;
const openCodePairingCode = /^[A-Za-z0-9_-]+$/u;
const openCodeNativePairingUrl = /^opencode(?:-ios)?:\/\/pair\?([^#]+)$/iu;
const openCodePairingOrigin = /^https?:\/\/[^/@\\?#%\s]+\/?$/iu;
const clawHubPackageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const openClawCatalogSources = [
  "https://github.com/openclaw/openclaw/blob/v2026.11.10/apps/linux/src-tauri/src/deep_links.rs",
  "https://github.com/openclaw/openclaw/blob/v2026.11.10/apps/macos/Sources/OpenClaw/CatalogInstallDeepLink.swift",
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45679828095/artifacts/15053761927",
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45687863971/artifacts/15057671869",
];

function input(field: AgentActionField, label: string, placeholder?: string): AgentActionInput {
  return { field, label, placeholder };
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function readLink(value: string, base: string): URL | null {
  const link = parseUrl(value);
  const expected = new URL(base);
  if (!link || link.protocol !== expected.protocol || link.host !== expected.host ||
    link.username || link.password || unsafeCharacters.test(value)) return null;
  return link;
}

function readId(value: string | undefined, pattern: RegExp, base?: string): string | null {
  if (!value || unsafeCharacters.test(value)) return null;
  const trimmed = value.trim();
  if (pattern.test(trimmed)) return trimmed;
  if (!base) return null;
  const prefix = new URL(base).pathname;
  const pathname = readLink(trimmed, base)?.pathname;
  if (!pathname?.startsWith(prefix)) return null;
  try {
    const id = decodeURIComponent(pathname.slice(prefix.length).replace(/\/$/u, ""));
    return pattern.test(id) ? id : null;
  } catch {
    return null;
  }
}

function pathAction(
  route: Omit<ActionDefinition, "fields" | "required" | "prepare">,
  pattern: RegExp,
): ActionDefinition {
  return {
    ...route,
    fields: { target: "" },
    required: ["target"],
    prepare: ({ target }) => {
      const id = readId(target, pattern, route.url);
      return id ? `${route.url}${id}` : null;
    },
  };
}

const chatgptPlugin = pathAction({
  id: "plugin", label: "Open plugin listing", url: chatgptPlugins,
  behavior: "launch", evidence: "documented", sources: [appSpec],
  inputs: [input("target", "Plugin ID or listing link")],
  note: "Opens the plugin’s listing. Installation and access depend on the recipient’s account.",
}, simpleId);

const chatgptWorkSources = [
  "https://openai.com/business/plugins/mercury/",
  "https://chatgpt.com/cdn/assets/async/317100.20bb7d7ddb.js",
];

function prepareChatgptPluginInstall({ target }: Fields, url: string): string | null {
  const id = readId(target, simpleId, url);
  return id ? `${url}${id}?install` : null;
}

const chatgptPluginInstall: ActionDefinition = {
  id: "plugin-install", label: "Open plugin install", url: chatgptPlugins,
  behavior: "confirm", evidence: "source", sources: chatgptWorkSources,
  fields: { target: "" }, required: ["target"],
  inputs: [input("target", "Plugin ID or listing link")],
  note: "Opens the install flow for an available plugin. An installed plugin opens its listing.",
  prepare: prepareChatgptPluginInstall,
};

const chatgptPluginChat: ActionDefinition = {
  id: "plugin-chat", label: "Draft Work chat with plugin", url: chatgptPlugins,
  behavior: "draft", evidence: "source", sources: chatgptWorkSources,
  fields: { target: "", prompt: "prompt" }, required: ["target", "prompt"],
  query: { surface: "work" },
  inputs: [input("target", "Plugin ID or listing link"), input("prompt", "Draft message")],
  note: "Prefills an unsent Work chat. If needed, ChatGPT opens the plugin’s install flow before showing the draft.",
  prepare: prepareChatgptPluginInstall,
};

function chatgptApp(url: string, native: boolean): ActionDefinition {
  return {
    id: "app", label: "Open plugin app", url,
    behavior: "launch", evidence: "documented", sources: [appSpec],
    fields: { target: "", tool: "", appPath: "path", ...(native ? { marketplace: "" } : {}) },
    required: ["target", "tool"],
    inputs: [
      input("target", "Plugin ID or listing link"),
      input("tool", "App entrypoint tool", "cad.browse"),
      input("appPath", "App-relative path", "/parts/part_joystick"),
      ...(native ? [input("marketplace", "Local marketplace name")] : []),
    ],
    note: native
      ? "Opens a plugin’s global app entrypoint in the installed client. Leave marketplace blank for plugins published to ChatGPT."
      : "Opens a plugin’s global app entrypoint in ChatGPT Work. The plugin must expose a global entrypoint.",
    prepare: ({ target, tool, appPath, marketplace }) => {
      const id = readId(target, simpleId, chatgptPlugins);
      if (!id || !tool || unsafeCharacters.test(tool) || [".", ".."].includes(tool)) return null;
      if (appPath && (
        !appPath.startsWith("/") || appPath.startsWith("//") || appPath.includes("#") ||
        /^\/[^?]*\\/u.test(appPath) || unsafeCharacters.test(appPath)
      )) return null;
      if (marketplace && !pluginName.test(marketplace)) return null;
      const suffix = marketplace ? `@${encodeURIComponent(marketplace)}` : "";
      return `${url}${encodeURIComponent(id)}${suffix}/app/${encodeURIComponent(tool)}`;
    },
  };
}

const chatgptDesktopApp = chatgptApp("codex://plugins/", true);
const codexPlugin = pathAction({
  id: "plugin", label: "Open plugin details", url: "codex://plugins/",
  behavior: "launch", evidence: "documented", sources: [`${desktopPlugins}#plugin-detail`],
  inputs: [input("target", "Plugin ID or detail link", "openai-developers@openai-curated")],
}, /^[a-z0-9][a-z0-9_.-]*(?:@[a-z0-9][a-z0-9_.-]*)?$/iu);

const codexInstall: ActionDefinition = {
  id: "plugin-install", label: "Open plugin install", url: "codex://plugins/install/",
  behavior: "confirm", evidence: "documented", sources: [`${desktopPlugins}#plugin-install`],
  fields: { target: "", marketplace: "marketplace" }, required: ["target", "marketplace"],
  inputs: [input("target", "Plugin name", "openai-developers"), input("marketplace", "Marketplace", "openai-curated")],
  note: "Opens the install flow for a plugin from a marketplace already known to the desktop app.",
  prepare: ({ target, marketplace }, url) =>
    target && marketplace && pluginName.test(target) && pluginName.test(marketplace)
      ? `${url}${target}` : null,
};

const codexPluginChat: ActionDefinition = {
  id: "plugin-chat", label: "Draft Codex chat with plugin", url: "codex://new",
  behavior: "draft", evidence: "documented", sources: [`${desktopPlugins}#start-a-chat-with-a-plugin`],
  fields: { target: "", prompt: "prompt" }, required: ["target", "prompt"],
  inputs: [input("target", "Plugin ID or detail link", "openai-developers@openai-curated"), input("prompt", "Draft message")],
  note: "Prefills an unsent Codex chat. The app can ask the recipient to install the plugin when they send the draft.",
  prepare: (fields, url) => {
    const id = readId(fields.target, qualifiedPlugin, codexPlugin.url);
    if (!id) return null;
    fields.prompt = `[@${id.split("@")[0]}](plugin://${id}) ${fields.prompt}`;
    return url;
  },
};

const grokPlugin = pathAction({
  id: "plugin", label: "Open marketplace plugin", url: "https://x.ai/bot/plugin/",
  behavior: "handoff", evidence: "documented", sources: [grokPlugins, grokMobileAssociation],
  inputs: [input("target", "Plugin ID or marketplace link")],
  note: "Opens the plugin with an Add or Authorize step. A browser listing is available as a fallback.",
}, numericId);

const grokTeamPlugin: ActionDefinition = {
  id: "team-plugin", label: "Open team plugin", url: "grokbot://app/v1/plugin/add",
  behavior: "confirm", evidence: "documented", sources: [grokPlugins],
  fields: { target: "id" }, required: ["target"],
  inputs: [input("target", "Team plugin ID or app link")],
  note: "Requires the installed app, sign-in, and access to the team’s plugin.",
  prepare: (fields, url) => {
    const link = readLink(fields.target?.trim() ?? "", url);
    const id = readId(link?.pathname === "/v1/plugin/add" ? link.searchParams.get("id") ?? "" : fields.target, simpleId);
    if (!id) return null;
    fields.target = id;
    return url;
  },
};

function grokBotShare(
  route: Pick<ActionDefinition, "id" | "label" | "url" | "note" | "sources" | "inputs">,
  appUrl: string,
  idPattern: RegExp,
  desktopBehavior: "launch" | "confirm",
) {
  const appPath = new URL(appUrl).pathname;
  function variant(platform: "web" | "desktop" | "mobile"): ActionDefinition {
    const desktop = platform === "desktop";
    return {
      ...route,
      url: desktop ? appUrl : route.url,
      behavior: desktop ? desktopBehavior : "handoff",
      evidence: platform === "web" ? "verified" : "source",
      fields: { target: desktop ? "id" : "" },
      required: ["target"],
      prepare: (fields, url) => {
        if (!fields.target || unsafeCharacters.test(fields.target)) return null;
        const appLink = readLink(fields.target.trim(), appUrl);
        const appIds = appLink?.searchParams.getAll("id") ?? [];
        const inputValue = appLink?.pathname === appPath && appIds.length === 1 ? appIds[0] : fields.target;
        const path = readId(inputValue, idPattern, route.url);
        if (!path) return null;
        if (!desktop) return url + path;
        fields.target = path.split("/")[0];
        return url;
      },
    };
  }
  return { web: variant("web"), desktop: variant("desktop"), mobile: variant("mobile") };
}

const grokTeamBot = grokBotShare({
  id: "team-bot", label: "Open Team Bot", url: "https://x.ai/bot/agent/",
  inputs: [input("target", "Team Bot ID or share link", "3f937d36-4777-4c7c-9139-a8a48a38c7fe")],
  note: "The browser offers to open the same Bot in the app. The destination requires access to the shared Bot.",
  sources: ["https://docs.x.ai/grok-bot/create-a-team-bot#share-it", grokMobileAssociation],
}, "grokbot://app/v1/agent", /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu, "launch");

const grokBotTemplate = grokBotShare({
  id: "bot-template", label: "Review Bot template", url: "https://x.ai/bot/",
  inputs: [input("target", "Template ID or share link", "https://x.ai/bot/W4Z5pvEm6UgCml48Ig4dT/thoth")],
  note: "Opens a template preview. The recipient can review the template and choose whether to add their own copy.",
  sources: ["https://docs.x.ai/grok-bot/bots#share-a-bot", "https://x.ai/bot/W4Z5pvEm6UgCml48Ig4dT/thoth", grokMobileAssociation],
}, "grokbot://app/v1/bot-template", /^[a-z0-9_-]{21}(?:\/[a-z0-9_-]+)?$/iu, "confirm");

const grokBotMarketplace: ActionDefinition = {
  id: "bot-marketplace", label: "Open Bot Marketplace", url: "https://x.ai/bot/marketplace",
  behavior: "launch", evidence: "verified",
  sources: [
    "https://x.ai/bot/marketplace",
    "https://x.ai/bot/marketplace/bots/projects-manager",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/grok-bot-marketplace/proof.json",
  ],
  fields: { target: "" }, required: [],
  inputs: [input("target", "Marketplace URL or path (optional)", "bots/projects-manager")],
  note: "Opens the public catalog, a category, or a template in the browser. Import Bot is a separate action on the template page.",
  prepare: ({ target }, url) => {
    if (unsafeCharacters.test(target ?? "")) return null;
    const value = target?.trim();
    if (!value) return url;
    const basePath = new URL(url).pathname;
    const link = readLink(value, url);
    const pathname = link?.pathname.replace(/\/$/u, "");
    if (pathname === basePath) return url;
    if (pathname && !pathname.startsWith(`${basePath}/`)) return null;
    const path = pathname ? pathname.slice(basePath.length + 1) : value.replace(/\/$/u, "");
    return (path !== "bots" && slug.test(path)) || (path.startsWith("bots/") && slug.test(path.slice(5)))
      ? `${url}/${path}` : null;
  },
};

const grokBotPage: ActionDefinition = {
  id: "bot-page", label: "Open shared Bot Page", url: "https://pages.grok.bot/",
  behavior: "launch", evidence: "verified",
  sources: [
    "https://docs.x.ai/grok-bot/files-and-results#share-a-page",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/grok-bot-public-page/proof.json",
  ],
  fields: { target: "" }, required: ["target"],
  inputs: [input("target", "Public Grok Bot Page link", "https://bot-team-kanban-example-2ncd.pages.grok.bot/")],
  note: "Opens the public Page in a browser without sign-in. Use the address copied from Grok Bot’s share menu.",
  prepare: ({ target }) => {
    if (!target || unsafeCharacters.test(target)) return null;
    const pageId = /^https:\/\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.pages\.grok\.bot\/?(?:[?#][^\s\\]*)?$/i.exec(target.trim())?.[1];
    return pageId ? `https://${pageId.toLowerCase()}.pages.grok.bot/` : null;
  },
};

const cursorPlugin = pathAction({
  id: "plugin", label: "Open marketplace plugin", url: "https://cursor.com/marketplace/",
  behavior: "launch", evidence: "observed", sources: ["https://cursor.com/docs/plugins", "https://cursor.com/marketplace/cursor/google-drive"],
  inputs: [input("target", "Plugin slug or marketplace link", "cursor/google-drive")],
  note: "Opens the marketplace listing and its Add to Cursor flow.",
}, /^[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)?$/iu);

function cursorPullRequest(platform: "web" | "ios" | "android"): ActionDefinition {
  const isIos = platform === "ios";
  return {
    id: "pull-request", label: "Open Origin pull request", url: "https://cursor.com/codebase/",
    behavior: isIos ? "handoff" : "launch",
    evidence: isIos ? "source" : "observed",
    sources: [
      cursorOriginDocs,
      cursorOriginPullRequestChecks,
      ...(isIos ? ["https://app-site-association.cdn-apple.com/a/v1/cursor.com"] : []),
      ...(platform === "android" ? ["https://cursor.com/.well-known/assetlinks.json"] : []),
    ],
    fields: { target: "" }, required: ["target"],
    inputs: [input("target", "Origin pull request URL", "https://cursor.com/codebase/acme/rocket/pull/1")],
    note: isIos
      ? "The production iOS association claims the Origin pull request path. Review in the app requires access to the repository and still needs a signed-in device check."
      : "Opens the Origin pull request URL in a browser. Cursor keeps the exact destination when asking the recipient to sign in. Review requires access to the repository.",
    prepare: ({ target }, url) => {
      if (!target || unsafeCharacters.test(target)) return null;
      const link = target.trim().replace(/\/$/u, "");
      return link.startsWith(url) && cursorOriginPullRequestPath.test(link.slice(url.length)) ? link : null;
    },
  };
}

function cursorCustomization(kind: "command" | "rule", platform: "web" | "desktop"): ActionDefinition {
  const base = platform === "web" ? "https://cursor.com/link/" : "cursor://anysphere.cursor-deeplink/";
  return {
    id: kind, label: `Review Cursor ${kind}`, url: base + kind,
    encodeQueryValuesTwice: platform === "desktop",
    behavior: platform === "web" ? "handoff" : "confirm",
    evidence: "verified",
    sources: [
      `${cursorDeeplinkDocs}#${kind}s`,
      "https://github.com/lalalune/agent-deeplinks/actions/runs/45698623799/artifacts/15061468954",
    ],
    fields: { target: "name", content: "text" }, required: ["target", "content"],
    inputs: [input("target", `${kind === "command" ? "Command" : "Rule"} name`, `review-${kind}`), input("content", "Content")],
    urlLimit: 10_000,
    note: platform === "web"
      ? "Cursor displays a browser preview. Its handoff can change literal plus signs and percent escapes. Use the desktop link to preserve those characters."
      : `Review the content before adding this file to .cursor/${kind}s/. Cursor adds the file extension.`,
    prepare: ({ target }, url) => target && target !== "." && cursorCustomizationName.test(target) ? url : null,
  };
}

function t3PullRequest(platform: "web" | "desktop" | "ios" | "android"): ActionDefinition {
  return {
    id: "pull-request", label: "Open GitHub pull request",
    url: platform === "web" ? "https://app.t3.codes/new" : "t3code://new",
    behavior: platform === "web" ? "handoff" : platform === "desktop" ? "confirm" : "draft",
    evidence: "source",
    sources: [
      t3PullRequestSource,
      platform === "ios" || platform === "android"
        ? "https://github.com/pingdotgg/t3code/blob/v0.1.13/apps/mobile/src/features/prompt-links/newTaskPromptLink.ts"
        : "https://github.com/pingdotgg/t3code/blob/v0.1.13/apps/web/src/components/promptLinks/NewThreadLinkView.tsx",
    ],
    fields: { target: "", prompt: "prompt" }, required: ["target"], promptLimit: t3PromptLimit,
    inputs: [
      input("target", "GitHub pull request URL or owner/repo#number", "https://github.com/owner/repo/pull/1"),
      input("prompt", "Draft prompt (optional)"),
    ],
    note: "T3 Code opens a linked thread if it finds one. A connected project can open a new review or draft. Checkout and prompt submission require user action.",
    prepare: ({ target, prompt }, url) => {
      if (!target || unsafeCharacters.test(target) || (prompt?.length ?? 0) > t3PromptLimit) return null;
      const value = target.trim();
      const match = t3PullRequestUrl.exec(value) ?? t3PullRequestShorthand.exec(value);
      const [, owner = "", rawRepository = "", rawNumber] = match ?? [];
      const repository = rawRepository.replace(/\.git$/iu, "");
      const number = Number(rawNumber);
      if (!t3PullRequestOwner.test(owner) || !t3PullRequestRepository.test(repository) ||
        !Number.isSafeInteger(number) || number < 1) return null;
      const pullRequest = `https://github.com/${owner}/${repository}/pull/${number}`;
      return `${url}?pr=${encodeURIComponent(pullRequest)}`;
    },
  };
}

function cursorMcp(url: string, behavior: "confirm" | "handoff"): ActionDefinition {
  return {
    id: "mcp-install", label: "Open MCP install", url, behavior,
    evidence: behavior === "confirm" ? "verified" : "source",
    sources: behavior === "confirm"
      ? [cursorMcpDocs, "https://github.com/lalalune/agent-deeplinks/actions/runs/45567533202/artifacts/15000164240"]
      : [cursorMcpDocs, "https://cursor.com/_next/static/immutable/chunks/1ut_-yqa47rub.js"],
    fields: { target: "name", config: "config" }, required: ["target", "config"],
    inputs: [
      input("target", "MCP server name", "my-server"),
      input("config", "MCP server configuration (JSON)", '{"url":"https://example.com/mcp"}'),
    ],
    note: behavior === "confirm"
      ? "Cursor 3.32.4 on Ubuntu displayed the exact server name and URL in its install review. Configuration is visible to anyone with the link."
      : "Opens Cursor’s install prompt for one MCP server. Configuration is visible to anyone with the link.",
    prepare: (fields) => {
      if (unsafeCharacters.test(fields.target ?? "")) return null;
      try {
        const config: { url?: unknown; command?: unknown } | null = JSON.parse(fields.config ?? "");
        if (!config || ![config.url, config.command].some((value) => typeof value === "string" && value.trim())) return null;
        const bytes = new TextEncoder().encode(JSON.stringify(config));
        fields.config = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
        return url;
      } catch {
        return null;
      }
    },
  };
}

const antigravityIdeOpen: ActionDefinition = {
  id: "ide-open", label: "Open a file or folder in Antigravity IDE", url: "antigravity-ide://file",
  behavior: "confirm", evidence: "verified",
  sources: ["https://antigravity.google/download?app=antigravity-ide",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/antigravity-ide-local-file/macos-review.json",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/antigravity-ide-local-file/windows-review.json",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/antigravity-ide-local-file/linux-review.json",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/antigravity-ide-local-file/linux-file-render.json"],
  fields: { target: "" }, required: ["target"],
  inputs: [input("target", "Absolute local path", "/absolute/path/to/project")],
  note: "The standalone IDE showed the exact file confirmation on macOS, Windows, and Ubuntu. After confirmation, the Ubuntu tarball displayed the file in Restricted Mode. Register its URL handler for desktop dispatch.",
  prepare: ({ target }, url) => {
    if (!target || unsafeCharacters.test(target)) return null;
    const drive = /^([a-z]:)[/\\]/iu.exec(target)?.[1];
    if (!drive && (!target.startsWith("/") || target.startsWith("//"))) return null;

    const path = drive ? target.slice(2).replaceAll("\\", "/") : target;
    const segments = path.split("/");
    if (segments.some((segment) => segment === "." || segment === "..")) return null;
    const encodedPath = segments.map(encodeURIComponent).join("/");
    return drive ? `${url}/${drive}${encodedPath}` : url + encodedPath;
  },
};

const antigravityMarketplace: ActionDefinition = {
  id: "marketplace", label: "Browse Antigravity Marketplace", url: "antigravity://customizations/marketplaces",
  behavior: "launch", evidence: "documented",
  sources: [antigravityMarketplaceDocs, antigravityPlugins,
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/antigravity-2352-chrome-cold/proof.json"],
  fields: {}, required: [], inputs: [],
  note: "Stock Chrome launched signed Antigravity 2.35.2 to its welcome screen. The Marketplace tab requires a signed-in account.",
  prepare: (_fields, url) => url,
};

const antigravityWebMarketplace: ActionDefinition = {
  ...antigravityMarketplace,
  url: "https://antigravity.google/docs/marketplace/#browse-marketplace-plugins",
  evidence: "verified",
  sources: [antigravityMarketplaceDocs,
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/antigravity-marketplace-browse/proof.json"],
  note: "Opens Google's public Marketplace catalog in a browser.",
};

const antigravityWebPlugin: ActionDefinition = {
  id: "plugin", label: "Open marketplace plugin", url: "https://antigravity.google/docs/marketplace/",
  behavior: "launch", evidence: "documented", sources: [antigravityPlugins],
  fields: { target: "" }, required: ["target"],
  inputs: [input("target", "Plugin name", "firebase")],
  prepare: ({ target }, url) => target && slug.test(target)
    ? `${url}?plugin=${target}#browse-marketplace-plugins` : null,
};

const antigravityPlugin: ActionDefinition = {
  id: "plugin", label: "Open marketplace plugin", url: "antigravity://plugin/",
  behavior: "launch", evidence: "documented", sources: [antigravityPlugins],
  fields: { target: "", marketplace: "marketplace" }, required: ["target"],
  inputs: [input("target", "Plugin name", "firebase"), input("marketplace", "Marketplace", "antigravity-plugins-partners")],
  note: "Opens the plugin’s details in the signed-in app. Leave marketplace blank for Google’s catalog.",
  prepare: ({ target, marketplace }, url) =>
    target && slug.test(target) && (!marketplace || slug.test(marketplace)) ? `${url}${target}` : null,
};

const antigravitySkill: ActionDefinition = {
  id: "skill", label: "Open marketplace skill", url: "antigravity://customizations/marketplaces/",
  behavior: "launch", evidence: "documented", sources: [antigravityPlugins],
  fields: { target: "", marketplace: "" }, required: ["target", "marketplace"],
  inputs: [input("target", "Skill name"), input("marketplace", "Marketplace", "antigravity-plugins-partners")],
  prepare: ({ target, marketplace }, url) => target && marketplace && slug.test(target) && slug.test(marketplace)
    ? `${url}${marketplace}/skills/${target}` : null,
};

const antigravityRemoteSession: ActionDefinition = {
  id: "remote-session", label: "Open remote conversation", url: "https://antigravity.google.com/r/",
  behavior: "launch", evidence: "documented", sources: [antigravitySessionDocs],
  fields: { target: "" }, required: ["target"],
  inputs: [input("target", "Remote Control conversation URL", "https://antigravity.google.com/r/instance-id?p=c%2Fconversation-id")],
  note: "Use the URL printed by Antigravity CLI. The interactive session must still be running and the browser needs the same Google account.",
  prepare: ({ target }, url) => {
    if (!target || unsafeCharacters.test(target)) return null;
    const link = readLink(target.trim(), url);
    if (!link || !/^\/r\/[A-Za-z0-9_-]+$/u.test(link.pathname)) return null;
    const [conversation, duplicate] = link.searchParams.getAll("p");
    if (!conversation || duplicate !== undefined || !/^c\/[A-Za-z0-9_-]+$/u.test(conversation)) return null;
    return `${link.origin}${link.pathname}?p=${encodeURIComponent(conversation)}`;
  },
};

const hermesCatalogPlugin: ActionDefinition = {
  id: "plugin-install", label: "Review Marketplace plugin", url: "hermes://plugin/install",
  behavior: "confirm", evidence: "verified",
  sources: [
    "https://hermes-agent.nousresearch.com/marketplace/hermes-workbench",
    "https://github.com/NousResearch/hermes-agent/blob/v0.23.4/apps/desktop/src/store/plugin-catalog-install.ts",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/hermes-catalog-review/native-review-proof.json",
  ],
  fields: { target: "catalog" }, required: ["target"],
  inputs: [input("target", "Marketplace plugin name", "hermes-workbench")],
  note: "The signed macOS canary opened the exact Marketplace plugin review for the active profile. Installation waits for confirmation.",
  prepare: ({ target }, url) => target && /^[a-z0-9][a-z0-9_-]*$/u.test(target) ? url : null,
};

const hermesSkill: ActionDefinition = {
  id: "skill-install", label: "Open skill install", url: "hermes://skill/install",
  behavior: "confirm", evidence: "verified", sources: [
    "https://hermes-agent.nousresearch.com/docs/user-guide/desktop",
    "https://github.com/lalalune/agent-deeplinks/actions/runs/45462459410/artifacts/14952364573",
  ],
  fields: { target: "identifier" }, required: ["target"],
  inputs: [input("target", "Skill ID or URL", "official/security/1password")],
  note: "On the signed Hermes macOS canary, the exact link displayed the 1Password skill review. Installation waits for confirmation.",
  prepare: (fields, baseUrl) => {
    if (!fields.target || /[\p{Cc}\p{Cf}]/u.test(fields.target)) return null;
    const skill = fields.target.trim().replace(/[\ud800-\udfff]/gu, "\ufffd");
    const reference = skill.startsWith("well-known:") ? skill.slice("well-known:".length) : skill;
    const qualified = /^[\w.@-]+(?:\/[\w.@-]+)+$/u.test(skill) &&
      !skill.split("/").some((part) => part === "." || part === "..");
    if (!qualified) {
      const url = parseUrl(reference);
      if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    }
    fields.target = skill;
    return baseUrl;
  },
};

const openClawCatalogChecks = {
  plugin: [],
  skill: ["https://github.com/lalalune/agent-deeplinks/actions/runs/45697986978/job/139500313326"],
  template: ["https://github.com/lalalune/agent-deeplinks/actions/runs/45695622934/artifacts/15060241920"],
};

const openClawCatalogNotes = {
  plugin: "The signed Linux AppImage opened the exact Discord plugin review in a connected Gateway using public ClawHub metadata. Installation is a separate action.",
  skill: "The signed Linux AppImage opened the Skills list with its bundled Gateway UI. It opened the named Weather review when connected to the source-built Control UI containing OpenClaw’s skill-page change.",
  template: "The signed Linux AppImage opened the Travel Copilot review with experimental workspace templates enabled in the Gateway and its published archive available. Adding the template is a separate action.",
} as const;

function openClawCatalogInstall(kind: "plugin" | "skill" | "template"): ActionDefinition {
  return {
    id: `${kind}-install`, label: `Review ClawHub ${kind}`, url: `openclaw://${kind}s/install`,
    behavior: "confirm", evidence: kind === "skill" ? "source" : "verified",
    sources: [
      ...openClawCatalogSources,
      ...openClawCatalogChecks[kind],
    ],
    fields: { target: "name" }, required: ["target"],
    inputs: [input("target", "ClawHub package name", "@scope/package")],
    note: openClawCatalogNotes[kind],
    prepare: ({ target }, url) => target && target.length <= 214 && clawHubPackageName.test(target) ? url : null,
  };
}

const claudePlugin: ActionDefinition = {
  id: "plugin-install", label: "Open Cowork plugin install", url: "https://claude.ai/desktop/customize/plugins/new",
  behavior: "handoff", evidence: "source", sources: ["https://claude.com/marketplace/plugins/slack", "https://claude.com/marketplace/plugins/productivity"],
  fields: { marketplace: "marketplace", target: "plugin" }, required: ["target", "marketplace"],
  inputs: [input("target", "Plugin name", "slack"), input("marketplace", "Marketplace repository", "anthropics/knowledge-work-plugins")],
  note: "Uses the marketplace’s Cowork button link and brings the recipient to the plugin install flow.",
  prepare: ({ target, marketplace }, url) => target && marketplace && simpleId.test(target) &&
    /^[a-z0-9][\w.-]*\/[a-z0-9][\w.-]*$/iu.test(marketplace) ? url : null,
};

const claudeConnector = pathAction({
  id: "connector", label: "Open connector listing", url: "https://claude.ai/directory/",
  behavior: "launch", evidence: "source", sources: ["https://claude.com/marketplace/connectors-plugins?sort=popular"],
  inputs: [input("target", "Connector ID or directory link")],
}, simpleId);

const claudePluginDetails: ActionDefinition = {
  id: "plugin", label: "Open plugin details", url: "https://claude.ai/customize/plugins/id/",
  behavior: "launch", evidence: "observed",
  sources: ["https://developers.ringcentral.com/mcp/solutions/claude/#connectors-plugins", "https://knotr.ai/with/claude"],
  fields: { target: "" }, required: ["target"],
  inputs: [input("target", "Directory plugin ID or detail link")],
  prepare: ({ target }, url) => {
    const id = readId(target, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}@anthropic-plugin-directory$/iu, url);
    return id ? `${url}${encodeURIComponent(id)}` : null;
  },
};

const customGpt = pathAction({
  id: "custom-gpt", label: "Open custom GPT", url: "https://chatgpt.com/g/",
  behavior: "launch", evidence: "documented",
  sources: ["https://help.openai.com/en/articles/8798878-sharing-and-publishing-gpts", "https://help.openai.com/en/articles/20001519-custom-gpt-retirement-and-migration-faq"],
  inputs: [input("target", "GPT ID or share link")],
  note: "Legacy route. OpenAI lists December 11, 2026 as the standard retirement date for custom GPTs.",
}, /^g-[a-z0-9]+(?:-[a-z0-9-]+)?$/iu);

const geminiGem = pathAction({
  id: "gem", label: "Open Gem", url: "https://gemini.google.com/gem/",
  behavior: "launch", evidence: "documented",
  sources: ["https://support.google.com/gemini/answer/16504957", "https://knowledge.workspace.google.com/admin/support/before-you-contact-support-gather-key-information"],
  inputs: [input("target", "Gem ID or share link")],
  note: "Opens a shared Gem for an eligible signed-in recipient. Google is transitioning Gems to Skills.",
}, simpleId);

const perplexityProject: ActionDefinition = {
  id: "project", label: "Open shared project", url: "https://www.perplexity.ai/projects/",
  behavior: "launch", evidence: "source",
  sources: [
    "https://www.perplexity.ai/help-center/en/articles/10352961-what-are-projects",
    "https://www.perplexity.ai/.well-known/apple-app-site-association",
  ],
  fields: { target: "" }, required: ["target"],
  inputs: [input("target", "Perplexity project share link")],
  note: "Accepts current Project links and older Space or Collection links. Access depends on sharing permissions.",
  prepare: ({ target }, url) => {
    const link = readLink(target?.trim() ?? "", url);
    return link && /^\/(?:projects|spaces|collections)\/[a-z0-9][a-z0-9_.-]*\/?$/iu.test(link.pathname)
      ? `${link.origin}${link.pathname}` : null;
  },
};

function sharedChat(
  route: Pick<ActionDefinition, "url" | "evidence" | "sources" | "note">,
  browserSuffix = "",
  format = uuidShareFormat,
): ActionDefinition {
  return {
    ...route, id: "shared-chat", label: "Open shared conversation", behavior: "launch",
    fields: { target: "" }, required: ["target"],
    inputs: [input("target", "Conversation share link or ID", `${route.url}${format.example}`)],
    prepare: ({ target }, url) => {
      const id = readId(target, format.id, url);
      return id ? `${url}${encodeURIComponent(id)}${browserSuffix}` : null;
    },
  };
}

const chatgptSharedChat = "https://chatgpt.com/share/";
const codexSharedChat = sharedChat({
  url: "https://chatgpt.com/s/", evidence: "verified",
  sources: [
    "https://learn.chatgpt.com/docs/use-chatgpt#share-a-read-only-snapshot-of-a-codex-thread",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/codex-shared-snapshot/proof.json",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/codex-shared-snapshot/public-browser-proof.json",
  ],
  note: "Opens the read-only Codex snapshot in the browser. A working share link and its original access permissions are required to view the content.",
}, "", { id: /^cx_[a-f0-9]{32}$/u, example: "cx_00000000000080008000000000000000" });
const claudeSharedChat = "https://claude.ai/share/";
const cursorSharedChat = sharedChat({
  url: "https://cursor.com/s/", evidence: "documented",
  sources: ["https://cursor.com/help/ai-features/shared-transcripts"],
  note: "Opens a read-only Cursor transcript in the browser. Access depends on how its author shared it.",
}, "", { id: /^[a-z0-9][a-z0-9_-]{0,127}$/iu, example: "abc123" });
const claudeAndroidInstall: ActionDefinition = {
  id: "install", label: "Get Claude on Google Play",
  url: "https://play.google.com/store/apps/details?id=com.anthropic.claude",
  behavior: "handoff", evidence: "verified",
  sources: [
    "https://support.claude.com/en/articles/9612887-install-claude-for-android",
    "https://github.com/lalalune/agent-deeplinks/actions/runs/45494428908/artifacts/14967049982",
  ],
  fields: {}, required: [], inputs: [],
  note: "Opens Claude's Google Play listing. Installation uses the Play Store account and controls.",
  prepare: (_fields, url) => url,
};
const grokSharedChat = "https://grok.com/share/";

const zcodeLocalWeb: ActionDefinition = {
  id: "local-web", label: "Open local Web workspace", url: "http://127.0.0.1:3030/",
  behavior: "launch", evidence: "source",
  sources: [
    "https://github.com/zai-org/ZCode/blob/v4.0.0/README.en.md#zcode-cli-distribution",
    "https://github.com/zai-org/ZCode/blob/v4.0.0/scripts/zcode-distribution/runner.mjs",
  ],
  fields: { target: "" }, required: ["target"],
  inputs: [input("target", "Local ZCode Web URL", "http://127.0.0.1:3030/")],
  note: "Run zcode --web and use the loopback URL printed in its terminal. The launcher can choose a different port for each launch.",
  prepare: ({ target }) => {
    if (!target || unsafeCharacters.test(target)) return null;
    const value = target.trim();
    if (!/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):[1-9]\d{0,4}\/?$/i.test(value)) return null;
    return parseUrl(value)?.href ?? null;
  },
};

const zcodeShareCode = /^(?!(?:\.{1,2}|manage|callback)$)[A-Za-z0-9._~-]{1,512}$/u;
const zcodeShare = "https://zcode.z.ai/share/";
const zcodeChineseShare = "https://zcode.z.ai/cn/share/";
const zcodeSharedChat: ActionDefinition = {
  id: "shared-chat", label: "Open shared conversation", url: zcodeShare,
  behavior: "launch", evidence: "verified",
  sources: [
    "https://zcode.z.ai/en/docs/agents#sharing-a-conversation",
    "https://github.com/zai-org/ZCode/blob/a4b4445141eb7d3b3e99eada9292775383bfc44e/packages/web/src/share/conversationShareRoute.ts",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/zcode-browser-share/live-public-proof.json",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/zcode-browser-share/proof.json",
  ],
  fields: { target: "" }, required: ["target"],
  inputs: [input("target", "Conversation share link or code", `${zcodeShare}example-share-code`)],
  note: "Opens the shared snapshot in the browser. Use an active share you can access.",
  prepare: ({ target }, url) => {
    const link = target && parseUrl(target.trim());
    const base = link && link.pathname.startsWith("/cn/share/") ? zcodeChineseShare : url;
    const code = readId(target, zcodeShareCode, base);
    return code ? base + code : null;
  },
};

const kimiShareId = /^(?:[a-z0-9]{20}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/iu;
const kimiShareLocales: Readonly<Record<string, readonly string[]>> = {
  "https://www.kimi.ai": ["ar", "zh-hans", "zh-hant", "en", "fr", "de", "id", "it", "ja", "ko", "pt-br", "ru", "es-419", "th", "tr", "vi"],
  "https://www.kimi.com": ["zh", "en"],
};
const kimiSharedChat: ActionDefinition = {
  id: "shared-chat", label: "Open shared conversation", url: "https://www.kimi.ai/share/",
  behavior: "launch", evidence: "verified",
  sources: [
    "https://www.kimi.com/share/d1qvs6d96bk3t9j9ble0",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/kimi-public-share/proof.json",
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/kimi-android-stock-share/proof.json",
  ],
  fields: { target: "" }, required: ["target"],
  inputs: [input("target", "Conversation share link or ID", "https://www.kimi.com/share/d1qvs6d96bk3t9j9ble0")],
  note: "Opens a public Kimi share in the browser. Pasted links keep the original regional website and language when supplied.",
  prepare: ({ target }, url) => {
    if (!target || unsafeCharacters.test(target)) return null;
    const original = parseUrl(target.trim());
    if (!original) {
      const id = readId(target, kimiShareId);
      return id ? url + id : null;
    }
    const locales = kimiShareLocales[original.origin];
    if (!locales) return null;
    const locale = original.pathname.split("/")[2];
    const prefix = locale && locales.includes(locale) ? `${locale}/` : "";
    const base = `${original.origin}/share/${prefix}`;
    const id = readId(target, kimiShareId, base);
    return id ? base + id : null;
  },
};

function openCodePairing(route: Pick<ActionDefinition, "url" | "label" | "behavior" | "evidence" | "sources" | "note">): ActionDefinition {
  const android = route.url === "opencode://pair";
  return {
    ...route,
    id: "server-pair", fields: { target: "" }, required: ["target"],
    inputs: [input("target", android ? "OpenCode CLI or Copy/Share pairing URL" : "OpenCode pairing URL",
      "https://code.example.com/auth/connect/example_code")],
    prepare: ({ target }, url) => {
      if (!target || unsafeCharacters.test(target)) return null;
      const value = target.trim();
      const nativeQuery = android && openCodeNativePairingUrl.exec(value)?.[1];
      if (nativeQuery) return normalizeOpenCodeNativePairing(url, nativeQuery);
      const [, address, code] = openCodePairingUrl.exec(value) ?? [];
      const server = address && parseUrl(address);
      if (!code || !server || !["https:", "http:"].includes(server.protocol) || server.port === "0") return null;
      return url.startsWith("https:") ? `${server.origin}/auth/connect/${code}`
        : `${url}?code=${code}&url=${encodeURIComponent(server.origin)}`;
    },
  };
}

function normalizeOpenCodeNativePairing(url: string, query: string): string | null {
  let code: string | undefined;
  let name: string | undefined;
  const origins: string[] = [];
  try {
    for (const item of query.split("&")) {
      const separator = item.indexOf("=");
      if (separator < 1) return null;
      const key = decodeURIComponent(item.slice(0, separator)).toLowerCase();
      // The native query parser preserves literal plus signs.
      const value = decodeURIComponent(item.slice(separator + 1));
      if (unsafeCharacters.test(value)) return null;
      switch (key) {
        case "code":
          if (code !== undefined || !openCodePairingCode.test(value)) return null;
          code = value;
          break;
        case "url": {
          if (!openCodePairingOrigin.test(value)) return null;
          const server = parseUrl(value);
          if (!server || server.port === "0") return null;
          origins.push(value);
          break;
        }
        case "name":
          if (name !== undefined) return null;
          name = value.trim();
          break;
        default:
          return null;
      }
    }
  } catch {
    return null;
  }
  if (!code || origins.length === 0) return null;
  const endpoints = origins.map((origin) => `url=${encodeURIComponent(origin)}`);
  const queryItems = [`code=${code}`, ...endpoints, ...(name ? [`name=${encodeURIComponent(name)}`] : [])];
  return `${url}?${queryItems.join("&")}`;
}

const t3AddEnvironment: ActionDefinition = {
  id: "add-environment", label: "Add environment", url: "t3code://settings/environment-new",
  behavior: "launch", evidence: "source", sources: [t3AddEnvironmentSource],
  note: "Opens the mobile Add Environment form. Enter the address and pairing code in T3 Code.",
  fields: {}, required: [], inputs: [],
  prepare: (_fields, url) => url,
};

const grokMobileActions = [grokPlugin, grokTeamPlugin, grokTeamBot.mobile, grokBotTemplate.mobile];
const codexSettingsSections = [
  { value: "", label: "Main Settings" },
  { value: "browser-use", label: "Browser use" },
  { value: "computer-use/google-chrome", label: "Google Chrome" },
  { value: "connections", label: "Remote connections" },
  { value: "connections/computer", label: "Control this computer" },
  { value: "connections/devices", label: "Control other devices" },
  { value: "connections/ssh", label: "SSH connections" },
];

const codexNavigationChecks = [
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45702734490/artifacts/15062798293",
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45698311458/artifacts/15061049251",
];

const codexSettings: ActionDefinition = {
  id: "settings", label: "Open Settings", url: "codex://settings",
  behavior: "launch", evidence: "verified", sources: [
    `${desktopPlugins}#settings`, ...codexNavigationChecks,
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/codex-settings-sections/proof.json",
  ],
  note: "The signed Mac app showed General, Browser, Google Chrome, and SSH connection settings. In its signed-out profile the two device-control links stayed on Connections. The Linux preview opened General Settings.",
  fields: { target: "" }, required: [],
  inputs: [{ field: "target", label: "Settings section", choices: codexSettingsSections }],
  prepare: ({ target }, url) => !target ? url : codexSettingsSections.some(({ value }) => value === target) ? `${url}/${target}` : null,
};

const sshConfigAlias = /^(?!-)[\p{L}\p{N}_.:-]+$/u;
const codexAddSshHost: ActionDefinition = {
  id: "add-ssh-host", label: "Add SSH host", url: "codex://settings/connections/ssh/add",
  behavior: "configure", evidence: "verified", sources: [
    `${desktopPlugins}#settings`,
    "https://github.com/lalalune/agent-deeplinks/actions/runs/46088182694/job/140802629073",
  ],
  note: "Adds a named host with automatic connection disabled and opens SSH settings. Use an alias from your SSH config. The tested macOS build also added an unknown alias as a disconnected entry.",
  fields: { target: "name" }, required: ["target"],
  inputs: [input("target", "SSH host alias", "build-box")],
  prepare: ({ target }, url) => target && sshConfigAlias.test(target) ? url : null,
};

const codexSkills: ActionDefinition = {
  id: "skills", label: "Open Skills", url: "codex://skills",
  behavior: "launch", evidence: "verified", sources: [`${desktopPlugins}#skills`, ...codexNavigationChecks],
  note: "The signed Mac app selected Skills and displayed its catalog. In the Linux preview, the Plugins tab stayed selected.",
  fields: {}, required: [], inputs: [],
  prepare: (_fields, url) => url,
};

const codexAutomations: ActionDefinition = {
  id: "automations", label: "Open Scheduled", url: "codex://automations",
  behavior: "launch", evidence: "verified", sources: [`${desktopPlugins}#scheduled`, ...codexNavigationChecks],
  fields: {}, required: [], inputs: [],
  note: "The signed Mac and Linux apps opened the Scheduled list and showed the New task button. OpenAI documents a create form.",
  prepare: (_fields, url) => url,
};

const codexDesktopActions = [codexPlugin, codexInstall, codexPluginChat, codexSettings, codexAddSshHost, codexSkills, codexAutomations];
const claudeCowork: ActionDefinition = {
  id: "cowork", label: "Open Claude Cowork", url: "claude://cowork/new",
  behavior: "draft", evidence: "documented", sources: [
    claudeDesktopLinkDocs,
    "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/claude-cowork-native/proof.json",
  ],
  note: "Prefills a Cowork draft in Claude Desktop. Claude asks for confirmation before adopting linked folders. Stock macOS opened both exact links to Claude sign-in. The composer requires an eligible account.",
  fields: { prompt: "q", folders: "folder", files: "file" }, required: [], promptLimit: claudeCoworkPromptLimit,
  inputs: [input("prompt", "Draft prompt"), input("folders", "Absolute folders"), input("files", "Absolute files")],
  prepare: ({ prompt }, url) => (prompt?.length ?? 0) <= claudeCoworkPromptLimit ? url : null,
};

const actionCatalog: Partial<Record<AgentId, Partial<Record<Platform, readonly ActionDefinition[]>>>> = {
  chatgpt: {
    web: [chatgptApp(chatgptPlugins, false), chatgptPlugin, chatgptPluginInstall, chatgptPluginChat, customGpt,
      sharedChat({
        url: chatgptSharedChat, evidence: "verified", sources: [chatgptShareDocs, sharedChatBrowserChecks],
        note: "The public conversation rendered in desktop Chromium and iPhone WebKit. The web query excludes iOS handoff. Android may still open ChatGPT.",
      }, "?no_universal_links=1")],
    desktop: [chatgptDesktopApp, ...codexDesktopActions],
    ios: [{
      ...chatgptApp("chatgpt://plugins/", true),
      sources: [appSpec, "https://github.com/openai/mcp-extensions/issues/56"],
      note: "Opens the global app entrypoint in ChatGPT for iOS 1.2026.307 or newer. Leave marketplace blank for plugins published to ChatGPT.",
    }, sharedChat({
      url: chatgptSharedChat, evidence: "verified",
      sources: ["https://chatgpt.com/.well-known/apple-app-site-association", sharedChatAppleChecks,
        "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/openai-claude-physical-ios/proof.json"],
      note: "The exact public share opened its matching transcript in ChatGPT 1.2026.321 after a Safari tap on a physical iPhone.",
    })],
    android: [sharedChat({
      url: chatgptSharedChat, evidence: "source",
      sources: ["https://github.com/lalalune/agent-deeplinks/actions/runs/45686687701/artifacts/15056028598", chatgptShareDocs],
      note: "The signed Android app accepted the share link. The offline test reached the splash screen, and in-app conversation rendering still needs a connected run.",
    })],
  },
  codex: {
    web: [codexSharedChat], desktop: codexDesktopActions, ios: [codexSharedChat], android: [codexSharedChat],
  },
  grok: {
    web: [sharedChat({
      url: grokSharedChat, evidence: "verified", sources: [grokShareDocs, grokShareChecks, grokShareAndroidChecks, grokShareAndroid14Checks],
      note: "The public conversation rendered in signed-out desktop and iPhone browsers. With Grok installed, the browser flag kept the link in the tested Android 15 browser. The tested Android 14 build still opened Grok.",
    }, "?stay_in_browser=true", grokShareFormat)],
    ios: [sharedChat({
      url: grokSharedChat, evidence: "source", sources: ["https://grok.com/.well-known/apple-app-site-association", "https://github.com/lalalune/agent-deeplinks/actions/runs/45693328012/artifacts/15057684811"],
      note: "The clean share link matches Grok’s production Universal Link. In-app conversation rendering still needs a device check.",
    }, "", grokShareFormat)],
    android: [sharedChat({
      url: grokSharedChat, evidence: "source", sources: ["https://grok.com/.well-known/assetlinks.json", grokShareAndroidChecks, grokShareAndroid14Checks],
      note: "Stock Android 14 and 15 opened the signed Grok app with the clean share link. Both checks reached Google Play license verification. Opening the conversation requires a licensed install.",
    }, "", grokShareFormat)],
  },
  "grok-bot": {
    web: [grokPlugin, grokTeamBot.web, grokBotTemplate.web, grokBotMarketplace, grokBotPage],
    desktop: [grokPlugin, grokTeamPlugin, grokTeamBot.desktop, grokBotTemplate.desktop],
    ios: [...grokMobileActions, grokBotMarketplace, grokBotPage],
    android: [
      {
        ...grokPlugin, sources: [...grokPlugin.sources, grokAndroidPluginCheck],
        note: "The signed Android app received the public Slack plugin link through its App Link. The test reached Google Play license verification. The browser is available as a fallback.",
      },
      {
        ...grokTeamPlugin, sources: [...grokTeamPlugin.sources, grokAndroidPluginCheck],
        note: "The signed Android app received the custom URI and reached Google Play license verification. Team plugin review requires sign-in and access.",
      },
      grokTeamBot.mobile, grokBotTemplate.mobile, grokBotMarketplace, grokBotPage,
    ],
  },
  cursor: {
    web: [cursorPlugin, cursorMcp("https://cursor.com/install-mcp", "handoff"), cursorCustomization("command", "web"), cursorCustomization("rule", "web"), cursorPullRequest("web"), cursorSharedChat],
    desktop: [cursorMcp("cursor://anysphere.cursor-deeplink/mcp/install", "confirm"), cursorCustomization("command", "desktop"), cursorCustomization("rule", "desktop")],
    ios: [cursorPullRequest("ios"), cursorSharedChat],
    android: [cursorPullRequest("android"), cursorSharedChat],
  },
  antigravity: {
    web: [antigravityWebMarketplace, antigravityWebPlugin, antigravityRemoteSession],
    desktop: [antigravityMarketplace, antigravityPlugin, antigravitySkill, antigravityIdeOpen],
    ios: [antigravityRemoteSession],
    android: [antigravityRemoteSession],
  },
  hermes: { desktop: [hermesSkill, hermesCatalogPlugin] },
  openclaw: { desktop: [openClawCatalogInstall("plugin"), openClawCatalogInstall("skill"), openClawCatalogInstall("template")] },
  "t3-code": {
    web: [t3PullRequest("web")], desktop: [t3PullRequest("desktop")],
    ios: [t3PullRequest("ios"), t3AddEnvironment],
    android: [t3PullRequest("android"), {
      ...t3AddEnvironment,
      evidence: "verified",
      sources: [...t3AddEnvironment.sources,
        "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/t3-mobile-add-environment/proof.json"],
    }],
  },
  opencode: {
    web: [openCodePairing({
      url: "https://code.example.com/auth/connect/", label: "Sign in to a server", behavior: "launch", evidence: "verified",
      sources: [openCodePairDocs, "https://opencode.ai/docs/cli/web/"],
      note: "Opening this link signs the browser in and uses the one-time code.",
    })],
    ios: [openCodePairing({
      url: "opencode-ios://pair", label: "Pair with a server", behavior: "launch", evidence: "source",
      sources: [openCodePairSource, "https://opencode.ai/mobile", openCodePairDocs],
      note: "Uses OpenCode’s native iPhone pairing URL. The official iPhone beta is distributed through TestFlight.",
    })],
    android: [openCodePairing({
      url: "opencode://pair", label: "Pair with a server", behavior: "confirm", evidence: "verified",
      sources: [openCodePairSource, openCodePairDocs,
        "https://github.com/anomalyco/opencode-android/blob/v0.8.13/feature/session/src/main/kotlin/ai/opencode/feature/session/SessionFeatureBrowser.kt#L351-L365",
        "https://github.com/lalalune/agent-deeplinks/actions/runs/46086116070/artifacts/15239077786",
        "https://github.com/lalalune/agent-deeplinks/actions/runs/45679936147/artifacts/15054890187",
        "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/opencode-android-070-play/proof.json"],
      note: "Opens native pairing review from a CLI link or a link copied or shared from OpenCode. Pairing codes are single-use.",
    })],
  },
  claude: {
    web: [claudePluginDetails, claudeConnector, claudePlugin,
      sharedChat({
        url: claudeSharedChat, evidence: "verified", sources: [claudeShareDocs, sharedChatBrowserChecks],
        note: "The public snapshot rendered in iPhone WebKit. Desktop Chromium reached a security verification page. The web fragment excludes iOS handoff.",
      }, "#no_universal_links")],
    desktop: [claudePlugin, claudeCowork],
    ios: [sharedChat({
      url: claudeSharedChat, evidence: "source",
      sources: ["https://claude.ai/.well-known/apple-app-site-association", sharedChatAppleChecks],
      note: "Apple’s production association matches the clean share URL. Opening a shared snapshot in the installed iPhone app still needs a device check.",
    })],
    android: [claudeAndroidInstall, sharedChat({
      url: claudeSharedChat, evidence: "source",
      sources: [claudeShareDocs, "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/claude-android-26112419/proof.json"],
      note: "The verified Claude App Link opened the signed Android app to sign-in. Viewing the shared snapshot in the app still needs a check.",
    })],
  },
  zcode: { web: [zcodeSharedChat, zcodeLocalWeb], ios: [zcodeSharedChat], android: [zcodeSharedChat] },
  kimi: { web: [kimiSharedChat], ios: [kimiSharedChat], android: [kimiSharedChat] },
  gemini: { web: [geminiGem] },
  perplexity: { web: [perplexityProject], ios: [perplexityProject] },
};

function getActionDefinitions(agent: AgentId, platform: Platform): readonly ActionDefinition[] {
  if (!Object.hasOwn(actionCatalog, agent)) return [];
  const routes = actionCatalog[agent];
  return routes && Object.hasOwn(routes, platform) ? routes[platform] ?? [] : [];
}

export function getAgentActions(agent: AgentId, platform: Platform): readonly AgentActionRoute[] {
  return getActionDefinitions(agent, platform);
}

export function getActionDefinition(agent: AgentId, platform: Platform, action: AgentActionId): ActionDefinition | undefined {
  return getActionDefinitions(agent, platform).find((route) => route.id === action);
}
