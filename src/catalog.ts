export const platforms = ["web", "desktop", "ios", "android", "cli"] as const;
export type Platform = (typeof platforms)[number];

export const platformNames: Readonly<Record<Platform, string>> = {
  web: "Web",
  desktop: "Desktop",
  ios: "iOS",
  android: "Android",
  cli: "CLI",
};

export type Evidence = "documented" | "source" | "observed" | "verified";

export type LinkBehavior = "draft" | "launch" | "handoff" | "confirm" | "send" | "unknown";

export type LinkField =
  | "prompt" | "cwd" | "repo" | "path" | "originUrl" | "directory"
  | "provider" | "model" | "botId" | "folder" | "server";

export interface AgentRoute {
  readonly url: string;
  readonly behavior: LinkBehavior;
  readonly evidence: Evidence;
  readonly sources: readonly string[];
  readonly note?: string;
  readonly fields?: Readonly<Partial<Record<LinkField, string>>>;
  readonly required?: readonly LinkField[];
  readonly promptLimit?: number;
  readonly promptLimitUnit?: "grapheme";
  readonly urlLimit?: number;
  readonly query?: Readonly<Record<string, string>>;
  readonly experimental?: boolean;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly home: string;
  readonly description: string;
  readonly routes: Readonly<Partial<Record<Platform, AgentRoute>>>;
}

const cursorDocs = "https://cursor.com/docs/reference/deeplinks";
const claudeCodeDocs = "https://code.claude.com/docs/en/deep-links";
const claudeDesktopDocs = "https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link";
const codexDocs = "https://learn.chatgpt.com/docs/reference/commands";
const grokBotDocs = "https://docs.x.ai/grok-bot/deep-links";
const t3Source = "https://github.com/pingdotgg/t3code/blob/v0.1.11/packages/shared/src/promptLinks.ts";
const openCodeTag = "https://github.com/anomalyco/opencode/blob/v1.19.6";
const claudeIosAssociation = "https://claude.ai/.well-known/apple-app-site-association";
const slopDate = "https://slop.date/";
const slopCash = "https://slop.cash/";
const vibestack = "https://vibestack.fun/";
const cursorIosAssociation = "https://cursor.com/.well-known/apple-app-site-association";
const grokIosAssociation = "https://grok.com/.well-known/apple-app-site-association";

const cursorRoute = {
  behavior: "draft",
  evidence: "documented",
  sources: [cursorDocs],
  fields: { prompt: "text" },
  required: ["prompt"],
  urlLimit: 10_000,
} as const satisfies Omit<AgentRoute, "url">;

const t3Route = {
  behavior: "draft",
  evidence: "source",
  sources: [t3Source],
  fields: { prompt: "prompt", repo: "repo", provider: "provider", model: "model" },
  required: ["prompt"],
  promptLimit: 8_000,
} as const satisfies Omit<AgentRoute, "url">;

const grokBotRoute = {
  url: "grokbot://app/v1/prompt",
  behavior: "draft",
  evidence: "documented",
  sources: [grokBotDocs],
  fields: { prompt: "text", botId: "id" },
  required: ["prompt"],
  promptLimit: 1_000,
  urlLimit: 2_048,
  note: "Uses your primary Bot unless you specify a Bot ID.",
} as const satisfies AgentRoute;

