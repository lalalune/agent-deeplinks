import { createRoot } from "react-dom/client";
import { Check, Copy, Download, Github, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import {
  agents, getAgentActions, getAgentIcon, getAgentLink, getAgentRoute,
} from "../src/index.js";
import type { AgentActionId, AgentId, LinkOptions, Platform } from "../src/index.js";
import { AgentIcon } from "../src/react.js";
import { Button } from "./components/ui/button.js";
import "./styles.css";

const REPOSITORY = "https://github.com/lalalune/agent-deeplinks";
const RELEASE_ZIP = `${REPOSITORY}/releases/latest/download/agent-deeplinks.zip`;
const INSTALL_CMD = "npm install agent-deeplinks";
const LIVE_PROMPT = "tell me about deeplinks.fun";

const CODE_SNIPPET = `import { getAgentLink } from "agent-deeplinks"

const url = getAgentLink("claude", "desktop", {
  prompt: "tell me about deeplinks.fun",
})`;

type TabId = "desktop" | "web" | "mobile";
type MobileOs = "ios" | "android";
type ActivePlatform = "desktop" | "web" | "ios" | "android";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "desktop", label: "Desktop" },
  { id: "web", label: "Web" },
  { id: "mobile", label: "Mobile" },
];

const DESKTOP_CHAT_AGENTS = ["chatgpt", "claude", "codex"] as const;
type DesktopChatAgent = (typeof DESKTOP_CHAT_AGENTS)[number];

type DesktopToolField = "cwd" | "repo" | "session" | "workspace" | "path" | "originUrl";

interface DesktopToolExample {
  agent: "claude-code" | "github-copilot" | "codex";
  platform: "cli" | "vscode" | "desktop";
  label: string;
  name: string;
  fields: readonly { key: DesktopToolField; label: string; placeholder: string }[];
  note: string;
  invalidInput: string;
}

const DESKTOP_TOOL_EXAMPLES: readonly DesktopToolExample[] = [
  {
    agent: "claude-code", platform: "cli", label: "Terminal", name: "Claude Code in Terminal",
    fields: [
      { key: "cwd", label: "Absolute working directory (optional)", placeholder: "/absolute/path/to/project" },
      { key: "repo", label: "Local GitHub repository (optional)", placeholder: "owner/repo" },
    ],
    note: "Requires Claude Code’s registered terminal handler. A working directory takes precedence over a repository.",
    invalidInput: "Check the absolute directory, repository slug, and prompt length.",
  },
  {
    agent: "claude-code", platform: "vscode", label: "VS Code", name: "Claude Code in VS Code",
    fields: [{ key: "session", label: "Claude Code session ID (optional)", placeholder: "Session ID from the open workspace" }],
    note: "Requires the Claude Code extension. A saved session uses the workspace open in VS Code.",
    invalidInput: "Enter a valid Claude Code session ID.",
  },
  {
    agent: "github-copilot", platform: "vscode", label: "VS Code Agents", name: "VS Code Agents",
    fields: [{ key: "workspace", label: "Workspace folder URI (optional)", placeholder: "file:///absolute/path/to/project" }],
    note: "Opens a draft in the VS Code Agents window.",
    invalidInput: "Enter a file or VS Code Remote folder URI.",
  },
  {
    agent: "codex", platform: "desktop", label: "Workspace draft", name: "Codex workspace draft",
    fields: [
      { key: "path", label: "Absolute workspace folder (optional)", placeholder: "/absolute/path/to/project" },
      { key: "originUrl", label: "Git remote URL (optional)", placeholder: "https://github.com/owner/repo.git" },
    ],
    note: "Codex checks the local folder first. If that folder is unavailable, it looks for a workspace with the Git remote.",
    invalidInput: "Enter an absolute local workspace folder.",
  },
];

const DISPLAY_ORDER: readonly string[] = [
  "chatgpt",
  "claude",
  "cursor",
  "claude-code",
  "codex",
  "github-copilot",
  "gemini",
  "perplexity",
  "grok",
  "grok-build",
  "grok-bot",
  "t3-code",
  "openclaw",
  "meta-ai",
  "antigravity",
  "opencode",
  "kimi",
  "kimi-code",
  "meta-muse",
  "zcode",
  "hermes",
];

interface ResolvedTile {
  id: AgentId;
  name: string;
  platform: Platform;
  href: string | null;
  hasPrompt: boolean;
  setupField?: "directory" | "server";
}

interface ActionExample {
  key: string;
  agent: AgentId;
  agentName: string;
  label: string;
  href: string;
}

interface ActionExampleSpec {
  label: string;
  options: (platform: ActivePlatform) => Omit<LinkOptions, "action">;
}

interface DestinationExample {
  agent: AgentId;
  label: string;
  inputLabel: string;
  linkLabel?: string;
  note?: string;
  placeholder?: string;
  action?: AgentActionId;
  field?: "session" | "directory" | "task";
  platform?: ActivePlatform;
}

