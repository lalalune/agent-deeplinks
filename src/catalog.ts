export const platforms = ["web", "desktop", "ios", "android", "cli", "vscode"] as const;
export type Platform = (typeof platforms)[number];

export const platformNames: Readonly<Record<Platform, string>> = {
  web: "Web",
  desktop: "Desktop",
  ios: "iOS",
  android: "Android",
  cli: "CLI",
  vscode: "VS Code",
};

export type Evidence = "documented" | "source" | "observed" | "verified";

export type LinkBehavior = "draft" | "launch" | "handoff" | "confirm" | "send" | "unknown";

export type LinkField =
  | "prompt" | "cwd" | "repo" | "path" | "originUrl" | "directory"
  | "provider" | "model" | "botId" | "folder" | "server" | "mode" | "branch"
  | "session" | "pr" | "customAgent" | "workspace";

export interface AgentRoute {
  readonly url: string;
  readonly behavior: LinkBehavior;
  readonly evidence: Evidence;
  readonly sources: readonly string[];
  readonly note?: string;
  readonly fields?: Readonly<Partial<Record<LinkField, string>>>;
  readonly required?: readonly LinkField[];
  readonly launchUrl?: string;
  readonly launcher?: { readonly appUrl: string; readonly parameter: string };
  readonly modes?: readonly string[];
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
const claudeDesktopChecks = [
  claudeDesktopDocs,
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45460279575/job/138680666371",
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45460279575/job/138680666686",
] as const;
const claudeMobileDocs = "https://support.claude.com/en/articles/14898120-open-the-claude-mobile-app-with-a-link";
const claudeVsCodeDocs = "https://code.claude.com/docs/en/vs-code#launch-a-vs-code-tab-from-other-tools";
const codexDocs = "https://learn.chatgpt.com/docs/reference/commands";
const codexMobile = "https://chatgpt.com/app/codex";
const openAiDesktopChecks = [
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45449086076/job/138640907273",
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45450367734/job/138645480431",
] as const;
const grokBotDocs = "https://docs.x.ai/grok-bot/deep-links";
const grokBotMobileDocs = "https://docs.x.ai/grok-bot/mobile";
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
const kimiCodeTag = "https://github.com/MoonshotAI/kimi-code/blob/kimi-code-desktop%401.4.3";
const kimiCodeWebDocs = "https://www.kimi.com/code/docs/en/kimi-code-cli/guides/web.html";
const kimiCodeRemoteDocs = "https://www.kimi.com/code/docs/en/kimi-code-cli/guides/remote-control.html";
const perplexitySearchSpec = "https://www.perplexity.ai/opensearch.xml";
const perplexityIosAssociation = "https://www.perplexity.ai/.well-known/apple-app-site-association";
const copilotDocs = "https://docs.github.com/en/copilot/how-tos/github-copilot-app/open-with-deep-links";
const copilotHome = "https://github.com/copilot";
const copilotSession = "ghapp://session/new";

const copilotDraftRoute = {
  behavior: "draft",
  evidence: "documented",
  sources: [copilotDocs],
  fields: { prompt: "prompt", repo: "repo", branch: "branch", pr: "pr", mode: "mode", customAgent: "agent" },
  modes: ["plan", "interactive", "autopilot"],
} as const satisfies Omit<AgentRoute, "url">;

const antigravityMobileRoute = {
  url: "https://antigravity.google.com/",
  behavior: "launch",
  evidence: "verified",
  sources: ["https://antigravity.google/docs/remote-control/#connecting-from-a-web-browser", "https://antigravity.google.com/assets/manifest.json"],
  note: "Opens Antigravity Remote Control in a mobile browser. Sign-in verified in iPhone WebKit and Android Chromium profiles. Google supports adding it to the home screen.",
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
  modes: ["plan", "code"],
  note: "Requires Claude Code access on your account. An empty link opens the session list.",
} as const satisfies AgentRoute;

const zcodeRemoteRoute = {
  url: "https://zcode.z.ai/remote/v4?app_version=4.0.0",
  behavior: "launch",
  evidence: "source",
  sources: ["https://zcode.z.ai/en/docs/remote-control", "https://zcode.z.ai/remote/v4/4.0.0/assets/index-FxFL5k5N.js"],
  note: "Opens the ZCode 4.0.0 Remote Control sign-in page. Connect using the same account and region as an online desktop with Remote Control enabled.",
} as const satisfies AgentRoute;

const hermesMobileRoute = {
  url: "http://127.0.0.1:9120/",
  behavior: "launch",
  evidence: "verified",
  sources: ["https://hermes-agent.nousresearch.com/docs/user-guide/desktop#open-it-from-your-phone-or-another-computer"],
  fields: { server: "" },
  required: ["server"],
  note: "Opens your configured Hermes Web Access address in a phone browser. Its sign-in page was verified in Android Chromium and iPhone WebKit profiles.",
} as const satisfies AgentRoute;

const kimiCodeBrowserRoute = {
  url: "https://code-rc.kimi.ai/",
  behavior: "launch",
  evidence: "verified",
  sources: [kimiCodeRemoteDocs, kimiCodeWebDocs],
  fields: { server: "" },
  note: "Hosted Remote Control opens the device picker and needs the same Kimi account as the host. With a local server address, its token unlocked the browser workbench on desktop, Android, and iPhone profiles.",
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
        evidence: "verified",
        sources: [cursorDocs, cursorCloudDocs],
        note: "The browser handoff displayed the draft and produced the exact native link. An empty link opens Cloud Agents in the browser.",
      },
      desktop: {
        ...cursorRoute,
        url: "cursor://anysphere.cursor-deeplink/prompt",
        sources: [
          cursorDocs,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45460026095/job/138679769952",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45460380555/job/138681026834",
        ],
        note: "macOS and Ubuntu opened Cursor Agents at sign-in. Windows received the exact link after first launch registered Cursor's handler. Signed-in composer prefill remains unverified.",
      },
      ios: {
        url: cursorCloud,
        behavior: "launch",
        evidence: "source",
        sources: [cursorIosAssociation, "https://cursor.com/docs/cloud-agent/mobile"],
        note: "Universal Link for the Cursor Cloud Agents inbox. The iPhone browser fallback reached Cursor sign-in.",
      },
      android: {
        url: cursorCloud,
        behavior: "launch",
        evidence: "verified",
        sources: [cursorCloudDocs],
        note: "The Cloud Agents link reached Cursor sign-in in Android Chromium. Cursor offers Cloud Agents as an installable web app on Android.",
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
        evidence: "verified",
        note: "The handoff attempts to open Grok Bot. The button and automatic dispatch used the exact native URL in desktop and mobile browser profiles.",
      },
      desktop: {
        ...grokBotRoute,
        sources: [
          grokBotDocs,
          "https://docs.x.ai/grok-bot/get-started",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45461984963/job/138686754025",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45461984963/job/138686754337",
        ],
        note: "Stock Ubuntu and Windows apps received the exact link and opened at sign-in. Drafts require a signed-in eligible account and use the primary Bot unless you supply a Bot ID.",
      },
      ios: {
        ...grokBotRoute,
        sources: [grokBotDocs, grokBotMobileDocs, "https://apps.apple.com/us/app/grok-bot/id6794501026"],
        note: "Requires the installed Grok Bot app and an eligible Cursor account. Uses your primary Bot unless you supply a Bot ID. Native delivery remains unverified.",
      },
      android: {
        ...grokBotRoute,
        sources: [grokBotDocs, grokBotMobileDocs, "https://play.google.com/store/apps/details?id=ai.x.grok.bot"],
        note: "Requires the installed Grok Bot app and an eligible Cursor account. Uses your primary Bot unless you supply a Bot ID. Native delivery remains unverified.",
      },
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
        evidence: "verified",
        sources: ["https://www.meta.com/en-gb/help/superintelligence/1331373868832401/", "https://muse.ai/.well-known/apple-app-site-association"],
        note: "Opens Muse in the browser. A signed-out browser reaches the Muse sign-in page.",
      },
      desktop: {
        url: "https://agent.meta.ai/chat",
        behavior: "launch",
        evidence: "verified",
        sources: [
          "https://agent.meta.ai/.well-known/apple-app-site-association",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45450575543/job/138646218114",
        ],
        note: "On macOS, this Universal Link selected Muse 13.1 after the app's first launch and domain approval. Fresh installations can open Safari while macOS verifies the domain.",
      },
      ios: {
        url: "https://applink.muse.ai/",
        behavior: "launch",
        evidence: "source",
        sources: ["https://ai.meta.com/muse/", "https://applink.muse.ai/.well-known/apple-app-site-association"],
        note: "Meta’s iOS app handoff. The exact browser fallback reached the Muse from Meta App Store listing.",
      },
      android: {
        url: "https://play.google.com/store/apps/details?id=com.facebook.aura",
        behavior: "handoff",
        evidence: "verified",
        sources: ["https://play.google.com/store/apps/details?id=com.facebook.aura", "https://ai.meta.com/muse/"],
        note: "Meta’s official listing and Install button rendered in Android Chromium. Installed-app routing remains unverified.",
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
        sources: claudeDesktopChecks,
        fields: { prompt: "q" },
        note: "Prefill verified in Claude 6.28899.6 on macOS. Windows and Ubuntu received the exact link and showed first-run onboarding. Signed-in composers on those platforms still need verification.",
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
        sources: claudeDesktopChecks,
        fields: { prompt: "q", folder: "folder" },
        note: "Prefill verified in Claude Desktop’s Code tab in 6.28899.6 on macOS. Windows and Ubuntu received the exact link and showed first-run onboarding. Signed-in composers on those platforms still need verification.",
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
        note: "macOS terminal delivery checked. The fresh local Claude Code session reached account selection. Anthropic also documents the Windows and Linux handlers. cwd takes precedence over repo.",
      },
      vscode: {
        url: "vscode://anthropic.claude-code/open",
        launchUrl: "vscode://anthropic.claude-code/open",
        behavior: "draft",
        evidence: "documented",
        sources: [claudeVsCodeDocs, claudeCodeDocs, "https://github.com/lalalune/agent-deeplinks/actions/runs/45454069271/job/138658637744"],
        fields: { prompt: "prompt", session: "session" },
        note: "Requires the Claude Code extension for VS Code. The stock Ubuntu extension opened its sign-in screen from this link. A fresh tab can prefill a draft or resume a session, and an open session keeps its existing draft.",
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
        sources: [
          "https://chatgpt.com/cdn/assets/617936.82c33d1781.js",
          "https://learn.chatgpt.com/docs/enterprise/windows-deployment",
          ...openAiDesktopChecks,
        ],
        fields: { prompt: "prompt" },
        query: { mode: "chat" },
        note: "The stock Windows and Ubuntu clients received the Chat-mode URL. Visible composer prefill remains unverified.",
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
        note: "An iOS Universal Link for a blank ChatGPT conversation. The iPhone browser fallback rendered signed-out ChatGPT.",
      },
      android: {
        url: "https://chatgpt.com/app",
        behavior: "handoff",
        evidence: "verified",
        sources: ["https://chatgpt.com/app", "https://chatgpt.com/.well-known/assetlinks.json"],
        note: "Android Chromium rendered ChatGPT’s official Google Play listing and Install button. Installed-app routing is unverified.",
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
        sources: [codexDocs, ...openAiDesktopChecks],
        fields: { prompt: "prompt", path: "path", originUrl: "originUrl" },
        launchUrl: "codex://threads/new",
        note: "Native dispatch checked on macOS, Windows, and Ubuntu. Visible composer prefill remains unverified. The handler tries an existing local path before matching the Git remote.",
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
        evidence: "verified",
        sources: [codexMobile, "https://learn.chatgpt.com/docs/mobile"],
        note: "Android Chromium rendered the ChatGPT Google Play listing and Install button. Installed-app routing is unverified.",
      },
    },
  },
  "github-copilot": {
    name: "GitHub Copilot",
    home: copilotHome,
    description: "GitHub’s coding agent and desktop app",
    routes: {
      web: {
        ...copilotDraftRoute,
        url: "https://github.com/copilot/app/launch",
        behavior: "handoff",
        launchUrl: copilotHome,
        launcher: { appUrl: copilotSession, parameter: "open" },
        note: "Opens GitHub’s app launcher with a draft to review. Leave the inputs empty to open Copilot on GitHub.com.",
      },
      desktop: {
        ...copilotDraftRoute,
        url: copilotSession,
        note: "The GitHub Copilot app asks to allow the link and opens a session draft. Supply a prompt, repository, or custom agent.",
      },
      vscode: {
        url: "vscode://agents/new",
        behavior: "draft",
        evidence: "documented",
        sources: ["https://code.visualstudio.com/docs/configure/command-line#_prepare-a-new-agent-session-draft"],
        fields: { prompt: "prompt", workspace: "workspace" },
        note: "Opens the VS Code Agents window. Pass a file or VS Code remote folder URI to select a workspace.",
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
        evidence: "verified",
        sources: ["https://antigravity.google/docs/remote-agents"],
        note: "Opened Google’s Remote Agents sign-in screen in desktop Chromium. Remote Agents access depends on your account.",
      },
      desktop: {
        url: "antigravity://",
        behavior: "launch",
        evidence: "verified",
        sources: [
          "https://github.com/lalalune/agent-deeplinks/blob/main/research/coding-agents.md#google-antigravity",
          "https://antigravity.google/docs/getting-started",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45440108720",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45472689543/job/138724578504",
        ],
        note: "App activation verified on macOS and Windows. Antigravity 2.35.0 showed its native welcome screen on Ubuntu from the exact link through a per-user XDG handler. The stock Linux tarball needs this registration for browser handoff.",
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
        sources: [
          "https://www.kimi.com/en/products/download",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45442744851",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45469092283/job/138711836543",
        ],
        note: "Kimi 3.2.28 opened its native window on Windows and Apple Silicon macOS. The stock macOS link opened Work behind sign-in.",
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
        note: "The blank HTTPS link opened Kimi 3.1.5 on Android 16 through verified App Links. The experimental prompt link reached first-launch consent. Visible prefill remains unverified.",
      },
    },
  },
  "kimi-code": {
    name: "Kimi Code",
    home: "https://www.kimi.com/code",
    description: "Moonshot AI’s standalone coding agent",
    routes: {
      web: kimiCodeBrowserRoute,
      desktop: {
        url: "kimi-code://open",
        behavior: "launch",
        evidence: "verified",
        sources: [
          "https://www.kimi.com/code/docs/en/kimi-code-cli/reference/kimi-command.html#kimi-app",
          `${kimiCodeTag}/apps/desktop/src/main/app/deep-link.ts`,
          `${kimiCodeTag}/apps/desktop/electron-builder.config.cjs`,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45443027619",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45462207481/job/138687549013",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45462737149/job/138689443148",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45465703943/job/138699902296",
        ],
        fields: { directory: "root" },
        required: ["directory"],
        query: { new: "1" },
        note: "Opens an absolute local directory with a fresh draft. Kimi Code 1.4.3 selected the requested workspace on Ubuntu, macOS, and Windows. The Windows cold launch showed a blank composer after approving the empty scratch project.",
      },
      ios: kimiCodeBrowserRoute,
      android: kimiCodeBrowserRoute,
    },
  },
  zcode: {
    name: "ZCode",
    home: "https://zcode.z.ai/",
    description: "Z.ai’s coding client",
    routes: {
      web: zcodeRemoteRoute,
      ios: zcodeRemoteRoute,
      android: zcodeRemoteRoute,
      desktop: {
        url: "zcode://workspace/open",
        behavior: "launch",
        evidence: "verified",
        sources: [
          "https://zcode.z.ai/en",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45443909533",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45450238281",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45466986353/job/138704399939",
        ],
        fields: { directory: "path" },
        required: ["directory"],
        note: "ZCode 4.0.0 showed the exact requested folder in native review on macOS and Ubuntu. Windows Shell delivery also passed. The signed-in workspace view remains unverified.",
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
        sources: [...t3Route.sources, "https://github.com/pingdotgg/t3code/blob/v0.1.11/docs/user/remote-access.md"],
        note: "Leave the server blank for T3’s hosted chooser. After pairing a browser to a self-hosted T3 server, the exact link opened a fresh draft directly, including after a Chromium restart with T3 Code 0.1.11.",
      },
      desktop: {
        ...t3Route,
        url: "t3code://new",
        evidence: "verified",
        sources: [
          t3Source,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45440501819/job/138609961589",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45440877037/job/138611312447",
        ],
        note: "Exact unsent draft verified in T3 Code 0.1.11 on macOS, Ubuntu, and Windows. The Windows app registered t3code: on first launch.",
      },
      ios: {
        ...t3Route,
        url: "t3code://new",
        evidence: "verified",
        sources: [t3Source, "https://github.com/pingdotgg/t3code/tree/67c442a17e6e5d6c9f768714820cecb5f15d4f9b/apps/mobile"],
        note: "Exact unsent draft verified in a 2.3.0 Release build on the iOS 26.4 simulator after pairing to a connected environment.",
      },
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
        sources: [
          "https://opencode.ai/docs/cli/web/",
          `${openCodeDesktopTag}/packages/app/src/shell/routes/routes.tsx`,
          `${openCodeTag}/packages/app/src/app.tsx#L636`,
        ],
        fields: { directory: "", server: "" },
        required: ["server"],
        note: "For OpenCode 2.x, enter the server origin and leave the directory blank. The optional project directory uses the 1.x web route. OpenCode 2.4.1 showed Projects after local browser authentication.",
      },
      desktop: {
        url: "opencode://new-session",
        launchUrl: "opencode://",
        behavior: "draft",
        evidence: "verified",
        sources: [
          `${openCodeDesktopTag}/packages/app/src/shell/deep-links/deep-links.ts`,
          `${openCodeDesktopTag}/packages/app/src/shell/deep-links/machine.ts`,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45441299990",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45476049765/job/138736464339",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45461928704/job/138686555105",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45463426685/job/138691873897",
        ],
        fields: { prompt: "prompt", directory: "directory" },
        required: ["directory"],
        note: "OpenCode 2.4.1 showed the requested project and exact unsent draft on cold launch in macOS, Ubuntu, and Windows. Warm delivery also passed on macOS and Windows.",
      },
      ios: {
        url: "http://localhost:4096",
        behavior: "launch",
        evidence: "verified",
        sources: ["https://opencode.ai/docs/cli/web/", "https://opencode.ai/mobile"],
        fields: { server: "" },
        required: ["server"],
        note: "Opens your OpenCode server in a browser. The 2.4.1 Projects menu was verified in an iPhone WebKit profile after local authentication.",
      },
      android: {
        url: "opencode://",
        behavior: "launch",
        evidence: "source",
        sources: [
          "https://github.com/anomalyco/opencode-android/blob/v0.8.8/app/src/main/AndroidManifest.xml",
          "https://github.com/anomalyco/opencode-android/blob/v0.8.8/server/src/main/kotlin/ai/opencode/server/OpenCodePairingLink.kt",
        ],
        note: "Opens the Android client. Use getOpenCodeAndroidPairingLink with an issued URL to open pairing review. The official development build paired with OpenCode 2.4.1 and showed a blank session in the paired project.",
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
        evidence: "verified",
        sources: ["https://hermes-agent.nousresearch.com/docs/user-guide/desktop#use-the-desktop-workspace-from-a-browser"],
        fields: { server: "" },
        note: "Run hermes webapp for its one-use sign-in link. The 0.23.3 canary kept the browser signed in when it reopened the tokenless URL and showed an empty session view with model setup. For another device, enter your configured Web Access address.",
      },
      desktop: {
        url: "hermes://launch",
        behavior: "launch",
        evidence: "verified",
        sources: [
          "https://hermes-agent.nousresearch.com/docs/user-guide/desktop#settings--onboarding",
          "https://hermes-agent.nousresearch.com/docs/getting-started/platform-support#build-targets-and-support-priority",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45466169262/job/138701535869",
        ],
        note: "The 0.23.3 canary opened Sessions on macOS and a native window from the signed MSIX on Windows. Linux desktop delivery is present in source and available through local builds.",
      },
      ios: hermesMobileRoute,
      android: hermesMobileRoute,
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
        evidence: "verified",
        sources: [
          "https://github.com/openclaw/openclaw/blob/v2026.11.7/apps/macos/Sources/OpenClaw/DeepLinks.swift",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45473423005/job/138727187042",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45476772927/job/138738941929",
        ],
        fields: { prompt: "message" },
        required: ["prompt"],
        launchUrl: "openclaw://dashboard",
        promptLimit: 240,
        promptLimitUnit: "grapheme",
        note: "With a connected Gateway, the signed macOS 2026.11.7 app showed the exact message and Run confirmation. The blank link opened the app’s embedded Control UI, which displayed Model Setup in the fresh profile.",
      },
      ios: {
        url: "openclaw://agent",
        behavior: "confirm",
        evidence: "verified",
        sources: [
          "https://github.com/openclaw/openclaw/blob/v2026.11.8/apps/ios/Sources/Model/NodeAppModel.swift",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45448771787/job/138639754996",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45454334627/job/138659607326",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45465579013/job/138699488297",
        ],
        fields: { prompt: "message" },
        required: ["prompt"],
        launchUrl: "openclaw://dashboard",
        promptLimit: 240,
        promptLimitUnit: "grapheme",
        note: "The blank link opens native Overview. With a paired Gateway, the prompt link showed the exact message and Run confirmation in a source-built OpenClaw 2026.11.8 app on an iOS 27.2 simulator. App Store and physical device behavior remain unverified.",
      },
      android: {
        url: "http://127.0.0.1:18789/",
        behavior: "launch",
        evidence: "verified",
        sources: [
          "https://docs.openclaw.ai/web/control-ui",
          "https://docs.openclaw.ai/platforms/android",
          "https://github.com/openclaw/openclaw/releases/tag/v2026.8.2",
        ],
        fields: { server: "" },
        required: ["server"],
        note: "Opens your configured Gateway Control UI in a browser. Android 16 found no native dashboard link handler in the official OpenClaw 2026.8.2 APK.",
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
