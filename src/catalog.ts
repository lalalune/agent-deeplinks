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
  | "provider" | "model" | "botId" | "folder" | "server" | "mode" | "branch";

export interface AgentRoute {
  readonly url: string;
  readonly behavior: LinkBehavior;
  readonly evidence: Evidence;
  readonly sources: readonly string[];
  readonly note?: string;
  readonly fields?: Readonly<Partial<Record<LinkField, string>>>;
  readonly required?: readonly LinkField[];
  readonly launchUrl?: string;
  readonly serverBehavior?: LinkBehavior;
  readonly promptLimit?: number;
  readonly promptLimitUnit?: "grapheme";
  readonly urlLimit?: number;
  readonly query?: Readonly<Record<string, string>>;
  readonly browserOnlyFragment?: string;
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
const cursorCloudDocs = "https://cursor.com/docs/cloud-agent";
const cursorCloud = "https://cursor.com/agents";
const claudeCodeDocs = "https://code.claude.com/docs/en/deep-links";
const claudeDesktopDocs = "https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link";
const claudeMobileDocs = "https://support.claude.com/en/articles/14898120-open-the-claude-mobile-app-with-a-link";
const codexDocs = "https://learn.chatgpt.com/docs/reference/commands";
const codexMobile = "https://chatgpt.com/app/codex";
const grokBotDocs = "https://docs.x.ai/grok-bot/deep-links";
const t3Source = "https://github.com/pingdotgg/t3code/blob/v0.1.11/packages/shared/src/promptLinks.ts";
const openCodeTag = "https://github.com/anomalyco/opencode/blob/v1.19.6";
const openCodeDesktopTag = "https://github.com/anomalyco/opencode/blob/v2.4.1";
const claudeIosAssociation = "https://claude.ai/.well-known/apple-app-site-association";
const claudeCachedIosAssociation = "https://app-site-association.cdn-apple.com/a/v1/claude.ai";
const slopDate = "https://slop.date/";
const slopCash = "https://slop.cash/";
const vibestack = "https://vibestack.fun/";
const cursorIosAssociation = "https://cursor.com/.well-known/apple-app-site-association";
const grokIosAssociation = "https://grok.com/.well-known/apple-app-site-association";
const grokAndroidAssociation = "https://grok.com/.well-known/assetlinks.json";
const geminiIos = "https://gemini.google.com/app/download/ios";
const geminiAndroid = "https://gemini.google.com/gemini/download/mobile";
const geminiIosAssociation = "https://gemini.google.com/.well-known/apple-app-site-association";
const geminiAndroidAssociation = "https://gemini.google.com/.well-known/assetlinks.json";
const kimiMobile = "https://kimi.onelink.me/BZg1/";
const perplexitySearchSpec = "https://www.perplexity.ai/opensearch.xml";
const perplexityIosAssociation = "https://www.perplexity.ai/.well-known/apple-app-site-association";

const antigravityMobileRoute = {
  url: "https://antigravity.google.com/",
  behavior: "launch",
  evidence: "documented",
  sources: ["https://antigravity.google/docs/remote-control/#connecting-from-a-web-browser", "https://antigravity.google.com/assets/manifest.json"],
  note: "Opens Antigravity’s Remote Control dashboard in a mobile browser. It can be installed to the home screen as a web app.",
} as const satisfies AgentRoute;

const cursorRoute = {
  behavior: "draft",
  evidence: "documented",
  sources: [cursorDocs],
  fields: { prompt: "text" },
  required: ["prompt"],
  urlLimit: 10_000,
} as const satisfies Omit<AgentRoute, "url">;

const claudeCodeMobileRoute = {
  url: "claude://code/new",
  launchUrl: "claude://code",
  behavior: "draft",
  evidence: "documented",
  sources: [claudeMobileDocs],
  fields: { prompt: "q", mode: "mode", repo: "repo", branch: "branch" },
  note: "Requires Claude Code access on your account. An empty link opens the session list.",
} as const satisfies AgentRoute;

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

const perplexitySearchRoute = {
  url: "https://www.perplexity.ai/search",
  behavior: "send",
  evidence: "source",
  sources: [perplexitySearchSpec, slopDate],
  fields: { prompt: "q" },
  required: ["prompt"],
  query: { s: "o" },
  note: "Starts a Perplexity search, which may submit immediately on open.",
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
        launchUrl: cursorCloud,
        behavior: "handoff",
        sources: [cursorDocs, cursorCloudDocs],
        note: "A prompt opens the landing page for the desktop editor. An empty link opens Cloud Agents in the browser.",
      },
      desktop: {
        ...cursorRoute,
        url: "cursor://anysphere.cursor-deeplink/prompt",
        sources: [cursorDocs, "https://cursor.com/download"],
        note: "Cursor 3.31.15 accepted the link on macOS and the Linux DEB declares a handler. Signed-in composer prefill is unverified.",
      },
      ios: {
        url: cursorCloud,
        behavior: "launch",
        evidence: "source",
        sources: [cursorIosAssociation, "https://cursor.com/docs/cloud-agent/mobile"],
        note: "Universal Link for the Cursor Cloud Agents inbox.",
      },
      android: {
        url: cursorCloud,
        behavior: "launch",
        evidence: "documented",
        sources: [cursorCloudDocs],
        note: "Opens Cloud Agents in Chrome. Cursor offers it as an installable web app on Android.",
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
        launchUrl: "https://grok.com/?stay_in_browser=true",
        behavior: "unknown",
        evidence: "observed",
        sources: [slopDate, grokIosAssociation, grokAndroidAssociation],
        fields: { prompt: "q" },
        query: { stay_in_browser: "true" },
        experimental: true,
        note: "Slop Date publishes this format. The signed-out browser test showed an empty composer.",
      },
      ios: {
        url: "https://grok.com/",
        behavior: "launch",
        evidence: "source",
        sources: [grokIosAssociation],
        note: "Grok iOS associates this URL. Web can open when the app is unavailable.",
      },
      android: {
        url: "https://grok.com/",
        behavior: "launch",
        evidence: "source",
        sources: [grokAndroidAssociation],
        note: "Grok’s Android 15 App Link rules include the root URL. Native delivery remains unverified.",
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
      desktop: {
        ...grokBotRoute,
        sources: [grokBotDocs, "https://docs.x.ai/grok-bot/get-started"],
        note: "Documented for the signed-in Windows, macOS, and Linux app. Uses your primary Bot unless a Bot ID is supplied.",
      },
      ios: grokBotRoute,
      android: grokBotRoute,
    },
  },
  gemini: {
    name: "Gemini",
    home: "https://gemini.google.com/",
    description: "Google’s AI assistant",
    routes: {
      web: {
        url: "https://gemini.google.com/app",
        launchUrl: "https://gemini.google.com/app",
        behavior: "unknown",
        evidence: "observed",
        sources: [
          slopDate,
          "https://chromium.googlesource.com/chromium/src/+/refs/tags/140.0.7339.81/components/search_engines/template_url_starter_pack_data.cc",
        ],
        fields: { prompt: "q" },
        required: ["prompt"],
        experimental: true,
        note: "Slop Date uses this older Chrome format. The signed-out browser test showed an empty composer. Signed-in submission behavior is unconfirmed.",
      },
      ios: {
        url: geminiIos,
        behavior: "handoff",
        evidence: "source",
        sources: [geminiIosAssociation, geminiIos],
        note: "Gemini’s iOS Universal Link. The browser fallback opens the App Store.",
      },
      android: {
        url: geminiAndroid,
        behavior: "handoff",
        evidence: "source",
        sources: [geminiAndroidAssociation, geminiAndroid],
        note: "Matched the installed Gemini app on Android. A device may show a chooser or fall back to Google Play.",
      },
    },
  },
  perplexity: {
    name: "Perplexity",
    home: "https://www.perplexity.ai/",
    description: "AI search and research",
    routes: {
      web: { ...perplexitySearchRoute, launchUrl: "https://www.perplexity.ai/" },
      ios: {
        ...perplexitySearchRoute,
        sources: [perplexityIosAssociation, perplexitySearchSpec],
        note: "iOS associates the search path with the app. The web fallback may submit immediately. Native query handling is unverified.",
      },
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
      web: {
        url: "https://muse.ai/chat?nr=1",
        behavior: "launch",
        evidence: "observed",
        sources: ["https://www.meta.com/en-gb/help/superintelligence/1331373868832401/", "https://muse.ai/.well-known/apple-app-site-association"],
        note: "Opens Muse in the browser. A signed-out browser reaches the Muse sign-in page.",
      },
      desktop: {
        url: "https://agent.meta.ai/chat",
        behavior: "launch",
        evidence: "source",
        sources: ["https://agent.meta.ai/.well-known/apple-app-site-association", "https://ai.meta.com/muse/"],
        note: "Muse 13.1 for macOS declares this Universal Link. Native delivery still needs a live check.",
      },
      ios: {
        url: "https://applink.muse.ai/",
        behavior: "launch",
        evidence: "source",
        sources: ["https://ai.meta.com/muse/", "https://applink.muse.ai/.well-known/apple-app-site-association"],
        note: "The iOS handoff advertised by Meta for the Muse app.",
      },
      android: {
        url: "https://applink.muse.ai/",
        behavior: "handoff",
        evidence: "source",
        sources: ["https://ai.meta.com/muse/", "https://applink.muse.ai/.well-known/assetlinks.json", "https://play.google.com/store/apps/details?id=com.facebook.aura"],
        note: "Meta associates this host with Muse. Android browser requests returned HTTP 400. Native routing remains unverified.",
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
        launchUrl: "https://claude.ai/new",
        behavior: "unknown",
        evidence: "observed",
        sources: [slopDate, claudeCachedIosAssociation],
        fields: { prompt: "q" },
        browserOnlyFragment: "no_universal_links",
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
      android: {
        url: "https://play.google.com/store/apps/details?id=com.anthropic.claude",
        behavior: "handoff",
        evidence: "documented",
        sources: ["https://support.claude.com/en/articles/9612887-install-claude-for-android"],
        note: "Opens Claude’s official Google Play listing. Native chat routing is unverified.",
      },
    },
  },
  "claude-code": {
    name: "Claude Code",
    home: "https://code.claude.com/",
    description: "Anthropic’s coding agent",
    routes: {
      web: {
        ...claudeCodeMobileRoute,
        url: "https://claude.ai/code/new",
        launchUrl: "https://claude.ai/code",
        browserOnlyFragment: "no_universal_links",
        sources: [claudeMobileDocs, "https://code.claude.com/docs/en/claude-code-on-the-web", claudeCachedIosAssociation],
        note: "Opens the new-session composer. Requires Claude Code cloud-session access.",
      },
      desktop: {
        url: "claude://code/new",
        behavior: "draft",
        evidence: "verified",
        sources: [claudeDesktopDocs],
        fields: { prompt: "q", folder: "folder" },
        note: "Prefill verified in Claude Desktop’s Code tab in 6.28899.6 on macOS.",
      },
      ios: claudeCodeMobileRoute,
      android: claudeCodeMobileRoute,
      cli: {
        url: "claude-cli://open",
        behavior: "draft",
        evidence: "documented",
        sources: [claudeCodeDocs],
        fields: { prompt: "q", cwd: "cwd", repo: "repo" },
        promptLimit: 5_000,
        note: "macOS delivery of the exact draft to the terminal process was checked. cwd takes precedence over repo.",
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
        note: "ChatGPT Desktop 26.1117.41037 passes Chat mode and the prompt to its composer. Visible prefill remains unverified.",
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
      android: {
        url: "https://chatgpt.com/app",
        behavior: "handoff",
        evidence: "observed",
        sources: ["https://chatgpt.com/app", "https://chatgpt.com/.well-known/assetlinks.json"],
        note: "Android browsers reach the official Google Play listing. Installed-app routing is unverified.",
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
        launchUrl: "codex://threads/new",
        note: "macOS dispatch checked. The desktop handler tries an existing local path before matching the Git remote.",
      },
      ios: {
        url: codexMobile,
        behavior: "handoff",
        evidence: "source",
        sources: ["https://chatgpt.com/.well-known/apple-app-site-association", codexMobile],
        note: "Matches ChatGPT’s wrapped iOS App Link. The browser falls back to the official App Store listing.",
      },
      android: {
        url: codexMobile,
        behavior: "handoff",
        evidence: "observed",
        sources: [codexMobile, "https://learn.chatgpt.com/docs/mobile"],
        note: "Android browser requests redirect to ChatGPT on Google Play. Installed-app routing is unverified.",
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
      ios: antigravityMobileRoute,
      android: antigravityMobileRoute,
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
      ios: {
        url: kimiMobile,
        behavior: "handoff",
        evidence: "source",
        sources: ["https://kimi.onelink.me/.well-known/apple-app-site-association", kimiMobile],
        note: "Associated with Kimi for iOS. The browser fallback opens the App Store.",
      },
      android: {
        url: "kimi://page/chat",
        launchUrl: kimiMobile,
        behavior: "draft",
        evidence: "source",
        sources: ["https://www.kimi.com/download", "https://kimi.onelink.me/.well-known/assetlinks.json", kimiMobile],
        fields: { prompt: "prompt" },
        required: ["prompt"],
        query: { create_new: "true", auto_send: "false" },
        experimental: true,
        note: "Kimi 3.1.5 opened to first-launch consent on Android 16. Visible prefill remains unverified. An empty link uses the app and Google Play handoff.",
      },
    },
  },
  zcode: {
    name: "ZCode",
    home: "https://zcode.z.ai/",
    description: "Z.ai’s coding client",
    routes: {
      desktop: {
        url: "zcode://workspace/open",
        behavior: "launch",
        evidence: "source",
        sources: ["https://zcode.z.ai/en"],
        fields: { directory: "path" },
        required: ["directory"],
        note: "Opens a local folder after confirmation. macOS accepted the URI in ZCode 4.0.0. The bundle also declares Windows and Linux registration code.",
      },
    },
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
        serverBehavior: "draft",
        fields: { ...t3Route.fields, server: "" },
        note: "Leave the server blank for T3’s hosted chooser. With a server origin, draft prefill works in a previously paired, connected browser. Tested in v0.1.11.",
      },
      desktop: {
        ...t3Route,
        url: "t3code://new",
        evidence: "verified",
        sources: [t3Source, "https://github.com/pingdotgg/t3code/blob/v0.1.11/scripts/build-desktop-artifact.ts"],
        note: "Draft verified on macOS in v0.1.11. Its Linux DEB registers the handler. Windows browser-to-app registration is unverified.",
      },
      ios: { ...t3Route, url: "t3code://new", note: "Requires a connected environment." },
      android: {
        ...t3Route,
        url: "t3code://new",
        evidence: "verified",
        sources: [t3Source, "https://github.com/pingdotgg/t3code/releases/tag/v0.1.12-nightly.20261123.5165"],
        note: "Draft prefill verified in the signed 2.3.0 beta on Android 16 after pairing to a connected environment.",
      },
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
        launchUrl: "opencode://",
        behavior: "draft",
        evidence: "verified",
        sources: [
          `${openCodeDesktopTag}/packages/app/src/shell/deep-links/deep-links.ts`,
          `${openCodeDesktopTag}/packages/app/src/shell/deep-links/machine.ts`,
          `${openCodeDesktopTag}/packages/desktop/src/main/lifecycle/launch-links.ts`,
        ],
        fields: { prompt: "prompt", directory: "directory" },
        required: ["directory"],
        note: "Draft and project verified on macOS 2.4.1. The Linux DEB registers the scheme. Windows handles URL arguments in source. macOS 1.19.6 left the composer empty.",
      },
      android: {
        url: "opencode://",
        behavior: "launch",
        evidence: "source",
        sources: ["https://github.com/anomalyco/opencode-android/blob/v0.8.7/app/src/main/AndroidManifest.xml"],
        note: "Opens the Android client. The app handles sessions and pairing through separate routes.",
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
        fields: { server: "" },
        note: "Opens your Hermes Webapp. Use the Web Access address for another device, or leave it blank for this machine.",
      },
      desktop: {
        url: "hermes://launch",
        behavior: "launch",
        evidence: "verified",
        sources: [
          "https://hermes-agent.nousresearch.com/docs/user-guide/desktop#settings--onboarding",
          "https://hermes-agent.nousresearch.com/docs/getting-started/platform-support#build-targets-and-support-priority",
        ],
        note: "Opened the native Sessions window in the macOS 0.23.3 canary. Windows and Linux delivery are present in canary source. Linux desktop builds are local only.",
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
        evidence: "verified",
        sources: ["https://docs.openclaw.ai/web/control-ui"],
        fields: { server: "" },
        note: "Rendered OpenClaw Control against an isolated Gateway v2026.6.11. Enter your configured URL or leave it blank for the default local Gateway.",
      },
      desktop: {
        url: "openclaw://agent",
        behavior: "confirm",
        evidence: "source",
        sources: ["https://github.com/openclaw/openclaw/blob/main/apps/macos/Sources/OpenClaw/DeepLinks.swift"],
        fields: { prompt: "message" },
        required: ["prompt"],
        launchUrl: "openclaw://dashboard",
        promptLimit: 240,
        promptLimitUnit: "grapheme",
        note: "A prompt opens a run confirmation. On macOS 2026.11.7, the blank link reached the dashboard handler, which requires a configured Gateway.",
      },
      ios: {
        url: "openclaw://agent",
        behavior: "confirm",
        evidence: "source",
        sources: ["https://github.com/openclaw/openclaw/blob/main/apps/ios/Sources/Model/NodeAppModel.swift#L9330"],
        fields: { prompt: "message" },
        required: ["prompt"],
        launchUrl: "openclaw://dashboard",
        promptLimit: 240,
        promptLimitUnit: "grapheme",
        note: "Leave the prompt blank to open the dashboard. Running a prompt requires a connected Gateway and confirmation.",
      },
    },
  },
} as const satisfies Record<string, Omit<Agent, "id">>;

export type AgentId = keyof typeof catalog;

const ids = Object.keys(catalog) as AgentId[];
type CatalogAgent = Agent & { readonly id: AgentId };
const agentEntries = ids.map((id): [AgentId, CatalogAgent] => [id, { id, ...catalog[id] }]);

export const agents: Readonly<Record<AgentId, CatalogAgent>> =
  Object.freeze(Object.fromEntries(agentEntries) as Record<AgentId, CatalogAgent>);

export function getAgent(agent: AgentId): Agent {
  return agents[agent];
}

export function getAgentRoute(agent: AgentId, platform: Platform): AgentRoute | null {
  if (!Object.hasOwn(agents, agent)) return null;
  const routes = agents[agent].routes;
  return Object.hasOwn(routes, platform) ? routes[platform] ?? null : null;
}