const DESTINATION_EXAMPLES: readonly DestinationExample[] = [
  { agent: "cursor", label: "Cloud Agent", inputLabel: "Cloud Agent ID or URL", placeholder: "https://cursor.com/agents/bc-…" },
  { agent: "cursor", label: "Origin PR", inputLabel: "Origin pull request URL",
    placeholder: "https://cursor.com/codebase/acme/rocket/pull/1", action: "pull-request" },
  { agent: "cursor", label: "Shared transcript", inputLabel: "Transcript ID or URL",
    placeholder: "https://cursor.com/s/abc123", action: "shared-chat" },
  { agent: "chatgpt", label: "Shared chat", inputLabel: "ChatGPT share link or ID",
    placeholder: "https://chatgpt.com/share/…", action: "shared-chat" },
  { agent: "codex", label: "Shared chat", inputLabel: "Codex share link or ID",
    placeholder: "https://chatgpt.com/s/cx_…", action: "shared-chat" },
  { agent: "codex", label: "Cloud task", inputLabel: "Cloud task ID or URL",
    placeholder: "task_… or https://chatgpt.com/codex/tasks/…", field: "task" },
  { agent: "codex", label: "Settings section", inputLabel: "Settings section", action: "settings" },
  { agent: "codex", label: "Add SSH host", inputLabel: "SSH host alias", placeholder: "build-box",
    action: "add-ssh-host", linkLabel: "Add SSH host to Codex",
    note: "Use an alias from your SSH config. Codex adds it with automatic connection disabled." },
  { agent: "claude", label: "Shared chat", inputLabel: "Claude share link or ID",
    placeholder: "https://claude.ai/share/…", action: "shared-chat" },
  { agent: "claude-code", label: "Cloud session", inputLabel: "Cloud session ID",
    placeholder: "session_… or cse_…", field: "session" },
  { agent: "grok", label: "Shared chat", inputLabel: "Grok share link or ID",
    placeholder: "https://grok.com/share/…", action: "shared-chat" },
  { agent: "grok-bot", label: "Public Page", inputLabel: "Public Grok Bot Page link",
    placeholder: "https://bot-team-kanban-example-2ncd.pages.grok.bot/", action: "bot-page" },
  { agent: "kimi", label: "Shared chat", inputLabel: "Kimi share link or ID",
    placeholder: "https://www.kimi.ai/share/…", action: "shared-chat" },
  { agent: "zcode", label: "Shared chat", inputLabel: "ZCode share link or code",
    placeholder: "https://zcode.z.ai/share/…", action: "shared-chat" },
  { agent: "zcode", label: "Local Web workspace", inputLabel: "Local ZCode Web URL",
    placeholder: "http://127.0.0.1:3030/", action: "local-web" },
  { agent: "grok-build", label: "Cloud Agent", inputLabel: "Cloud Agent ID or URL", placeholder: "https://grok.com/build/bc-…" },
  { agent: "t3-code", label: "Pull request", inputLabel: "GitHub pull request URL or owner/repo#number",
    placeholder: "https://github.com/owner/repo/pull/1", action: "pull-request" },
  { agent: "t3-code", label: "Existing thread", inputLabel: "Copied T3 Code thread link",
    placeholder: "https://app.t3.codes/threads/environment/thread", field: "session" },
  { agent: "antigravity", label: "IDE file or folder", inputLabel: "Absolute local path",
    placeholder: "/absolute/path/to/project", action: "ide-open" },
  { agent: "opencode", label: "project draft", inputLabel: "Absolute local folder",
    placeholder: "/absolute/path/to/project", field: "directory", platform: "desktop" },
  { agent: "opencode", label: "server pairing", inputLabel: "OpenCode CLI or Copy/Share pairing URL",
    placeholder: "opencode-ios://pair?…", action: "server-pair", platform: "android", linkLabel: "Review OpenCode pairing" },
];