const catalog = {
  cursor: {
    name: "Cursor",
    home: "https://cursor.com/",
    description: "Coding editor and agent",
    routes: {
      web: {
        ...cursorRoute,
        url: "https://cursor.com/link/prompt",
        behavior: "handoff",
        note: "Browser landing page for the desktop editor.",
      },
      desktop: {
        ...cursorRoute,
        url: "cursor://anysphere.cursor-deeplink/prompt",
        note: "Handler and directed macOS delivery checked in Cursor 3.31.15. Composer check is pending.",
      },
      ios: {
        url: "https://cursor.com/agents",
        behavior: "launch",
        evidence: "source",
        sources: [cursorIosAssociation, "https://cursor.com/docs/cloud-agent/mobile"],
        note: "Universal Link for the Cursor Cloud Agents inbox.",
      },
    },
  },
  grok: {
    name: "Grok",
    home: "https://grok.com/",
    description: "xAI’s chat assistant",
    routes: {
      web: {
        url: "https://grok.com/",
        behavior: "unknown",
        evidence: "observed",
        sources: [slopDate],
        fields: { prompt: "q" },
        experimental: true,
        note: "Published by an integrating site. Prompt handling needs runtime confirmation.",
      },
      ios: {
        url: "https://grok.com/",
        behavior: "launch",
        evidence: "source",
        sources: [grokIosAssociation],
        note: "Grok iOS associates this URL. Web can open when the app is unavailable.",
      },
    },
  },
  "grok-bot": {
    name: "Grok Bot",
    home: "https://docs.x.ai/grok-bot",
    description: "xAI’s dedicated Bot client",
    routes: {
      web: {
        ...grokBotRoute,
        url: "https://cursor.com/grok-bot/link/v1/prompt",
        behavior: "handoff",
        note: "xAI’s public handoff page opens the installed Grok Bot app.",
      },
      desktop: grokBotRoute,
      ios: grokBotRoute,
      android: grokBotRoute,
    },
  },
  "meta-ai": {
    name: "Meta AI (Muse Spark)",
    home: "https://www.meta.ai/",
    description: "Meta AI chat, labeled Muse in Vibestack",
    routes: {
      web: {
        url: "https://www.meta.ai/",
        behavior: "unknown",
        evidence: "observed",
        sources: [vibestack, slopCash],
        fields: { prompt: "prompt" },
        experimental: true,
        note: "Published by Slop Cash and Vibestack. Prompt handling needs client confirmation.",
      },
    },
  },
  "meta-muse": {
    name: "Meta Muse",
    home: "https://muse.ai/",
    description: "Meta’s personal agent",
    routes: {
      ios: {
        url: "https://applink.muse.ai/",
        behavior: "launch",
        evidence: "source",
        sources: ["https://ai.meta.com/muse/", "https://applink.muse.ai/.well-known/apple-app-site-association"],
        note: "The iOS handoff advertised by Meta for the Muse app.",
      },
    },
  },
  claude: {
    name: "Claude",
    home: "https://claude.ai/",
    description: "Anthropic’s chat assistant",
    routes: {
      desktop: {
        url: "claude://claude.ai/new",
        behavior: "draft",
        evidence: "verified",
        sources: [claudeDesktopDocs],
        fields: { prompt: "q" },
        note: "Prefill verified in Claude 6.28899.6 on macOS.",
      },
      web: {
        url: "https://claude.ai/new",
        behavior: "unknown",
        evidence: "observed",
        sources: [slopDate],
        fields: { prompt: "q" },
        experimental: true,
        note: "Published by an integrating site. Prompt handling needs runtime confirmation.",
      },
      ios: {
        url: "https://claude.ai/new",
        behavior: "launch",
        evidence: "source",
        sources: [claudeIosAssociation],
        note: "Associated iOS URL for a new chat. Native prompt handling needs a device test.",
      },
    },
  },
  "claude-code": {
    name: "Claude Code",
    home: "https://code.claude.com/",
    description: "Anthropic’s coding agent",
    routes: {
      web: {
        url: "https://claude.ai/code",
        behavior: "launch",
        evidence: "documented",
        sources: ["https://code.claude.com/docs/en/claude-code-on-the-web"],
        note: "Opens the hosted Claude Code workspace.",
      },
      desktop: {
        url: "claude://code/new",
        behavior: "draft",
        evidence: "verified",
        sources: [claudeDesktopDocs],
        fields: { prompt: "q", folder: "folder" },
        note: "Prefill verified in Claude Desktop’s Code tab in 6.28899.6 on macOS.",
      },
      cli: {
        url: "claude-cli://open",
        behavior: "draft",
        evidence: "documented",
        sources: [claudeCodeDocs],
        fields: { prompt: "q", cwd: "cwd", repo: "repo" },
        promptLimit: 5_000,
        note: "Opens in a terminal after the Claude Code URL handler has registered. cwd takes precedence over repo.",
      },
    },
  },
  chatgpt: {
    name: "ChatGPT",
    home: "https://chatgpt.com/",
    description: "OpenAI’s chat assistant",
    routes: {
      desktop: {
        url: "codex://threads/new",
        behavior: "draft",
        evidence: "source",
        sources: ["https://chatgpt.com/cdn/assets/617936.82c33d1781.js"],
        fields: { prompt: "prompt" },
        query: { mode: "chat" },
        note: "The ChatGPT web client emits this handoff for Chat mode in the unified desktop app.",
      },
      web: {
        url: "https://chatgpt.com/",
        behavior: "draft",
        evidence: "verified",
        sources: ["https://chatgpt.com/cdn/assets/646436.8f73ec6517.js", slopDate],
        fields: { prompt: "q" },
        query: { disable_auto_send: "1", no_universal_links: "1" },
        note: "Draft and enabled Send button verified in a signed-out browser with disable_auto_send enabled.",
      },
      ios: {
        url: "https://chatgpt.com/#native",
        behavior: "launch",
        evidence: "source",
        sources: ["https://chatgpt.com/.well-known/apple-app-site-association"],
        note: "An iOS Universal Link for a blank ChatGPT conversation.",
      },
    },
  },
  codex: {
    name: "Codex",
    home: "https://chatgpt.com/codex",
    description: "OpenAI’s coding agent",
    routes: {
      web: {
        url: "https://chatgpt.com/codex",
        behavior: "launch",
        evidence: "documented",
        sources: ["https://developers.openai.com/codex/cloud"],
        note: "Opens the Codex cloud workspace.",
      },
      desktop: {
        url: "codex://new",
        behavior: "draft",
        evidence: "documented",
        sources: [codexDocs],
        fields: { prompt: "prompt", path: "path", originUrl: "originUrl" },
        note: "macOS dispatch checked. The provider documents the draft composer and path precedence over originUrl.",
      },
    },
  },
  antigravity: {
    name: "Antigravity",
    home: "https://antigravity.google/",
    description: "Google’s agentic coding environment",
    routes: {
      web: {
        url: "https://antigravity.google.com/remote",
        behavior: "launch",
        evidence: "documented",
        sources: ["https://antigravity.google/docs/remote-agents"],
        note: "Opens Google’s Remote Agents surface. Access depends on your account.",
      },
      desktop: {
        url: "antigravity://",
        behavior: "launch",
        evidence: "verified",
        sources: ["https://antigravity.google/"],
        note: "App activation verified in Antigravity 2.34.0 on macOS.",
      },
    },
  },
  kimi: {
    name: "Kimi",
    home: "https://www.kimi.ai/",
    description: "Moonshot AI’s chat and work assistant",
    routes: {
      web: {
        url: "https://www.kimi.ai/",
        behavior: "launch",
        evidence: "documented",
        sources: ["https://www.kimi.ai/help/getting-started/overview"],
        note: "Opens the Kimi web assistant.",
      },
      desktop: {
        url: "kimi-work://home",
        behavior: "launch",
        evidence: "verified",
        sources: ["https://www.kimi.com/download"],
        note: "Launch verified on macOS. Kimi 3.2.27’s handler opens Kimi Work Home.",
      },
    },
  },
  zcode: {
    name: "ZCode",
    home: "https://zcode.z.ai/",
    description: "Z.ai’s coding client",
    routes: {},
  },
  "t3-code": {
    name: "T3 Code",
    home: "https://t3.codes/",
    description: "Open-source coding-agent client",
    routes: {
      web: {
        ...t3Route,
        url: "https://app.t3.codes/new",
        behavior: "handoff",
        note: "Choose a connected browser environment or open T3 Code.",
      },
      desktop: { ...t3Route, url: "t3code://new" },
      ios: { ...t3Route, url: "t3code://new", note: "Requires a connected environment." },
      android: { ...t3Route, url: "t3code://new", note: "Requires a connected environment." },
    },
  },
  opencode: {
    name: "OpenCode",
    home: "https://opencode.ai/",
    description: "Open-source coding agent",
    routes: {
      web: {
        url: "http://localhost:4096",
        behavior: "launch",
        evidence: "verified",
        sources: ["https://opencode.ai/docs/cli/web/", `${openCodeTag}/packages/app/src/app.tsx#L636`],
        fields: { directory: "", server: "" },
        required: ["server"],
        note: "Enter your OpenCode server origin and optionally a project directory. In v1.19.6, the browser opened a composer and discarded the prompt parameter.",
      },
      desktop: {
        url: "opencode://new-session",
        behavior: "draft",
        evidence: "source",
        sources: [`${openCodeTag}/packages/app/src/pages/layout/deep-links.ts`, `${openCodeTag}/packages/app/src/pages/session.tsx#L370`],
        fields: { prompt: "prompt", directory: "directory" },
        required: ["directory"],
        note: "Requires a local project directory. The URL is handled by the desktop app.",
      },
    },
  },
  hermes: {
    name: "Hermes Agent",
    home: "https://hermes-agent.nousresearch.com/",
    description: "Nous Research’s personal agent",
    routes: {
      web: {
        url: "http://127.0.0.1:9120/",
        behavior: "launch",
        evidence: "documented",
        sources: ["https://hermes-agent.nousresearch.com/docs/user-guide/desktop#use-the-desktop-workspace-from-a-browser"],
        note: "Opens a previously enabled Hermes Webapp on this machine.",
      },
      desktop: {
        url: "hermes://launch",
        behavior: "launch",
        evidence: "documented",
        sources: ["https://hermes-agent.nousresearch.com/docs/user-guide/desktop#settings--onboarding"],
        note: "Opens Hermes Desktop.",
      },
    },
  },
  openclaw: {
    name: "OpenClaw",
    home: "https://openclaw.ai/",
    description: "Self-hosted personal assistant",
    routes: {
      web: {
        url: "http://127.0.0.1:18789/",
        behavior: "launch",
        evidence: "documented",
        sources: ["https://docs.openclaw.ai/dashboard"],
        note: "Opens a configured local OpenClaw Gateway dashboard.",
      },
      desktop: {
        url: "openclaw://agent",
        behavior: "confirm",
        evidence: "source",
        sources: ["https://github.com/openclaw/openclaw/blob/main/apps/macos/Sources/OpenClaw/DeepLinks.swift"],
        fields: { prompt: "message" },
        required: ["prompt"],
        promptLimit: 240,
        promptLimitUnit: "grapheme",
        note: "On macOS this asks for confirmation before running the agent. Cancel to discard the prompt.",
      },
      ios: {
        url: "openclaw://agent",
        behavior: "confirm",
        evidence: "source",
        sources: ["https://github.com/openclaw/openclaw/blob/main/apps/ios/Sources/Model/NodeAppModel.swift#L9330"],
        fields: { prompt: "message" },
        required: ["prompt"],
        promptLimit: 240,
        promptLimitUnit: "grapheme",
        note: "Requires a connected Gateway. The iOS app asks for confirmation before starting a run.",
      },
    },
  },
} as const satisfies Record<string, Omit<Agent, "id">>;

export type AgentId = keyof typeof catalog;

const ids = Object.keys(catalog) as AgentId[];

export const agents: Readonly<Record<AgentId, Agent & { readonly id: AgentId }>> =
  Object.freeze(Object.fromEntries(ids.map((id) => [id, { id, ...catalog[id] }])) as Record<AgentId, Agent & { readonly id: AgentId }>);

export function getAgent(agent: AgentId): Agent {
  return agents[agent];
}

export function getAgentRoute(agent: AgentId, platform: Platform): AgentRoute | null {
  if (!Object.hasOwn(agents, agent)) return null;
  const routes = agents[agent].routes;
  return Object.hasOwn(routes, platform) ? routes[platform] ?? null : null;
}
