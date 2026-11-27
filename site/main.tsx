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
  placeholder: string;
  action?: AgentActionId;
}

const DESTINATION_EXAMPLES: readonly DestinationExample[] = [
  { agent: "cursor", label: "Cloud Agent", inputLabel: "Cloud Agent ID or URL", placeholder: "https://cursor.com/agents/bc-…" },
  { agent: "cursor", label: "Origin PR", inputLabel: "Origin pull request URL",
    placeholder: "https://cursor.com/codebase/acme/rocket/pull/1", action: "pull-request" },
  { agent: "cursor", label: "Shared transcript", inputLabel: "Transcript ID or URL",
    placeholder: "https://cursor.com/s/abc123", action: "shared-chat" },
  { agent: "grok-build", label: "Cloud Agent", inputLabel: "Cloud Agent ID or URL", placeholder: "https://grok.com/build/bc-…" },
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
    "shared-chat": {
      label: "Shared chat",
      options: () => ({ target: "12345678-1234-4234-9234-123456789abc" }),
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
    "shared-chat": {
      label: "Shared chat",
      options: () => ({ target: "cx_00000000000080008000000000000000" }),
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
    "shared-chat": {
      label: "Shared chat",
      options: () => ({ target: "7b6b317b-bea4-4fa4-8463-d9265ad80a00" }),
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
  grok: {
    "shared-chat": {
      label: "Shared chat",
      options: () => ({ target: "bGVnYWN5_b5ff0ac4-5283-424e-b722-b42379c923f5" }),
    },
  },
  "grok-bot": {
    plugin: {
      label: "Marketplace plugin",
      options: () => ({ target: "9007199254740993" }),
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
      options: () => ({ target: "https://code.example.com/auth/connect/example_code" }),
    },
  },
  kimi: {
    "shared-chat": {
      label: "Shared chat",
      options: () => ({ target: "https://www.kimi.ai/share/d1qvs6d96bk3t9j9ble0" }),
    },
  },
  zcode: {
    "shared-chat": {
      label: "Shared chat",
      options: () => ({ target: "https://zcode.z.ai/share/example-share-code" }),
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
  if (!tile.setupField) return null;
  const isDirectory = tile.setupField === "directory";
  const label = isDirectory ? "Local folder"
    : tile.id === "opencode" ? "OpenCode server origin"
      : tile.id === "hermes" ? "Hermes Web Access address" : "Gateway address";
  const example = isDirectory ? "/absolute/path/to/project"
    : tile.id === "opencode" ? "https://opencode.example.com" : "https://agent.example.com";
  const href = getAgentLink(tile.id, tile.platform, { [tile.setupField]: isDirectory ? value : value.trim() });

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
      {href ? (
        <Button asChild variant="ghost" className={iconOnly ? "agent-btn agent-btn-icon" : "agent-btn"}>
          <a href={href} {...linkAttrs(href)} aria-label={`Open ${tile.name}`} title={tile.name}>
            <AgentLogo agent={tile.id} />
            {!iconOnly && <span className="agent-name">Open {tile.name}</span>}
          </a>
        </Button>
      ) : value.trim() && <p role="status">Enter {isDirectory ? "an absolute folder path" : "a valid server address"}.</p>}
    </div>
  );
}

function DestinationLinkSetup({ example, platform, iconOnly }: {
  example: DestinationExample;
  platform: ActivePlatform;
  iconOnly: boolean;
}) {
  const [value, setValue] = useState("");
  const target = value.trim();
  const options = example.action ? { action: example.action, target } : { cloudAgent: target };
  const href = target && getAgentLink(example.agent, platform, options);
  const destination = `${agents[example.agent].name} ${example.label}`;
  const label = `Open ${destination}`;

  return (
    <div role="region" aria-label={`${destination} link`} className="link-setup">
      <label>
        {example.inputLabel}
        <input value={value} onChange={(event) => setValue(event.target.value)}
          placeholder={example.placeholder} aria-invalid={Boolean(target && !href)}
          autoComplete="off" autoCapitalize="off" spellCheck={false} />
      </label>
      {href ? (
        <Button asChild variant="ghost" className={iconOnly ? "agent-btn agent-btn-icon" : "agent-btn"}>
          <a href={href} {...linkAttrs(href)} aria-label={label} title={label}>
            <AgentLogo agent={example.agent} />
            {!iconOnly && <span className="agent-name">{label}</span>}
          </a>
        </Button>
      ) : target && <p role="status">Enter a valid {example.inputLabel}.</p>}
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
  const [destination, setDestination] = useState<{ example: DestinationExample; platform: ActivePlatform }>();

  const activePlatform: ActivePlatform = activeTab === "mobile" ? mobileOs : activeTab;
  const visibleTiles = tilesByPlatform[activePlatform];
  const actionExamples = examplesByPlatform[activePlatform];
  const destinationExamples = DESTINATION_EXAMPLES.filter((example) =>
    example.action ? Boolean(getAgentRoute(example.agent, activePlatform, example.action))
      : getAgentRoute(example.agent, activePlatform)?.fields?.cloudAgent !== undefined,
  );
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
          {setupTile && <LinkSetup key={`${activePlatform}-${setupTile.id}`} tile={setupTile} iconOnly={iconOnly} />}
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