const ACTION_EXAMPLES: Partial<Record<AgentId, Partial<Record<AgentActionId, ActionExampleSpec>>>> = {
  chatgpt: {
    app: {
      label: "Plugin app",
      options: () => ({
        target: "plugin_asdk_app_6abadab6e7d881919e7491d52c7846e8",
        tool: "cad.browse",
        appPath: "/parts/part_joystick",
      }),
    },
    plugin: {
      label: "Plugin listing",
      options: (platform) =>
        platform === "desktop"
          ? { target: "openai-developers@openai-curated" }
          : { target: "plugin_asdk_app_6abadab6e7d881919e7491d52c7846e8" },
    },
    "plugin-install": {
      label: "Plugin install",
      options: (platform) =>
        platform === "desktop"
          ? { target: "openai-developers", marketplace: "openai-curated" }
          : { target: "Plugin_60db802073a48191b7256d1c268d7a47" },
    },
    "plugin-chat": {
      label: "Plugin chat",
      options: (platform) =>
        platform === "desktop"
          ? { target: "openai-developers@openai-curated", prompt: LIVE_PROMPT }
          : { target: "Plugin_60db802073a48191b7256d1c268d7a47", prompt: LIVE_PROMPT },
    },
    "custom-gpt": {
      label: "Custom GPT",
      options: () => ({ target: "g-1234-sample" }),
    },
  },
  codex: {
    plugin: {
      label: "Plugin details",
      options: () => ({ target: "openai-developers@openai-curated" }),
    },
    "plugin-install": {
      label: "Plugin install",
      options: () => ({ target: "openai-developers", marketplace: "openai-curated" }),
    },
    "plugin-chat": {
      label: "Plugin chat",
      options: () => ({ target: "openai-developers@openai-curated", prompt: LIVE_PROMPT }),
    },
    settings: {
      label: "Settings",
      options: () => ({}),
    },
    skills: {
      label: "Skills",
      options: () => ({}),
    },
    automations: {
      label: "Scheduled",
      options: () => ({}),
    },
  },
  claude: {
    install: {
      label: "Google Play",
      options: () => ({}),
    },
    plugin: {
      label: "Plugin details",
      options: () => ({ target: "268ba6b9-a27c-4bc8-9dc2-2a0b5ab79bfb@anthropic-plugin-directory" }),
    },
    connector: {
      label: "Connector",
      options: () => ({ target: "ringcentral-chat" }),
    },
    "plugin-install": {
      label: "Cowork plugin",
      options: () => ({ target: "slack", marketplace: "anthropics/knowledge-work-plugins" }),
    },
  },
  cursor: {
    plugin: {
      label: "Marketplace plugin",
      options: () => ({ target: "cursor/google-drive" }),
    },
    "mcp-install": {
      label: "MCP install",
      options: () => ({
        target: "deeplinks",
        config: JSON.stringify({ url: "https://deeplinks.fun/mcp" }),
      }),
    },
    command: {
      label: "Command",
      options: () => ({ target: "review-command", content: LIVE_PROMPT }),
    },
    rule: {
      label: "Rule",
      options: () => ({ target: "review-rule", content: "Keep deeplinks verified and minimal." }),
    },
  },
  gemini: {
    gem: {
      label: "Gem",
      options: () => ({ target: "gem-id" }),
    },
  },
  perplexity: {
    project: {
      label: "Shared project",
      options: () => ({ target: "https://www.perplexity.ai/collections/sample-Project.Id" }),
    },
  },
  "grok-bot": {
    plugin: {
      label: "Marketplace plugin",
      options: () => ({ target: "https://x.ai/bot/plugin/674" }),
    },
    "team-plugin": {
      label: "Team plugin",
      options: () => ({ target: "456" }),
    },
    "team-bot": {
      label: "Team Bot",
      options: () => ({ target: "3f937d36-4777-4c7c-9139-a8a48a38c7fe" }),
    },
    "bot-template": {
      label: "Bot template",
      options: () => ({ target: "https://x.ai/bot/W4Z5pvEm6UgCml48Ig4dT/thoth" }),
    },
    "bot-marketplace": {
      label: "Bot Marketplace",
      options: () => ({ target: "bots/projects-manager" }),
    },
    "bot-page": {
      label: "Public Page",
      options: () => ({ target: "https://bot-team-kanban-example-2ncd.pages.grok.bot/" }),
    },
  },
  antigravity: {
    marketplace: {
      label: "Marketplace",
      options: () => ({}),
    },
    plugin: {
      label: "Marketplace plugin",
      options: (platform) =>
        platform === "desktop"
          ? { target: "stripe", marketplace: "antigravity-plugins-partners" }
          : { target: "firebase" },
    },
    skill: {
      label: "Marketplace skill",
      options: () => ({ target: "sample", marketplace: "antigravity-plugins-partners" }),
    },
    "remote-session": {
      label: "Remote session",
      options: () => ({ target: "https://antigravity.google.com/r/instance-id?p=c%2Fconversation-id" }),
    },
  },
  hermes: {
    "skill-install": {
      label: "Skill install",
      options: () => ({ target: "official/security/1password" }),
    },
    "plugin-install": {
      label: "Marketplace plugin",
      options: () => ({ target: "hermes-workbench" }),
    },
  },
  openclaw: {
    "plugin-install": {
      label: "ClawHub plugin",
      options: () => ({ target: "@openclaw/discord" }),
    },
    "skill-install": {
      label: "ClawHub skill",
      options: () => ({ target: "@openclaw/weather" }),
    },
    "template-install": {
      label: "ClawHub template",
      options: () => ({ target: "@openclaw/travel-copilot" }),
    },
  },
  opencode: {
    "server-pair": {
      label: "Pair server",
      options: (platform) => platform === "android" ? {} : { target: "https://code.example.com/auth/connect/example_code" },
    },
  },
  kimi: {
    "shared-chat": {
      label: "Public chat example",
      options: () => ({ target: "https://www.kimi.com/share/d1qvs6d96bk3t9j9ble0" }),
    },
  },
};

function isHttpUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://");
}

function linkAttrs(href: string) {
  return isHttpUrl(href) ? { target: "_blank" as const, rel: "noopener noreferrer" } : {};
}

function displayRank(id: string): number {
  const index = DISPLAY_ORDER.indexOf(id);
  return index === -1 ? DISPLAY_ORDER.length : index;
}

function detectInitialEnvironment(): { tab: TabId; mobileOs: MobileOs; isMobileVisitor: boolean } {
  if (typeof navigator === "undefined") {
    return { tab: "desktop", mobileOs: "ios", isMobileVisitor: false };
  }
  const ua = navigator.userAgent || "";
  const uaData = (navigator as Navigator & {
    userAgentData?: { platform?: string; mobile?: boolean };
  }).userAgentData;

  const isAndroid = /Android/i.test(ua) || uaData?.platform === "Android";
  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIos) return { tab: "mobile", mobileOs: "ios", isMobileVisitor: true };
  if (isAndroid) return { tab: "mobile", mobileOs: "android", isMobileVisitor: true };
  if (uaData?.mobile) return { tab: "mobile", mobileOs: "ios", isMobileVisitor: true };
  return { tab: "desktop", mobileOs: "ios", isMobileVisitor: false };
}

function resolvePlatformTiles(platform: Platform): ResolvedTile[] {
  const tiles: ResolvedTile[] = [];

  for (const entry of Object.values(agents)) {
    const route = getAgentRoute(entry.id, platform);
    if (!route) continue;

    if (entry.id === "openclaw" && (platform === "web" || platform === "android")) {
      tiles.push({ id: entry.id, name: entry.name, platform, href: null, hasPrompt: false, setupField: "server" });
      continue;
    }

    let href: string | null = null;
    let hasPrompt = false;

    if (route.fields?.prompt) {
      href = getAgentLink(entry.id, platform, {
        prompt: LIVE_PROMPT,
        allowExperimental: true,
        allowSend: true,
      });
      if (href) hasPrompt = true;
    }

    if (!href) {
      href = getAgentLink(entry.id, platform, {
        allowExperimental: true,
        allowSend: true,
      });
    }

    const required = route.required?.length === 1 ? route.required[0] : undefined;
    const setupField = !href && (required === "directory" || required === "server") ? required : undefined;
    if (!href && !setupField) continue;
    tiles.push({ id: entry.id, name: entry.name, platform, href, hasPrompt, setupField });
  }

  return tiles.sort((a, b) => {
    const promptDelta = Number(b.hasPrompt) - Number(a.hasPrompt);
    if (promptDelta !== 0) return promptDelta;
    return displayRank(a.id) - displayRank(b.id);
  });
}

