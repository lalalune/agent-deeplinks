import { getActionDefinition } from "./actions.js";
import type { AgentActionId, AgentActionRoute } from "./actions.js";

export { getAgentActions } from "./actions.js";
export type { AgentActionField, AgentActionId, AgentActionInput, AgentActionRoute } from "./actions.js";

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
  | "session" | "environment" | "task" | "cloudAgent" | "pr" | "customAgent" | "workspace" | "sshHost" | "sshPort" | "sshFolder";

export interface AgentRoute {
  readonly url: string;
  readonly behavior: LinkBehavior;
  readonly evidence: Evidence;
  readonly sources: readonly string[];
  readonly note?: string;
  readonly fields?: Readonly<Partial<Record<LinkField, string>>>;
  readonly required?: readonly LinkField[];
  readonly launchUrl?: string;
  readonly sessionUrl?: string;
  readonly launcher?: { readonly appUrl: string; readonly parameter: string };
  readonly modes?: readonly string[];
  readonly encodeQueryValuesTwice?: boolean;
  readonly serverBehavior?: LinkBehavior;
  readonly serverSource?: string;
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
const cursorCloudApi = "https://cursor.com/docs/cloud-agent/api/endpoints";
const cursorCloudDesktop = "https://forum.cursor.com/t/open-by-id-url-for-the-cloud-agent/159908/7";
const openClawBrowserDocs = "https://docs.openclaw.ai/web/urls";
const openClawBrowserProof = "https://github.com/lalalune/agent-deeplinks/actions/runs/45521782875/artifacts/14980377652";
const openClawDashboardProof = "https://github.com/lalalune/agent-deeplinks/actions/runs/45703008909/artifacts/15063712402";
const openClawMacGatewaySource = "https://docs.openclaw.ai/platforms/mac/remote#open-the-mac-app-from-a-website";
const openClawIosGatewaySource = "https://github.com/openclaw/openclaw/blob/v2026.11.8/apps/ios/Sources/Onboarding/OnboardingWizardView.swift#L938-L985";
const claudeCodeDocs = "https://code.claude.com/docs/en/deep-links";
const claudeDesktopDocs = "https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link";
const claudeDesktopChecks = [
  claudeDesktopDocs,
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45460279575/job/138680666371",
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45460279575/job/138680666686",
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45539037898/artifacts/14987968227",
] as const;
const claudeMobileDocs = "https://support.claude.com/en/articles/14898120-open-the-claude-mobile-app-with-a-link";
const claudeVsCodeDocs = "https://code.claude.com/docs/en/vs-code#launch-a-vs-code-tab-from-other-tools";
const codexDocs = "https://learn.chatgpt.com/docs/reference/commands";
const codexMobile = "https://chatgpt.com/app/codex";
const codexCloudTaskSource = "https://github.com/openai/codex/blob/3f65e9f13165d85d1b1fbe20ce06c55758f927b9/codex-rs/cloud-tasks/src/util.rs#L122-L135";
const chatgptIosAssociation = "https://chatgpt.com/.well-known/apple-app-site-association";
const chatgptAndroidAssociation = "https://chatgpt.com/.well-known/assetlinks.json";
const chatgptAndroidChecks = "https://github.com/lalalune/agent-deeplinks/actions/runs/45686687701/artifacts/15056028598";
const codexCloudDocs = "https://help.openai.com/en/articles/20001545-using-codex-cloud";
const openAiDesktopChecks = [
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45449086076/job/138640907273",
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45450367734/job/138645480431",
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45515751038/artifacts/14975884834",
  "https://github.com/lalalune/agent-deeplinks/blob/afe1df7f5816e1cf1d8b43cead2662b102fc21a8/evidence/openai-windows-cold-links/README.md",
  "https://github.com/lalalune/agent-deeplinks/blob/ee4f7f74b993f4436711fabe079aff63295e41b6/evidence/openai-windows-warm-links/README.md",
  "https://github.com/lalalune/agent-deeplinks/blob/main/research/evidence/chatgpt-macos-warm-thread/proof.json",
  "https://github.com/lalalune/agent-deeplinks/actions/runs/45686443928/artifacts/15056138458",
] as const;
const grokBotDocs = "https://docs.x.ai/grok-bot/deep-links";
const grokBotMobileDocs = "https://docs.x.ai/grok-bot/mobile";
const t3Source = "https://github.com/pingdotgg/t3code/blob/v0.1.11/packages/shared/src/promptLinks.ts";
const t3AndroidAppLinkProof = "https://github.com/lalalune/agent-deeplinks/blob/09dac84870eda35a0b635871b06aa6dcec8811cd/research/evidence/t3-android-verified-https/proof.json";
const t3AndroidColdAppLinkProof = "https://github.com/lalalune/agent-deeplinks/actions/runs/45706063833/artifacts/15065187869";
const t3ThreadSource = "https://github.com/pingdotgg/t3code/blob/4da8d19d/packages/shared/src/threadLinks.ts#L42-L66";
const openCodeTag = "https://github.com/anomalyco/opencode/blob/v1.19.6";
const openCodeDesktopTag = "https://github.com/anomalyco/opencode/blob/v2.4.1";
const claudeIosAssociation = "https://claude.ai/.well-known/apple-app-site-association";
const claudeCachedIosAssociation = "https://app-site-association.cdn-apple.com/a/v1/claude.ai";
const slopDate = "https://slop.date/";
const slopCash = "https://slop.cash/";
const vibestack = "https://vibestack.fun/";
const cursorIosAssociation = "https://cursor.com/.well-known/apple-app-site-association";
const iosAssociationCheck = "https://github.com/lalalune/agent-deeplinks/actions/runs/45493929967/artifacts/14966133706";
const grokIosAssociation = "https://grok.com/.well-known/apple-app-site-association";
const grokAndroidAssociation = "https://grok.com/.well-known/assetlinks.json";
const grokAndroidRuntime = "https://github.com/lalalune/agent-deeplinks/actions/runs/45680807835/artifacts/15053174564";
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
  behavior: "confirm",
  evidence: "documented",
  sources: [cursorDocs],
  fields: { prompt: "text", cloudAgent: "" },
  required: ["prompt"],
  urlLimit: 10_000,
} as const satisfies Omit<AgentRoute, "url">;

