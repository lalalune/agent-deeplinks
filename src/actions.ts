import type { AgentId, AgentRoute, Platform } from "./catalog.js";

export type AgentActionId =
  | "app" | "plugin" | "plugin-install" | "plugin-chat" | "team-plugin"
  | "skill" | "skill-install" | "connector" | "mcp-install"
  | "custom-gpt" | "gem" | "project" | "team-bot" | "bot-template" | "remote-session";

export type AgentActionField = "target" | "tool" | "appPath" | "marketplace" | "config" | "prompt";

export interface AgentActionInput {
  readonly field: AgentActionField;
  readonly label: string;
  readonly placeholder?: string;
}

export interface AgentActionRoute extends Omit<AgentRoute, "fields" | "required"> {
  readonly id: AgentActionId;
  readonly label: string;
  readonly inputs: readonly AgentActionInput[];
  readonly fields: Readonly<Partial<Record<AgentActionField, string>>>;
  readonly required: readonly AgentActionField[];
}

type Fields = Partial<Record<AgentActionField, string>>;
type ActionDefinition = AgentActionRoute & {
  readonly prepare: (fields: Fields, url: string) => string | null;
};

const simpleId = /^[a-z0-9][a-z0-9_-]*$/iu;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const qualifiedPlugin = /^[a-z0-9][a-z0-9_.-]*@[a-z0-9][a-z0-9_.-]*$/iu;
const pluginName = /^[a-z0-9][a-z0-9_.-]*$/iu;
const numericId = /^\d+$/u;
const unsafeCharacters = /[\p{Cc}\p{Cf}\ud800-\udfff]/u;
const chatgptPlugins = "https://chatgpt.com/plugins/";
const appSpec = "https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#deep-links";
const desktopPlugins = "https://learn.chatgpt.com/docs/reference/commands";
const grokPlugins = "https://docs.x.ai/grok-bot/deep-links#add-a-plugin";
const grokMobileAssociation = "https://app-site-association.cdn-apple.com/a/v1/x.ai";
const antigravityPlugins = "https://antigravity.google/docs/build-plugins#share-deep-links-to-your-plugin";
const antigravitySessionDocs = "https://antigravity.google/docs/remote-control/#enable-remote-control-in-an-active-session-remote-control";
const cursorMcpDocs = "https://cursor.com/docs/mcp/install-links";

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

const cursorPlugin = pathAction({
  id: "plugin", label: "Open marketplace plugin", url: "https://cursor.com/marketplace/",
  behavior: "launch", evidence: "observed", sources: ["https://cursor.com/docs/plugins", "https://cursor.com/marketplace/cursor/google-drive"],
  inputs: [input("target", "Plugin slug or marketplace link", "cursor/google-drive")],
  note: "Opens the marketplace listing and its Add to Cursor flow.",
}, /^[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)?$/iu);

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

const grokMobileActions = [grokPlugin, grokTeamPlugin, grokTeamBot.mobile, grokBotTemplate.mobile];
const codexDesktopPlugins = [codexPlugin, codexInstall, codexPluginChat];
const actionCatalog: Partial<Record<AgentId, Partial<Record<Platform, readonly ActionDefinition[]>>>> = {
  chatgpt: {
    web: [chatgptApp(chatgptPlugins, false), chatgptPlugin, chatgptPluginInstall, chatgptPluginChat, customGpt],
    desktop: [chatgptDesktopApp, ...codexDesktopPlugins],
    ios: [{
      ...chatgptApp("chatgpt://plugins/", true),
      sources: [appSpec, "https://github.com/openai/mcp-extensions/issues/56"],
      note: "Opens the global app entrypoint in ChatGPT for iOS 1.2026.307 or newer. Leave marketplace blank for plugins published to ChatGPT.",
    }],
  },
  codex: { desktop: codexDesktopPlugins },
  "grok-bot": {
    web: [grokPlugin, grokTeamBot.web, grokBotTemplate.web],
    desktop: [grokPlugin, grokTeamPlugin, grokTeamBot.desktop, grokBotTemplate.desktop],
    ios: grokMobileActions,
    android: grokMobileActions,
  },
  cursor: {
    web: [cursorPlugin, cursorMcp("https://cursor.com/install-mcp", "handoff")],
    desktop: [cursorMcp("cursor://anysphere.cursor-deeplink/mcp/install", "confirm")],
  },
  antigravity: {
    web: [antigravityWebPlugin, antigravityRemoteSession],
    desktop: [antigravityPlugin, antigravitySkill],
    ios: [antigravityRemoteSession],
    android: [antigravityRemoteSession],
  },
  hermes: { desktop: [hermesSkill] },
  claude: { web: [claudePluginDetails, claudeConnector, claudePlugin], desktop: [claudePlugin] },
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