function resolveActionExamples(platform: ActivePlatform): ActionExample[] {
  const examples: ActionExample[] = [];
  const seenHrefs = new Set<string>();
  const orderedAgents = Object.values(agents).sort((a, b) => displayRank(a.id) - displayRank(b.id));

  for (const agent of orderedAgents) {
    const actions = getAgentActions(agent.id, platform);
    for (const action of actions) {
      // On desktop, Codex already showcases the shared codex:// plugin detail/install/chat routes
      if (platform === "desktop" && agent.id === "chatgpt" && action.id !== "app") continue;

      const spec = ACTION_EXAMPLES[agent.id]?.[action.id];
      if (!spec) continue;

      const href = getAgentLink(agent.id, platform, {
        action: action.id,
        ...spec.options(platform),
      });
      if (!href || seenHrefs.has(href)) continue;
      seenHrefs.add(href);

      examples.push({
        key: `${agent.id}-${platform}-${action.id}`,
        agent: agent.id,
        agentName: agent.name,
        label: spec.label,
        href,
      });
    }
  }

  return examples;
}

const tilesByPlatform: Record<ActivePlatform, ResolvedTile[]> = {
  desktop: resolvePlatformTiles("desktop"),
  web: resolvePlatformTiles("web"),
  ios: resolvePlatformTiles("ios"),
  android: resolvePlatformTiles("android"),
};

const examplesByPlatform: Record<ActivePlatform, ActionExample[]> = {
  desktop: resolveActionExamples("desktop"),
  web: resolveActionExamples("web"),
  ios: resolveActionExamples("ios"),
  android: resolveActionExamples("android"),
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
  );
}

function AgentLogo({ agent }: { agent: AgentId }) {
  const hasIcon = Boolean(getAgentIcon(agent));
  return (
    <span className="agent-icon-wrap" aria-hidden="true">
      {hasIcon ? <AgentIcon agent={agent} width={20} height={20} /> : <Terminal size={16} />}
    </span>
  );
}

function LinkSetup({ tile, iconOnly }: { tile: ResolvedTile; iconOnly: boolean }) {
  const [value, setValue] = useState("");
  const [session, setSession] = useState("");
  if (!tile.setupField) return null;
  const isDirectory = tile.setupField === "directory";
  const acceptsSession = tile.id === "opencode" && tile.setupField === "server";
  const label = isDirectory ? "Local folder"
    : tile.id === "opencode" ? "OpenCode server origin"
      : tile.id === "hermes" ? "Hermes Web Access address" : "Gateway address";
  const example = isDirectory ? "/absolute/path/to/project"
    : tile.id === "opencode" ? "https://opencode.example.com" : "https://agent.example.com";
  const options = { [tile.setupField]: isDirectory ? value : value.trim() };
  const sessionLink = acceptsSession ? session.trim() : "";
  const href = getAgentLink(tile.id, tile.platform, { ...options, ...(sessionLink && { session: sessionLink }) });
  const needsSessionCorrection = sessionLink && !href && getAgentLink(tile.id, tile.platform, options);

  return (
    <div role="region" aria-label={`Configure ${tile.name} link`} className="link-setup">
      <label>
        {label}
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={example}
          inputMode={isDirectory ? "text" : "url"}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {acceptsSession && (
        <label>
          Session ID or copied link (optional)
          <input value={session} onChange={(event) => setSession(event.target.value)}
            placeholder="ses_… or a link from this server" autoComplete="off" autoCapitalize="off" spellCheck={false}
            aria-invalid={Boolean(needsSessionCorrection)} />
        </label>
      )}
      {href ? (
        <Button asChild variant="ghost" className={iconOnly ? "agent-btn agent-btn-icon" : "agent-btn"}>
          <a href={href} {...linkAttrs(href)} aria-label={`Open ${tile.name}`} title={tile.name}>
            <AgentLogo agent={tile.id} />
            {!iconOnly && <span className="agent-name">Open {tile.name}</span>}
          </a>
        </Button>
      ) : value.trim() && <p role="status">
        {needsSessionCorrection ? "Enter a session ID or copied link from this server."
          : isDirectory ? "Enter an absolute folder path." : "Enter a valid server address."}
      </p>}
    </div>
  );
}