const claudeCodeMobileRoute = {
  url: "claude://code/new",
  launchUrl: "claude://code",
  sessionUrl: "claude://code",
  behavior: "draft",
  evidence: "documented",
  sources: [claudeMobileDocs],
  fields: { prompt: "q", mode: "mode", repo: "repo", branch: "branch", session: "" },
  modes: ["plan", "code"],
  note: "Requires Claude Code access. An empty link opens the session list, and a session ID opens that cloud session.",
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
  sources: [t3Source, t3ThreadSource],
  fields: { prompt: "prompt", repo: "repo", provider: "provider", model: "model", environment: "", session: "" },
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
        sources: [
          cursorDocs,
          cursorCloudDocs,
          cursorCloudApi,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45487974246/artifacts/14965396228",
        ],
        note: "The browser preview reached Cursor’s native review on Ubuntu. Cursor’s handoff turned a literal plus into a space in that review. An empty link opens the Cloud Agents inbox. Individual Cloud Agent URLs reached Cursor sign-in.",
      },
      desktop: {
        ...cursorRoute,
        url: "cursor://anysphere.cursor-deeplink/prompt",
        evidence: "verified",
        encodeQueryValuesTwice: true,
        sources: [
          cursorDocs,
          cursorCloudDesktop,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45491150004/job/138789493816",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45491628951/job/138791208997",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45492105855/artifacts/14968450079",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45460026095/job/138679769952",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45460380555/job/138681026834",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45489023213/artifacts/14966850011",
        ],
        note: "Cursor 3.31.15 opened Create chat with prompt in the running classic editor on macOS, Ubuntu, and Windows. All three renderers showed the exact multiline Unicode prompt. Cursor documents a separate desktop link for an existing Cloud Agent.",
      },
      ios: {
        url: cursorCloud,
        behavior: "launch",
        evidence: "source",
        sources: [
          cursorIosAssociation,
          "https://cursor.com/docs/cloud-agent/mobile",
          iosAssociationCheck,
          cursorCloudApi,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45561293308/artifacts/14997866866",
        ],
        fields: { cloudAgent: "" },
        note: "Apple’s matcher recognized the inbox and both personal and team Cloud Agent URLs. The iPhone browser fallback reached Cursor sign-in.",
      },
      android: {
        url: cursorCloud,
        behavior: "launch",
        evidence: "verified",
        sources: [cursorCloudDocs, cursorCloudApi],
        fields: { cloudAgent: "" },
        note: "Cursor’s installable Android web app uses the inbox and individual agent URLs. The inbox reached Cursor sign-in in Android Chromium.",
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
        behavior: "confirm",
        evidence: "verified",
        sources: [
          "https://cdn.grok.com/_next/static/chunks/0x_5zluss7pi6.js",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45542750129/artifacts/14989473705",
          slopDate,
          grokIosAssociation,
          grokAndroidAssociation,
        ],
        fields: { prompt: "q" },
        query: { stay_in_browser: "true" },
        note: "Grok shows the exact prompt in Send this message? before any submission. Cancel keeps it editable in the composer. Verified signed out in desktop, iPhone, and Android browsers.",
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
        evidence: "verified",
        sources: [grokAndroidAssociation, grokAndroidRuntime],
        note: "Stock Android 15 opened the signed Grok 1.2.60 app, which showed a Google Play requirement in the test environment.",
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
        sources: [grokBotDocs, "https://github.com/lalalune/agent-deeplinks/actions/runs/45488932416/artifacts/14966115165", iosAssociationCheck],
        note: "The published Playground opened the native Grok Bot sign-in screen through stock Chrome on Ubuntu after the browser’s one-time approval. The mobile browser preview also produced the exact native URL.",
      },
      desktop: {
        ...grokBotRoute,
        sources: [
          grokBotDocs,
          "https://docs.x.ai/grok-bot/get-started",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45483518818/artifacts/14964275753",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45461984963/job/138686754025",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45461984963/job/138686754337",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45507895510/artifacts/14974440993",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45513144306/artifacts/14976811777",
        ],
        note: "LaunchServices started the signed Grok Bot 1.3.0 app on macOS. Stock Ubuntu and Windows x64 and ARM64 apps received the exact link and opened at sign-in. Drafts require an eligible account and use the primary Bot unless you supply a Bot ID.",
      },
      ios: {
        ...grokBotRoute,
        sources: [grokBotDocs, grokBotMobileDocs, "https://apps.apple.com/us/app/grok-bot/id6794501026"],
        note: "Requires the installed Grok Bot app and an eligible Cursor account. Uses your primary Bot unless you supply a Bot ID. Native delivery remains unverified.",
      },
      android: {
        ...grokBotRoute,
        sources: [grokBotDocs, grokBotMobileDocs, "https://play.google.com/store/apps/details?id=ai.x.grok.bot", grokAndroidRuntime],
        note: "Stock Android 15 opened the signed Grok Bot 1.27.0 app, which showed a Google Play requirement. Drafts need an eligible account and use your primary Bot unless you supply a Bot ID.",
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
        behavior: "handoff",
        evidence: "verified",
        sources: [
          "https://agent.meta.ai/.well-known/apple-app-site-association",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45480862958/job/138753307658",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45483440516/artifacts/14962696263",
        ],
        note: "Ordinary macOS URL opening selected Muse 13.1 after its first launch and domain approval. A click in stock Chrome 157 reached the Muse website and its sign-in page.",
      },
      ios: {
        url: "https://applink.muse.ai/",
        behavior: "launch",
        evidence: "source",
        sources: ["https://ai.meta.com/muse/", "https://applink.muse.ai/.well-known/apple-app-site-association"],
        note: "Meta’s iOS app handoff. The exact browser fallback reached the Muse from Meta App Store listing.",
      },
      android: {
        url: "https://agent.meta.ai/chat",
        behavior: "launch",
        evidence: "verified",
        sources: [
          "https://agent.meta.ai/.well-known/assetlinks.json",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45680807835/artifacts/15053174564",
          "https://play.google.com/store/apps/details?id=com.facebook.aura",
        ],
        note: "Android 15 opened the signed Muse app to sign-in. Without app dispatch, an Android browser request redirected to the Muse homepage. Install Muse from Google Play.",
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
        sessionUrl: "claude://claude.ai/chat",
        behavior: "draft",
        evidence: "verified",
        sources: claudeDesktopChecks,
        fields: { prompt: "q", session: "" },
        note: "Prefill verified in Claude 6.28899.6 on macOS. Windows and Ubuntu received the exact link. The ARM64 Windows client also opened a native window from that link. Signed-in composers on Windows and Ubuntu still need verification.",
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
        sessionUrl: "https://claude.ai/code",
        browserOnlyFragment: "no_universal_links",
        sources: [claudeMobileDocs, "https://code.claude.com/docs/en/claude-code-on-the-web", claudeCachedIosAssociation],
        note: "Opens the new-session composer or an existing cloud session. Requires Claude Code cloud-session access.",
      },
      desktop: {
        url: "claude://code/new",
        behavior: "draft",
        evidence: "verified",
        sources: [...claudeDesktopChecks, "https://code.claude.com/docs/en/desktop#open-an-ssh-session-from-a-link"],
        fields: { prompt: "q", folder: "folder", sshHost: "ssh_host", sshPort: "ssh_port", sshFolder: "ssh_folder" },
        note: "Prefill verified in Claude Desktop’s Code tab in 6.28899.6 on macOS. Windows and Ubuntu received the exact link, including Windows ARM64. Claude asks for confirmation before using a local folder or SSH target. SSH fields require Desktop v2.110.0 or later.",
      },
      ios: claudeCodeMobileRoute,
      android: claudeCodeMobileRoute,
      cli: {
        url: "claude-cli://open",
        behavior: "draft",
        evidence: "verified",
        sources: [
          claudeCodeDocs,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45488368601/artifacts/14965540998",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45487910168/artifacts/14964986411",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45499329278/artifacts/14969607471",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45536563295/artifacts/14987451807",
        ],
        fields: { prompt: "q", cwd: "cwd", repo: "repo" },
        promptLimit: 5_000,
        note: "Native terminals on macOS, Ubuntu, and Windows displayed the exact draft, requested scratch directory, and external-link warning. macOS prompted for Terminal Automation on first use. cwd takes precedence over repo.",
      },
      vscode: {
        url: "vscode://anthropic.claude-code/open",
        launchUrl: "vscode://anthropic.claude-code/open",
        behavior: "draft",
        evidence: "documented",
        sources: [
          claudeVsCodeDocs,
          "https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code",
          "https://github.com/microsoft/vscode/blob/8a14f0cc1b08d531eb83255ea3764ae22aa932b5/src/vs/base/common/uri.ts",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45454069271/job/138658637744",
        ],
        fields: { prompt: "prompt", session: "session" },
        encodeQueryValuesTwice: true,
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
        sessionUrl: "codex://threads",
        behavior: "draft",
        evidence: "verified",
        sources: [
          codexDocs,
          "https://chatgpt.com/cdn/assets/617936.82c33d1781.js",
          "https://learn.chatgpt.com/docs/enterprise/windows-deployment",
          ...openAiDesktopChecks,
        ],
        fields: { prompt: "prompt", session: "" },
        query: { mode: "chat" },
        note: "The signed Windows and Ubuntu apps displayed the exact unsent draft and reopened a local thread by ID. Windows cold Shell dispatch and warm delivery both passed in an isolated local Work profile. The signed Mac app reopened the exact local thread from both a cold start and a running window.",
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
        url: "https://chatgpt.com/open-app",
        behavior: "handoff",
        evidence: "verified",
        sources: [chatgptAndroidChecks, chatgptAndroidAssociation, "https://chatgpt.com/open-app"],
        note: "The signed Android app opened from this exact App Link. A browser without the app is redirected to ChatGPT’s official Google Play listing.",
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
        sources: [codexCloudTaskSource, codexCloudDocs, chatgptIosAssociation],
        fields: { task: "" },
        note: "Opens the Codex cloud workspace or an existing task you can access. Use a task ID from the CLI or paste the task URL from ChatGPT.",
      },
      desktop: {
        url: "codex://new",
        sessionUrl: "codex://threads",
        behavior: "draft",
        evidence: "verified",
        sources: [codexDocs, ...openAiDesktopChecks],
        fields: { prompt: "prompt", path: "path", originUrl: "originUrl", session: "" },
        launchUrl: "codex://threads/new",
        note: "Native dispatch passed on macOS, Windows, and Ubuntu. The signed Windows and Ubuntu apps showed the exact unsent draft and reopened a local thread. Windows warm dispatch updated the same window. On macOS, both cold and warm dispatch reopened the exact local thread. The requested folder review passed on Ubuntu. The handler tries a local path before matching the Git remote.",
      },
      ios: {
        url: codexMobile,
        behavior: "handoff",
        evidence: "source",
        sources: [chatgptIosAssociation, codexMobile, codexCloudTaskSource],
        fields: { task: "" },
        note: "Blank links open ChatGPT’s wrapped Codex handoff with an App Store fallback. A task ID or URL opens the associated task path. Installed task navigation still needs a device check.",
      },
      android: {
        url: codexMobile,
        behavior: "handoff",
        evidence: "verified",
        sources: [codexMobile, "https://learn.chatgpt.com/docs/mobile", codexCloudTaskSource, chatgptAndroidAssociation, chatgptAndroidChecks],
        fields: { task: "" },
        note: "The blank link opened the signed Android app and has an official Play fallback. Both tested cloud-task paths stayed in the browser on Android 15. Task content requires access.",
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
        evidence: "verified",
        launchUrl: copilotHome,
        launcher: { appUrl: copilotSession, parameter: "open" },
        note: "GitHub’s launcher showed Open the app and preserved the exact native draft URL in Chromium, Firefox, and WebKit. Leave the inputs empty to open Copilot on GitHub.com.",
      },
      desktop: {
        ...copilotDraftRoute,
        url: copilotSession,
        sources: [
          copilotDocs,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45479815496/job/138749609151",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45480574455/job/138752281191",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45481594490/job/138755898867",
        ],
        note: "Supply a prompt, repository, or custom agent. GitHub Copilot 1.5.0 reached native sign-in on macOS, Ubuntu, and Windows. GitHub documents an Allow step and draft review.",
      },
      vscode: {
        url: "vscode://agents/new",
        behavior: "draft",
        evidence: "verified",
        sources: [
          "https://code.visualstudio.com/docs/configure/command-line#_prepare-a-new-agent-session-draft",
          "https://github.com/microsoft/vscode/blob/8a14f0cc1b08d531eb83255ea3764ae22aa932b5/src/vs/platform/window/common/window.ts",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45481936985/job/138757093511",
        ],
        fields: { prompt: "prompt", workspace: "workspace" },
        required: ["prompt"],
        encodeQueryValuesTwice: true,
        note: "VS Code 1.147.0 on Ubuntu showed the exact unsent draft and workspace after approving the scratch folder. A prompt is required. The workspace folder URI is optional.",
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
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45479309480/job/138747843316",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45469092283/job/138711836543",
        ],
        note: "Stock links in signed Kimi 3.2.28 opened Work behind sign-in on Windows and Apple Silicon macOS.",
      },
      ios: {
        url: kimiMobile,
        behavior: "handoff",
        evidence: "source",
        sources: ["https://kimi.onelink.me/.well-known/apple-app-site-association", kimiMobile, iosAssociationCheck],
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
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45542872067/artifacts/14989484168",
        ],
        fields: { directory: "path" },
        required: ["directory"],
        note: "ZCode 4.0.0 showed the exact requested folder in native review on macOS, Ubuntu, and Windows x64 and ARM64. The signed-in workspace view remains unverified.",
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
        sources: [
          ...t3Route.sources,
          "https://github.com/pingdotgg/t3code/blob/v0.1.11/docs/user/remote-access.md",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45480052812/job/138750432372",
          t3AndroidAppLinkProof,
          t3AndroidColdAppLinkProof,
        ],
        note: "Leave the server blank for T3’s hosted chooser. After pairing to a self-hosted server, drafts opened directly after a Chromium restart with T3 Code 0.1.11. A repository link selected an existing matching project. With a thread and environment ID, the hosted chooser offers to open that thread. Verified Android App Links also opened the paired app directly from a cold start.",
      },
      desktop: {
        ...t3Route,
        url: "t3code://new",
        evidence: "verified",
        sources: [
          ...t3Route.sources,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45440501819/job/138609961589",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45440877037/job/138611312447",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45483428887/artifacts/14962886811",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45545419949/artifacts/14991571861",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45549179939/artifacts/14992138379",
        ],
        note: "Exact unsent draft verified in T3 Code 0.1.11 on macOS, Ubuntu, and Windows. Both cold and warm Windows Shell opens reached the draft. Existing-thread links passed with and without a draft on Ubuntu and Windows.",
      },
      ios: {
        ...t3Route,
        url: "t3code://new",
        evidence: "verified",
        sources: [...t3Route.sources, "https://github.com/pingdotgg/t3code/tree/67c442a17e6e5d6c9f768714820cecb5f15d4f9b/apps/mobile"],
        note: "Exact unsent draft verified in a 2.3.0 Release build on the iOS 26.4 simulator after pairing to a connected environment.",
      },
      android: {
        ...t3Route,
        url: "t3code://new",
        evidence: "verified",
        sources: [
          ...t3Route.sources,
          "https://github.com/pingdotgg/t3code/releases/tag/v0.1.12-nightly.20261123.5165",
          "https://github.com/lalalune/agent-deeplinks/blob/cff6e2e17ef0e5db857a1755813117da4d76488d/research/evidence/t3-android-existing-thread-native-arm/proof.json",
          t3AndroidAppLinkProof,
          t3AndroidColdAppLinkProof,
        ],
        note: "New-thread draft verified in the signed 2.3.0 beta on Android 16. Signed build 823 opened an existing thread with and without an unsent draft in a native ARM64 Android 15 container. After domain verification, the same HTTPS links opened the exact thread from cold starts in Play-signed internal build 825.",
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
          `${openCodeDesktopTag}/packages/app/src/shell/routes/session.ts`,
          `${openCodeTag}/packages/app/src/app.tsx#L636`,
        ],
        fields: { directory: "", server: "", session: "" },
        required: ["server"],
        note: "Enter the OpenCode server origin. A session ID opens a saved OpenCode 2.x session in a browser connected to that server. The optional 1.x project directory applies when the session ID is blank.",
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
        sources: ["https://opencode.ai/docs/cli/web/", "https://opencode.ai/mobile", `${openCodeDesktopTag}/packages/app/src/shell/routes/session.ts`],
        fields: { server: "", session: "" },
        required: ["server"],
        note: "Opens OpenCode in a browser. Add a session ID to open a saved OpenCode 2.x session after authenticating with the server.",
      },
      android: {
        url: "opencode://",
        behavior: "launch",
        evidence: "verified",
        sources: [
          "https://github.com/anomalyco/opencode-android/blob/v0.8.9/feature/system/src/main/kotlin/ai/opencode/feature/system/SystemAction.kt#L43-L75",
          "https://github.com/anomalyco/opencode-android/blob/v0.8.9/server/src/main/kotlin/ai/opencode/server/OpenCodePairingLink.kt",
          `${openCodeDesktopTag}/packages/schema/src/session-id.ts`,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45679936147/artifacts/15054890187",
        ],
        fields: { session: "", mode: "" },
        modes: ["new", "last"],
        note: "Pair the Android app first. OpenCode 0.8.9 paired with OpenCode 2.4.1 and opened the requested session, a blank draft, and the last session. The release bundle used a disposable test signature.",
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
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45539411249/artifacts/14988233308",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45539939818/artifacts/14988971676",
        ],
        note: "The 0.23.3 canary opened Sessions on macOS and a native window from the signed MSIX on Windows. Linux x64 and ARM64 opened blank sessions from the diagnostic AppImage argument. Stock XDG had no Hermes handler.",
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
        behavior: "draft",
        evidence: "verified",
        sources: [openClawBrowserDocs, openClawBrowserProof, openClawDashboardProof],
        fields: { prompt: "draft", server: "", session: "" },
        note: "Sign in to your Gateway in the same tab before opening the draft. The published Gateway opened saved chat and dashboard sessions. Desktop Chromium displayed the exact unsent dashboard draft. A blank link opens the Gateway.",
      },
      desktop: {
        url: "openclaw://agent",
        behavior: "confirm",
        evidence: "verified",
        sources: [
          "https://github.com/openclaw/openclaw/blob/v2026.11.7/apps/macos/Sources/OpenClaw/DeepLinks.swift",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45473423005/job/138727187042",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45476772927/job/138738941929",
          openClawMacGatewaySource,
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45491339853/job/138790178318",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45539495631/artifacts/14988856688",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45539535621/artifacts/14988891540",
          "https://github.com/lalalune/agent-deeplinks/actions/runs/45517891382/artifacts/14978123936",
          "https://github.com/lalalune/agent-deeplinks/blob/01bdcfe4d4e317d6fad5d61bef7ea6171c00a78e/evidence/openclaw-windows-edge-dashboard.md",
        ],
        fields: { prompt: "message", server: "" },
        serverBehavior: "confirm",
        serverSource: openClawMacGatewaySource,
        required: ["prompt"],
        launchUrl: "openclaw://dashboard",
        promptLimit: 240,
        promptLimitUnit: "grapheme",
        note: "On macOS, Run confirmation showed the exact message with a connected Gateway, and HTTPS addresses opened Add Gateway. The Linux 2026.11.9 AppImage opened the connected Dashboard on cold and warm launch after first-run registration. The DEB drops the link. On Windows, the cold link opened the connected Dashboard in signed Edge after pairing the Hub.",
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
          openClawIosGatewaySource,
        ],
        fields: { prompt: "message", server: "" },
        serverBehavior: "confirm",
        serverSource: openClawIosGatewaySource,
        required: ["prompt"],
        launchUrl: "openclaw://dashboard",
        promptLimit: 240,
        promptLimitUnit: "grapheme",
        note: "The blank link opens native Overview. With a paired Gateway, the prompt link showed the exact message and Run confirmation in a source-built OpenClaw 2026.11.8 app on an iOS 27.2 simulator. A Gateway address stages the host, port, and TLS for review.",
      },
      android: {
        url: "http://127.0.0.1:18789/",
        behavior: "draft",
        evidence: "verified",
        sources: [
          openClawBrowserDocs,
          openClawBrowserProof,
          openClawDashboardProof,
          "https://docs.openclaw.ai/platforms/android",
          "https://github.com/openclaw/openclaw/actions/runs/45245551289/artifacts/14856936529",
          "https://github.com/openclaw/openclaw/releases/tag/v2026.8.2",
        ],
        fields: { prompt: "draft", server: "", session: "" },
        required: ["server"],
        note: "Sign in to the Gateway in the same browser tab. An authenticated Pixel Chromium profile showed the exact unsent chat and dashboard drafts. The Play 2026.11.70 bundle has no native browser handler. Android 16 also found none in the standalone 2026.8.2 APK.",
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

export function getAgentRoute(agent: AgentId, platform: Platform): AgentRoute | null;
export function getAgentRoute(agent: AgentId, platform: Platform, action: AgentActionId): AgentActionRoute | null;
export function getAgentRoute(agent: AgentId, platform: Platform, action?: AgentActionId): AgentRoute | AgentActionRoute | null;
export function getAgentRoute(agent: AgentId, platform: Platform, action?: AgentActionId): AgentRoute | AgentActionRoute | null {
  if (action !== undefined) return getActionDefinition(agent, platform, action) ?? null;
  if (!Object.hasOwn(agents, agent)) return null;
  const routes = agents[agent].routes;
  return Object.hasOwn(routes, platform) ? routes[platform] ?? null : null;
}