function OpenClawLinkSetup({ platform, iconOnly }: { platform: Platform; iconOnly: boolean }) {
  const [address, setAddress] = useState("");
  const [copiedLink, setCopiedLink] = useState("");
  const [prompt, setPrompt] = useState("");
  const server = address.trim();
  const session = copiedLink.trim();
  const validServer = server && getAgentLink("openclaw", platform, { server });
  const validSession = !session || (validServer && getAgentLink("openclaw", platform, { server, session }));
  const href = validServer && validSession && getAgentLink("openclaw", platform, { server, session, prompt });
  const error = server && (!validServer ? "Enter a Gateway address without credentials."
    : !validSession ? "Paste a clean link from the same Gateway."
      : !href ? "Clear the draft to open this link." : "");

  return (
    <div role="region" aria-label="Configure OpenClaw link" className="link-setup openclaw-link-setup">
      <p>Sign in to your Gateway in this tab, then return here to open a session or draft.</p>
      <label>
        Gateway address
        <input value={address} onChange={(event) => setAddress(event.target.value)}
          placeholder="https://gateway.example.com/openclaw/" inputMode="url" autoComplete="off" spellCheck={false} />
      </label>
      <label>
        Session link (optional)
        <input value={copiedLink} onChange={(event) => setCopiedLink(event.target.value)}
          placeholder="Paste a link copied from OpenClaw" inputMode="url" autoComplete="off" spellCheck={false} />
      </label>
      <label>
        Draft prompt (optional)
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} />
      </label>
      {href && (
        <Button asChild variant="ghost" className={iconOnly ? "agent-btn agent-btn-icon" : "agent-btn"}>
          <a href={href} referrerPolicy="no-referrer" aria-label="Open OpenClaw" title="Open OpenClaw">
            <AgentLogo agent="openclaw" />
            {!iconOnly && <span className="agent-name">Open OpenClaw</span>}
          </a>
        </Button>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}

function DestinationLinkSetup({ example, platform, iconOnly }: {
  example: DestinationExample;
  platform: ActivePlatform;
  iconOnly: boolean;
}) {
  const [value, setValue] = useState("");
  const [prompt, setPrompt] = useState("");
  const isIdePath = example.action === "ide-open";
  const isLocalDirectory = example.field === "directory";
  const isPairing = example.action === "server-pair";
  const target = isIdePath || isLocalDirectory ? value : value.trim();
  const actionRoute = example.action ? getAgentRoute(example.agent, platform, example.action) : null;
  const choices = actionRoute?.inputs.find(({ field }) => field === "target")?.choices;
  const route = getAgentRoute(example.agent, platform);
  const promptLimit = example.field === "session"
    ? route?.promptLimit : actionRoute?.promptLimit;
  const destinationOptions = example.action ? { action: example.action, target } : { [example.field ?? "cloudAgent"]: target };
  const browserOnly = platform === "web" && (example.field === "task" || Boolean(route?.browserOnlyFragment));
  const options = { ...destinationOptions, ...(prompt && { prompt }), ...(browserOnly && { browserOnly }) };
  const href = (target || choices) && getAgentLink(example.agent, platform, options);
  const destination = `${agents[example.agent].name} ${example.label}`;
  const label = example.linkLabel ?? `Open ${destination}`;

  return (
    <div role="region" aria-label={`${destination} link`} className="link-setup">
      <label>
        {example.inputLabel}
        {choices ? (
          <select value={value} onChange={(event) => setValue(event.target.value)}>
            {choices.map(({ value: choiceValue, label: choiceLabel }) => (
              <option key={choiceValue} value={choiceValue}>{choiceLabel}</option>
            ))}
          </select>
        ) : (
          <input type={isPairing ? "password" : "text"} value={value} onChange={(event) => setValue(event.target.value)}
            placeholder={example.placeholder} aria-invalid={Boolean(target && !href)}
            autoComplete="off" autoCapitalize="off" spellCheck={false} />
        )}
      </label>
      {(promptLimit !== undefined || isLocalDirectory) && (
        <label>
          Draft prompt (optional)
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} maxLength={promptLimit} />
        </label>
      )}
      {href ? (
        <Button asChild variant="ghost" className={iconOnly ? "agent-btn agent-btn-icon" : "agent-btn"}>
          <a href={href} {...linkAttrs(href)} referrerPolicy={isPairing ? "no-referrer" : undefined}
            aria-label={label} title={label}>
            <AgentLogo agent={example.agent} />
            {!iconOnly && <span className="agent-name">{label}</span>}
          </a>
        </Button>
      ) : target && <p role="status">
        {example.agent === "t3-code" && example.field === "session" ? "Check the thread link and supply at most one draft prompt."
          : isIdePath || isLocalDirectory ? "Enter an absolute local path." : `Enter a valid ${example.inputLabel}.`}
      </p>}
      {example.note && <p className="session-setup-note">{example.note}</p>}
    </div>
  );
}

function ExistingDesktopChatLink({ agent, iconOnly }: { agent: DesktopChatAgent; iconOnly: boolean }) {
  const [value, setValue] = useState("");
  const name = agents[agent].name;
  const session = value.trim();
  const href = session && getAgentLink(agent, "desktop", { session });
  const action = `Open existing ${name} chat`;
  const claude = agent === "claude";

  return (
    <div role="region" aria-label={`${name} existing chat link`}>
      <p className="session-setup-note">
        {claude ? "Use the UUID at the end of your Claude conversation URL."
          : "Use Copy chat deep link in the desktop app. SSH chats need their original connection."}
      </p>
      <div className="link-setup">
        <label>
          {claude ? "Chat ID (UUID)" : "Chat ID or copied link"}
          <input value={value} onChange={(event) => setValue(event.target.value)}
            placeholder={claude ? "12345678-1234-4234-9234-123456789abc" : "UUID or codex://threads/…"}
            aria-invalid={Boolean(session && !href)}
            autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </label>
        {href ? (
          <Button asChild variant="ghost" className={iconOnly ? "agent-btn agent-btn-icon" : "agent-btn"}>
            <a href={href} aria-label={action} title={action}>
              <AgentLogo agent={agent} />
              {!iconOnly && <span className="agent-name">{action}</span>}
            </a>
          </Button>
        ) : session && <p role="status">
          {claude ? "Enter a valid Claude chat UUID." : "Enter a chat UUID or paste a link copied from the desktop app."}
        </p>}
      </div>
    </div>
  );
}

function OpenCodeSessionLinks({ iconOnly }: { iconOnly: boolean }) {
  const [session, setSession] = useState("");
  const [project, setProject] = useState("");
  const links = [
    {
      label: "Saved session ID or link",
      placeholder: "ses_… or opencode://session/…",
      value: session,
      setValue: setSession,
      href: getAgentLink("opencode", "android", { session: session.trim() }),
      action: "Open saved session",
    },
    {
      label: "Project ID",
      placeholder: "Project ID from your OpenCode server",
      value: project,
      setValue: setProject,
      href: project.trim() && getAgentLink("opencode", "android", { mode: "new", project: project.trim() }),
      action: "Open new draft",
    },
  ];

  return (
    <div role="region" aria-label="OpenCode Android session links">
      <p className="session-setup-note">Pair the Android app with your OpenCode server first.</p>
      {links.map(({ label, placeholder, value, setValue, href, action }) => (
        <div key={label} className="link-setup">
          <label>
            {label}
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {value.trim() && (href ? (
            <Button asChild variant="ghost" className={iconOnly ? "agent-btn agent-btn-icon" : "agent-btn"}>
              <a href={href} {...linkAttrs(href)} aria-label={action} title={action}>
                <AgentLogo agent="opencode" />
                {!iconOnly && <span className="agent-name">{action}</span>}
              </a>
            </Button>
          ) : <p role="status">Enter a valid {label.toLowerCase()}.</p>)}
        </div>
      ))}
    </div>
  );
}

function ClaudeCodeWorkspaceLink({ iconOnly }: { iconOnly: boolean }) {
  const [destination, setDestination] = useState<"folder" | "ssh">("folder");
  const [folder, setFolder] = useState("");
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("");
  const [sshFolder, setSshFolder] = useState("");
  const [prompt, setPrompt] = useState(LIVE_PROMPT);
  const ssh = destination === "ssh";
  const hasTarget = ssh ? Boolean(sshHost) : Boolean(folder);
  const options = ssh ? { sshHost, sshPort, sshFolder } : { folder };
  const href = hasTarget && getAgentLink("claude-code", "desktop", { ...options, prompt });

  return (
    <div role="region" aria-label="Claude Code Desktop workspace link" className="workspace-setup">
      <div className="view-toggle" role="group" aria-label="Workspace destination">
        <button type="button" className="view-option" aria-pressed={!ssh} onClick={() => setDestination("folder")}>
          Local folder
        </button>
        <button type="button" className="view-option" aria-pressed={ssh} onClick={() => setDestination("ssh")}>
          SSH
        </button>
      </div>
      <div className="link-setup">
        {ssh ? (
          <>
            <label>
              SSH host
              <input value={sshHost} onChange={(event) => setSshHost(event.target.value)}
                placeholder="user@host" autoComplete="off" spellCheck={false} />
            </label>
            <label>
              SSH port (optional)
              <input value={sshPort} onChange={(event) => setSshPort(event.target.value)}
                placeholder="22" inputMode="numeric" autoComplete="off" />
            </label>
            <label>
              Remote folder (optional)
              <input value={sshFolder} onChange={(event) => setSshFolder(event.target.value)}
                placeholder="~/project" autoComplete="off" spellCheck={false} />
            </label>
          </>
        ) : (
          <label>
            Absolute local folder
            <input value={folder} onChange={(event) => setFolder(event.target.value)}
              placeholder="/path/to/project" autoComplete="off" spellCheck={false} />
          </label>
        )}
        <label>
          Draft prompt (optional)
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} />
        </label>
        {href ? (
          <Button asChild variant="ghost" className={iconOnly ? "agent-btn agent-btn-icon" : "agent-btn"}>
            <a href={href} aria-label="Open Claude Code workspace" title="Open Claude Code workspace">
              <AgentLogo agent="claude-code" />
              {!iconOnly && <span className="agent-name">Open workspace</span>}
            </a>
          </Button>
        ) : (hasTarget || (ssh && (sshPort || sshFolder))) && (
          <p role="status">{ssh ? "Check the SSH host and any port or folder you entered." : "Enter an absolute local folder."}</p>
        )}
      </div>
      <p className="session-setup-note">Claude Code asks you to confirm the destination. The prompt stays unsent.</p>
    </div>
  );
}

function DesktopToolLinkSetup({ example, iconOnly }: { example: DesktopToolExample; iconOnly: boolean }) {
  const [fields, setFields] = useState<Partial<Record<DesktopToolField, string>>>({});
  const [prompt, setPrompt] = useState(LIVE_PROMPT);
  const route = getAgentRoute(example.agent, example.platform);
  const needsPrompt = route?.required?.includes("prompt") ?? false;
  const href = getAgentLink(example.agent, example.platform, { ...fields, prompt });
  const label = `Open ${example.name}`;

  return (
    <div role="region" aria-label={`${example.name} link`} className="workspace-setup">
      <div className="link-setup">
        {example.fields.map(({ key, label: fieldLabel, placeholder }) => (
          <label key={key}>
            {fieldLabel}
            <input value={fields[key] ?? ""} placeholder={placeholder} autoComplete="off" spellCheck={false}
              onChange={(event) => setFields({ ...fields, [key]: event.target.value || undefined })} />
          </label>
        ))}
        <label>
          {needsPrompt ? "Draft prompt" : "Draft prompt (optional)"}
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} maxLength={route?.promptLimit} />
        </label>
        {href ? (
          <Button asChild variant="ghost" className={iconOnly ? "agent-btn agent-btn-icon" : "agent-btn"}>
            <a href={href} aria-label={label} title={label}>
              <AgentLogo agent={example.agent} />
              {!iconOnly && <span className="agent-name">{label}</span>}
            </a>
          </Button>
        ) : (
          <p role="status">{needsPrompt && !prompt.trim() ? "Enter a draft prompt." : example.invalidInput}</p>
        )}
      </div>
      <p className="session-setup-note">{example.note}</p>
    </div>
  );
}

function HighlightedSnippet() {
  return (
    <pre>
      <code>
        <span className="tok-kw">import</span>{" "}
        <span className="tok-punc">{"{"}</span>{" "}
        <span className="tok-fn">getAgentLink</span>{" "}
        <span className="tok-punc">{"}"}</span>{" "}
        <span className="tok-kw">from</span>{" "}
        <span className="tok-str">&quot;agent-deeplinks&quot;</span>
        {"\n\n"}
        <span className="tok-kw">const</span>{" "}
        <span className="tok-var">url</span>{" "}
        <span className="tok-punc">=</span>{" "}
        <span className="tok-fn">getAgentLink</span>
        <span className="tok-punc">(</span>
        <span className="tok-str">&quot;claude&quot;</span>
        <span className="tok-punc">,</span>{" "}
        <span className="tok-str">&quot;desktop&quot;</span>
        <span className="tok-punc">,</span>{" "}
        <span className="tok-punc">{"{"}</span>
        {"\n  "}
        <span className="tok-prop">prompt</span>
        <span className="tok-punc">:</span>{" "}
        <span className="tok-str">&quot;tell me about deeplinks.fun&quot;</span>
        <span className="tok-punc">,</span>
        {"\n"}
        <span className="tok-punc">{"})"}</span>
      </code>
    </pre>
  );
}

function App() {
  const [initial] = useState(detectInitialEnvironment);
  const [activeTab, setActiveTab] = useState<TabId>(initial.tab);
  const [mobileOs, setMobileOs] = useState<MobileOs>(initial.mobileOs);
  const [iconOnly, setIconOnly] = useState(false);
  const [setup, setSetup] = useState<{ agent: AgentId; platform: ActivePlatform }>();
  const [showOpenCodeSessions, setShowOpenCodeSessions] = useState(false);
  const [showClaudeWorkspace, setShowClaudeWorkspace] = useState(false);
  const [desktopChatAgent, setDesktopChatAgent] = useState<DesktopChatAgent>();
  const [desktopToolExample, setDesktopToolExample] = useState<DesktopToolExample>();
  const [destination, setDestination] = useState<{ example: DestinationExample; platform: ActivePlatform }>();

  const activePlatform: ActivePlatform = activeTab === "mobile" ? mobileOs : activeTab;
  const visibleTiles = tilesByPlatform[activePlatform];
  const actionExamples = examplesByPlatform[activePlatform];
  const destinationExamples = DESTINATION_EXAMPLES.filter((example) => {
    if (example.platform && example.platform !== activePlatform) return false;
    return example.action ? Boolean(getAgentRoute(example.agent, activePlatform, example.action))
      : getAgentRoute(example.agent, activePlatform)?.fields?.[example.field ?? "cloudAgent"] !== undefined;
  });
  const destinationExample = destination?.platform === activePlatform ? destination.example : undefined;
  const setupTile = setup?.platform === activePlatform ? visibleTiles.find((tile) => tile.id === setup.agent) : undefined;
  const agentButtonClass = iconOnly ? "agent-btn agent-btn-icon" : "agent-btn";

  return (
    <>
      <header className="site-header">
        <div className="page-frame header-inner">
          <a className="brand" href="/">
            <img src="/mark.svg?v=2" width={24} height={24} alt="" />
            <span>deeplinks.fun</span>
          </a>
          <a className="header-link" href={REPOSITORY} target="_blank" rel="noopener noreferrer">
            <Github size={15} aria-hidden="true" />
            <span>GitHub</span>
          </a>
        </div>
      </header>

      <main className="page-frame">
        <section className="hero" aria-labelledby="page-title">
          <h1 id="page-title">Agents are the new frontend.</h1>
          <p className="hero-lead">
            Open your app directly inside ChatGPT, Claude, Cursor, Codex, and more with a single deep link.
          </p>
        </section>

        <section aria-label="Agent deep links">
          <div className="controls-row">
            <div className="platform-tabs" role="group" aria-label="Target platform">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className="platform-tab"
                  aria-pressed={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="view-options">
              {activeTab === "mobile" && !initial.isMobileVisitor && (
                <div className="view-toggle" role="group" aria-label="Mobile OS">
                  <button type="button" className="view-option" aria-pressed={mobileOs === "ios"} onClick={() => setMobileOs("ios")}>
                    iOS
                  </button>
                  <button type="button" className="view-option" aria-pressed={mobileOs === "android"} onClick={() => setMobileOs("android")}>
                    Android
                  </button>
                </div>
              )}
              <div className="view-toggle" role="group" aria-label="Button style">
                <button
                  type="button"
                  className="view-option"
                  aria-pressed={!iconOnly}
                  onClick={() => setIconOnly(false)}
                >
                  Icons + names
                </button>
                <button
                  type="button"
                  className="view-option"
                  aria-pressed={iconOnly}
                  onClick={() => setIconOnly(true)}
                >
                  Icons only
                </button>
              </div>
            </div>
          </div>

          <div className="agent-row">
            {visibleTiles.map((tile) => tile.href ? (
              <Button key={tile.id} asChild variant="ghost" className={agentButtonClass}>
                <a href={tile.href} {...linkAttrs(tile.href)} aria-label={`Open ${tile.name}`} title={tile.name}>
                  <AgentLogo agent={tile.id} />
                  {!iconOnly && <span className="agent-name">{tile.name}</span>}
                </a>
              </Button>
            ) : (
              <Button
                key={tile.id}
                type="button"
                variant="ghost"
                className={agentButtonClass}
                aria-label={`Configure ${tile.name}`}
                aria-expanded={setupTile?.id === tile.id}
                title={`Configure ${tile.name}`}
                onClick={() => setSetup(setupTile?.id === tile.id ? undefined : { agent: tile.id, platform: activePlatform })}
              >
                <AgentLogo agent={tile.id} />
                {!iconOnly && <span className="action-btn-text">
                  <span className="agent-name">{tile.name}</span>
                  <span className="action-btn-kind">Configure link</span>
                </span>}
              </Button>
            ))}
          </div>
          {setupTile && (setupTile.id === "openclaw"
            ? <OpenClawLinkSetup key={activePlatform} platform={activePlatform} iconOnly={iconOnly} />
            : <LinkSetup key={`${activePlatform}-${setupTile.id}`} tile={setupTile} iconOnly={iconOnly} />)}
        </section>

        {actionExamples.length > 0 && (
          <section className="action-section" aria-labelledby="action-heading">
            <h2 id="action-heading">Apps and plugins</h2>
            <div className="agent-row action-row">
              {actionExamples.map((example) => (
                <Button key={example.key} asChild variant="ghost" className={agentButtonClass}>
                  <a
                    href={example.href}
                    {...linkAttrs(example.href)}
                    aria-label={`${example.agentName}: ${example.label}`}
                    title={`${example.agentName}: ${example.label}`}
                  >
                    <AgentLogo agent={example.agent} />
                    {!iconOnly && <span className="action-btn-text">
                      <span className="agent-name">{example.agentName}</span>
                      <span className="action-btn-kind">{example.label}</span>
                    </span>}
                  </a>
                </Button>
              ))}
              {destinationExamples.map((example) => {
                const name = agents[example.agent].name;
                const label = `Configure ${name} ${example.label}`;
                return (
                  <Button key={label} type="button" variant="ghost" className={agentButtonClass}
                    aria-label={label} aria-expanded={destinationExample === example} title={label}
                    onClick={() => setDestination(destinationExample === example ? undefined : { example, platform: activePlatform })}>
                    <AgentLogo agent={example.agent} />
                    {!iconOnly && <span className="action-btn-text">
                      <span className="agent-name">{name}</span>
                      <span className="action-btn-kind">{example.label}</span>
                    </span>}
                  </Button>
                );
              })}
              {activePlatform === "desktop" && DESKTOP_CHAT_AGENTS.map((agent) => {
                const name = agents[agent].name;
                const label = `Configure existing ${name} chat link`;
                return (
                  <Button key={agent} type="button" variant="ghost" className={agentButtonClass}
                    aria-label={label} aria-expanded={desktopChatAgent === agent} title={label}
                    onClick={() => setDesktopChatAgent((current) => current === agent ? undefined : agent)}>
                    <AgentLogo agent={agent} />
                    {!iconOnly && <span className="action-btn-text">
                      <span className="agent-name">{name}</span>
                      <span className="action-btn-kind">Existing chat</span>
                    </span>}
                  </Button>
                );
              })}
              {activePlatform === "desktop" && (
                <Button
                  type="button"
                  variant="ghost"
                  className={agentButtonClass}
                  aria-label="Configure Claude Code workspace link"
                  aria-expanded={showClaudeWorkspace}
                  title="Configure Claude Code workspace link"
                  onClick={() => setShowClaudeWorkspace((visible) => !visible)}
                >
                  <AgentLogo agent="claude-code" />
                  {!iconOnly && <span className="action-btn-text">
                    <span className="agent-name">Claude Code</span>
                    <span className="action-btn-kind">Workspace link</span>
                  </span>}
                </Button>
              )}
              {activePlatform === "desktop" && DESKTOP_TOOL_EXAMPLES.map((example) => {
                const label = `Configure ${example.name} link`;
                return (
                  <Button key={example.name} type="button" variant="ghost" className={agentButtonClass}
                    aria-label={label} aria-expanded={desktopToolExample === example} title={label}
                    onClick={() => setDesktopToolExample((current) => current === example ? undefined : example)}>
                    <AgentLogo agent={example.agent} />
                    {!iconOnly && <span className="action-btn-text">
                      <span className="agent-name">{agents[example.agent].name}</span>
                      <span className="action-btn-kind">{example.label}</span>
                    </span>}
                  </Button>
                );
              })}
              {activePlatform === "android" && (
                <Button
                  type="button"
                  variant="ghost"
                  className={agentButtonClass}
                  aria-label="Configure OpenCode Android session links"
                  aria-expanded={showOpenCodeSessions}
                  title="OpenCode Android session links"
                  onClick={() => setShowOpenCodeSessions((visible) => !visible)}
                >
                  <AgentLogo agent="opencode" />
                  {!iconOnly && <span className="action-btn-text">
                    <span className="agent-name">OpenCode</span>
                    <span className="action-btn-kind">Session links</span>
                  </span>}
                </Button>
              )}
            </div>
            {destinationExample && (
              <DestinationLinkSetup key={`${activePlatform}-${destinationExample.agent}-${destinationExample.label}`}
                example={destinationExample} platform={activePlatform} iconOnly={iconOnly} />
            )}
            {activePlatform === "desktop" && desktopChatAgent && (
              <ExistingDesktopChatLink key={desktopChatAgent} agent={desktopChatAgent} iconOnly={iconOnly} />
            )}
            {activePlatform === "desktop" && showClaudeWorkspace && <ClaudeCodeWorkspaceLink iconOnly={iconOnly} />}
            {activePlatform === "desktop" && desktopToolExample && (
              <DesktopToolLinkSetup key={desktopToolExample.name} example={desktopToolExample} iconOnly={iconOnly} />
            )}
            {activePlatform === "android" && showOpenCodeSessions && <OpenCodeSessionLinks iconOnly={iconOnly} />}
          </section>
        )}

        <section className="dev-section" aria-label="Install and usage">
          <div className="code-bar">
            <span className="code-prefix" aria-hidden="true">$</span>
            <code>
              <span className="tok-cmd">npm</span>{" "}
              <span className="tok-arg">install</span>{" "}
              <span className="tok-url">agent-deeplinks</span>
            </code>
            <CopyButton value={INSTALL_CMD} label="Copy install command" />
          </div>

          <div className="code-card">
            <HighlightedSnippet />
            <div className="code-card-copy">
              <CopyButton value={CODE_SNIPPET} label="Copy usage snippet" />
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-frame footer-inner">
          <span>deeplinks.fun · MIT</span>
          <span className="footer-credit">
            Made by{" "}
            <a href="https://x.com/shawmakesmagic" target="_blank" rel="noopener noreferrer">
              Shaw
            </a>
          </span>
          <div className="footer-links">
            <a href={REPOSITORY} target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href={RELEASE_ZIP}><Download size={14} aria-hidden="true" /> Download ZIP</a>
          </div>
        </div>
      </footer>
    </>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
