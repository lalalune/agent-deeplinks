import { createRoot } from "react-dom/client";
import { Check, ChevronDown, Clipboard, CodeXml, Download, FlaskConical, Github, Search, Terminal } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  agents, getAgentActions, getAgentIcon, getAgentLink, getAgentRoute, platformNames, platforms,
} from "../src/index.js";
import type { AgentActionField, AgentActionId, AgentId, Evidence, LinkBehavior, LinkField, LinkOptions, Platform } from "../src/index.js";
import { AgentIcon, AgentLink } from "../src/react.js";
import { Button } from "./components/ui/button.js";
import "./styles.css";

const repository = "https://github.com/lalalune/agent-deeplinks";
const release = `${repository}/releases/latest/download/agent-deeplinks.zip`;
const tarball = `${repository}/releases/latest/download/agent-deeplinks.tgz`;
const install = "npm install agent-deeplinks";
const examplePrompt = "Read the README and suggest three improvements.";

type ExtraField = Exclude<LinkField, "prompt" | "directory" | "server">;
type ExtraValues = Partial<Record<ExtraField, string>>;

const extraFieldDetails: Record<ExtraField, { label: string; placeholder?: string }> = {
  cwd: { label: "Working directory", placeholder: "/absolute/path/to/project" },
  repo: { label: "GitHub repository", placeholder: "owner/repo" },
  path: { label: "Workspace path", placeholder: "/absolute/path/to/project" },
  originUrl: { label: "Git remote URL", placeholder: "https://github.com/owner/repo.git" },
  folder: { label: "Workspace folder", placeholder: "/absolute/path/to/project" },
  sshHost: { label: "SSH host", placeholder: "dev@build.example.com" },
  sshPort: { label: "SSH port", placeholder: "2222" },
  sshFolder: { label: "SSH folder", placeholder: "~/project" },
  workspace: { label: "Workspace folder URI", placeholder: "file:///absolute/path/to/project" },
  mode: { label: "Session mode" },
  branch: { label: "Git branch", placeholder: "main" },
  pr: { label: "Pull request number", placeholder: "123" },
  customAgent: { label: "Custom agent" },
  provider: { label: "Provider ID" },
  model: { label: "Model ID" },
  botId: { label: "Bot ID" },
  session: { label: "Session ID" },
  environment: { label: "Environment ID" },
  task: { label: "Cloud task ID or URL", placeholder: "task_… or https://chatgpt.com/codex/tasks/…" },
  cloudAgent: { label: "Cloud Agent ID or URL", placeholder: "bc-… or https://cursor.com/agents/…" },
};

const extraFields = Object.keys(extraFieldDetails) as ExtraField[];
const serverFieldLabels: Partial<Record<AgentId, string>> = {
  hermes: "Web Access address",
  openclaw: "Gateway base address",
};

const evidenceNames: Record<Evidence, string> = {
  verified: "Verified",
  documented: "Documented",
  source: "In source",
  observed: "Observed",
};

const behaviorNames: Record<LinkBehavior, string> = {
  draft: "Prefills a draft",
  launch: "Opens the client",
  handoff: "Opens a handoff page",
  confirm: "Runs after confirmation",
  send: "Submits the prompt",
  unknown: "Behavior unconfirmed",
};

function CopyButton({ value, label = "Copy", iconOnly = false }: {
  value: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const [status, setStatus] = useState<{ value: string; copied: boolean }>();
  const copied = status?.value === value && status.copied;
  const failed = status?.value === value && !status.copied;
  return (
    <Button
      type="button"
      size={iconOnly ? "icon-sm" : "sm"}
      variant="ghost"
      aria-label={copied ? "Copied" : label}
      title={failed ? "Clipboard unavailable. Select and copy the displayed text." : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setStatus({ value, copied: true });
        } catch {
          setStatus({ value, copied: false });
        }
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
      {!iconOnly && (copied ? "Copied" : failed ? "Copy failed" : label)}
    </Button>
  );
}

function Logo({ agent }: { agent: AgentId }) {
  return (
    <span className="agent-logo" aria-hidden="true">
      {getAgentIcon(agent) ? <AgentIcon agent={agent} width={21} height={21} /> : <Terminal size={19} />}
    </span>
  );
}

function Select({ label, value, onChange, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
    </label>
  );
}

const actionAgents = Object.values(agents).filter(({ id }) => platforms.some((platform) => getAgentActions(id, platform).length));
const examplePlugin = "plugin_asdk_app_6abadab6e7d881919e7491d52c7846e8";
const exampleCodexPlugin = "openai-developers@openai-curated";
const exampleMercury = "plugin_asdk_app_6a17ae803744819187a3079d37479dae";
const actionExamples: Partial<Record<AgentId, Partial<Record<AgentActionId, LinkOptions>>>> = {
  chatgpt: {
    app: { target: examplePlugin, tool: "cad.browse", appPath: "/parts/part_joystick" },
    plugin: { target: examplePlugin },
    "plugin-install": { target: exampleMercury },
    "plugin-chat": { target: exampleMercury, prompt: "Summarize the information I can look up in this plugin." },
    "custom-gpt": { target: "g-1234-sample" },
  },
  codex: {
    plugin: { target: exampleCodexPlugin },
    "plugin-install": { target: "openai-developers", marketplace: "openai-curated" },
    "plugin-chat": { target: exampleCodexPlugin, prompt: "Find the docs for app deep links." },
  },
  claude: {
    plugin: { target: "268ba6b9-a27c-4bc8-9dc2-2a0b5ab79bfb@anthropic-plugin-directory" },
    connector: { target: "597f662f-36de-437e-836e-5a81013cbfbe" },
    "plugin-install": { target: "slack", marketplace: "anthropics/knowledge-work-plugins" },
  },
  cursor: {
    plugin: { target: "cursor/google-drive" },
    "mcp-install": { target: "Example Server", config: '{"url":"https://example.com/mcp"}' },
  },
  "grok-bot": {
    plugin: { target: "9007199254740993" },
    "team-plugin": { target: "456" },
    "team-bot": { target: "3f937d36-4777-4c7c-9139-a8a48a38c7fe" },
    "bot-template": { target: "https://x.ai/bot/W4Z5pvEm6UgCml48Ig4dT/thoth" },
  },
  antigravity: {
    plugin: { target: "firebase" },
    skill: { target: "sample", marketplace: "antigravity-plugins-partners" },
  },
  hermes: { "skill-install": { target: "official/security/1password" } },
  gemini: { gem: { target: "gem-id" } },
  perplexity: { project: { target: "https://www.perplexity.ai/projects/sample-project" } },
};

function ActionPlayground() {
  const [agent, setAgent] = useState<AgentId>("chatgpt");
  const [preferredPlatform, setPlatform] = useState<Platform>("web");
  const [selectedAction, setAction] = useState<AgentActionId>("app");
  const [edits, setEdits] = useState<Partial<Record<string, Partial<Record<AgentActionField, string>>>>>({});
  const supportedPlatforms = platforms.filter((platform) => getAgentActions(agent, platform).length);
  const platform = supportedPlatforms.includes(preferredPlatform) ? preferredPlatform : supportedPlatforms[0] ?? "web";
  const actions = getAgentActions(agent, platform);
  const action = actions.find(({ id }) => id === selectedAction) ?? actions[0];
  if (!action) return null;

  const exampleAgent = agent === "chatgpt" && platform === "desktop" && action.id !== "app" ? "codex" : agent;
  const key = `${agent}/${platform}/${action.id}`;
  const options: LinkOptions = { ...actionExamples[exampleAgent]?.[action.id], ...edits[key], action: action.id };
  const href = getAgentLink(agent, platform, options);
  const isGrokShare = action.id === "team-bot" || action.id === "bot-template";
  const example = href && getReactExample(agent, platform, isGrokShare ? { ...options, target: href } : options);
  const label = `${action.label} in ${agents[agent].name}`;
  const behavior = action.behavior === "confirm" ? "Opens a review"
    : action.behavior === "launch" ? "Opens the destination" : behaviorNames[action.behavior];

  return (
    <section className="matrix action-playground" id="apps" aria-labelledby="apps-title">
      <div className="section-heading">
        <div>
          <h2 id="apps-title">Apps and plugins</h2>
          <p>Build a link to an app page, plugin, skill, or install review.</p>
        </div>
      </div>
      <div className="action-layout">
        <div className="action-controls">
          <div className="selector-grid">
            <Select label="Action agent" value={agent} onChange={(value) => setAgent(value as AgentId)}>
              {actionAgents.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </Select>
            <Select label="Action platform" value={platform} onChange={(value) => setPlatform(value as Platform)}>
              {supportedPlatforms.map((item) => <option key={item} value={item}>{platformNames[item]}</option>)}
            </Select>
          </div>
          <Select label="Destination" value={action.id} onChange={(value) => setAction(value as AgentActionId)}>
            {actions.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </Select>
          {action.inputs.map(({ field, label, placeholder }) => {
            const edit = (value: string) => setEdits((saved) => ({ ...saved, [key]: { ...saved[key], [field]: value } }));
            return (
              <label className="field" key={field}>
                <span>{label}</span>
                {field === "prompt" || field === "config"
                  ? <textarea value={options[field] ?? ""} placeholder={placeholder} rows={3} onChange={(event) => edit(event.target.value)} />
                  : <input value={options[field] ?? ""} placeholder={placeholder} onChange={(event) => edit(event.target.value)} />}
              </label>
            );
          })}
          <div className="action-result" aria-live="polite">
            <div className="result-label">
              <span>Generated action URL</span>
              <span className="link-behavior">{evidenceNames[action.evidence]} · {behavior}</span>
              {href && <CopyButton label="Copy action URL" value={href} iconOnly />}
            </div>
            {href ? <code>{href}</code> : <p>Complete the destination fields to generate the URL.</p>}
          </div>
          <div className="action-buttons">
            {href && (
              <>
                <Button asChild><AgentLink agent={agent} platform={platform} options={options} aria-label={label} /></Button>
                <Button asChild variant="outline" size="icon" className="icon-link">
                  <AgentLink agent={agent} platform={platform} options={options} aria-label={`${label} on ${platformNames[platform]}`} iconOnly />
                </Button>
              </>
            )}
            <a className="source-link" href={action.sources[0]}>View action source</a>
          </div>
          {action.note && <p className="action-note">{action.note}</p>}
        </div>
        <div className="action-code">
          <div>
            <CodeXml size={17} aria-hidden="true" />
            <span>OpenAgentDestination.tsx</span>
            {example && <CopyButton label="Copy action code example" value={example} iconOnly />}
          </div>
          {example ? <pre><code>{example}</code></pre> : <p>Enter valid destination fields to generate the React example.</p>}
        </div>
      </div>
    </section>
  );
}

function App() {
  const [agent, setAgent] = useState<AgentId>("codex");
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [prompt, setPrompt] = useState(examplePrompt);
  const [t3ThreadPrompt, setT3ThreadPrompt] = useState("");
  const [claudeCodeCloudSession, setClaudeCodeCloudSession] = useState("");
  const [directoryByRoute, setDirectoryByRoute] = useState<Partial<Record<string, string>>>({});
  const [serverByTarget, setServerByTarget] = useState<Partial<Record<string, string>>>({});
  const [extraByAgent, setExtraByAgent] = useState<Partial<Record<AgentId, ExtraValues>>>({});
  const [experimentalRoute, setExperimentalRoute] = useState<string>();
  const [sendRoute, setSendRoute] = useState<string>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Platform | "all">("all");

  const route = getAgentRoute(agent, platform);
  const routeKey = `${agent}/${platform}`;
  const directory = directoryByRoute[routeKey] ?? "";
  const hasGatewaySetup = agent === "openclaw" && (platform === "desktop" || platform === "ios");
  const isIosGateway = hasGatewaySetup && platform === "ios";
  const isOpenClawBrowser = agent === "openclaw" && (platform === "web" || platform === "android");
  const isOpenCodeAndroid = agent === "opencode" && platform === "android";
  const serverKey = hasGatewaySetup ? routeKey : agent;
  const server = serverByTarget[serverKey] ?? "";
  const isGatewaySetup = hasGatewaySetup && Boolean(server);
  const hasClaudeCodeCloudSession = agent === "claude-code" && Boolean(route?.sessionUrl);
  const savedOptions = extraByAgent[agent] ?? {};
  const extraValues = hasClaudeCodeCloudSession ? { ...savedOptions, session: claudeCodeCloudSession } : savedOptions;
  const isT3Thread = agent === "t3-code" && Boolean(extraValues.environment || extraValues.session);
  const currentPrompt = isT3Thread ? t3ThreadPrompt : prompt;
  const isExistingSession = Boolean(route?.sessionUrl && extraValues.session);
  const isCodexTask = agent === "codex" && Boolean(route?.fields?.task !== undefined && extraValues.task);
  const isCursorCloudAgent = agent === "cursor" && Boolean(extraValues.cloudAgent);
  const visibleExtraFields = extraFields.filter((field) =>
    Object.hasOwn(route?.fields ?? {}, field) && (!isExistingSession || field === "session") &&
    (!isT3Thread || field === "session" || field === "environment"),
  );
  const options: LinkOptions = {
    ...Object.fromEntries(visibleExtraFields.map((field) => [field, extraValues[field] || undefined])),
    ...(route?.fields?.prompt && !isGatewaySetup && !isExistingSession && !isCursorCloudAgent ? { prompt: currentPrompt } : {}),
    ...(Object.hasOwn(route?.fields ?? {}, "directory") && directory ? { directory } : {}),
    ...(Object.hasOwn(route?.fields ?? {}, "server") && server && !isT3Thread ? { server } : {}),
    ...(route?.browserOnlyFragment || (isCodexTask && platform === "web") ? { browserOnly: true } : {}),
    ...(route?.experimental && experimentalRoute === routeKey ? { allowExperimental: true } : {}),
    ...(route?.behavior === "send" && sendRoute === routeKey ? { allowSend: true } : {}),
  };
  const hasSshOptions = Boolean(options.sshHost || options.sshPort || options.sshFolder);
  const href = getAgentLink(agent, platform, options);
  const sampleOptions: LinkOptions = {
    ...(route?.fields?.prompt ? { prompt: examplePrompt } : {}),
    ...(route?.required?.includes("directory") ? { directory: "/absolute/path/to/project" } : {}),
    ...(route?.required?.includes("server") ? { server: "https://your-agent.example.com" } : {}),
    ...(options.browserOnly ? { browserOnly: true } : {}),
    ...(options.allowExperimental ? { allowExperimental: true } : {}),
    ...(options.allowSend ? { allowSend: true } : {}),
  };
  const exampleOptions = href ? {
    ...options,
    ...(isCodexTask ? { task: href.replace(/#no_universal_links$/u, "") } : {}),
    ...(isCursorCloudAgent ? { cloudAgent: platform === "desktop" ? new URL(href).searchParams.get("bcId") ?? undefined : href } : {}),
  } : sampleOptions;
  const useSampleOptions = !hasSshOptions && !options.folder && !isGatewaySetup && !isExistingSession && !isT3Thread && !isCodexTask && !isCursorCloudAgent &&
    (!(isOpenClawBrowser || isOpenCodeAndroid) || !options.session);
  const reactExample = href || (useSampleOptions && getAgentLink(agent, platform, exampleOptions))
    ? getReactExample(agent, platform, exampleOptions)
    : null;
  const isLaunchOption = Boolean(href && route?.launchUrl && href === getAgentLink(agent, platform, { browserOnly: options.browserOnly }));
  const behavior = isLaunchOption || (isOpenClawBrowser && !options.prompt)
    ? "launch" : (options.server && route?.serverBehavior) || route?.behavior;
  const reviewLabel = isGatewaySetup ? "Reviews a Gateway address"
    : hasSshOptions ? "Reviews an SSH target"
    : options.folder ? "Reviews a workspace folder"
    : agent === "grok" && platform === "web" && options.prompt ? "Reviews before sending" : undefined;
  const behaviorLabel = isExistingSession ? href && (hasClaudeCodeCloudSession ? "Opens an existing cloud session" : "Opens an existing chat")
    : isT3Thread ? href && (options.prompt?.trim() ? "Opens a thread with a draft" : "Opens an existing thread")
    : isCodexTask ? href && "Opens an existing cloud task"
    : isCursorCloudAgent ? href && "Opens an existing Cloud Agent"
    : isOpenCodeAndroid && options.session ? href && "Opens a saved session"
    : isOpenCodeAndroid && options.mode === "new" ? "Opens a blank session"
    : isOpenCodeAndroid && options.mode === "last" ? "Opens the last session"
    : reviewLabel ? href && reviewLabel : behavior && behaviorNames[behavior];
  const sshSource = hasSshOptions && route?.sources.find((url) => url.endsWith("#open-an-ssh-session-from-a-link"));
  const threadSource = isT3Thread && route?.sources.find((url) => url.includes("/threadLinks.ts"));
  const taskSource = isCodexTask && route?.sources.find((url) => url.includes("/cloud-tasks/src/util.rs"));
  const cloudAgentSource = isCursorCloudAgent && route?.sources.find((url) => platform === "desktop"
    ? url.includes("open-by-id-url-for-the-cloud-agent") : url.endsWith("/cloud-agent/api/endpoints"));
  const source = sshSource || threadSource || taskSource || cloudAgentSource || (options.server && route?.serverSource) || route?.sources[0];
  const visibleAgents = Object.values(agents).filter((entry) =>
    `${entry.name} ${entry.description}`.toLowerCase().includes(search.trim().toLowerCase()) &&
    (filter === "all" || getAgentRoute(entry.id, filter)),
  );

  function selectAgent(id: AgentId) {
    setAgent(id);
    if (!getAgentRoute(id, platform)) {
      setPlatform(platforms.find((candidate) => getAgentRoute(id, candidate)) ?? "web");
    }
  }

  function explore(id: AgentId, target: Platform) {
    setAgent(id);
    setPlatform(target);
    document.getElementById("playground")?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("playground-title")?.focus({ preventScroll: true });
  }

  function updateExtraField(field: ExtraField, value: string) {
    if (field === "session" && hasClaudeCodeCloudSession) {
      setClaudeCodeCloudSession(value);
      return;
    }
    setExtraByAgent((previous) => ({ ...previous, [agent]: { ...previous[agent], [field]: value } }));
  }

  return (
    <>
      <header className="site-header">
        <div className="frame header-row">
          <a className="wordmark" href="/" aria-label="Agent Deeplinks home">
            <img src="/mark.svg" width={32} height={32} alt="" />
            <span>Agent Deeplinks</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#playground">Playground</a>
            <a href="#support">Support matrix</a>
            <a href="#apps">Apps and plugins</a>
            <a href="#usage">Usage</a>
          </nav>
          <Button asChild variant="outline" size="sm">
            <a href={repository}><Github aria-hidden="true" /> <span>GitHub</span></a>
          </Button>
        </div>
      </header>

      <main className="frame">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-content">
            <p className="eyebrow"><span aria-hidden="true" /> Open-source developer toolkit</p>
            <h1 id="page-title">Open in<br />your <em>agent.</em></h1>
            <p className="intro">Add an “Open in” button to your app. Get deep links for web, desktop, and mobile, with real SVG icons and a shadcn/ui example.</p>
            <div className="install-line" title={install}>
              <Terminal aria-hidden="true" size={17} />
              <code>{install}</code>
              <CopyButton value={install} label="Copy install command" iconOnly />
            </div>
            <Button asChild variant="outline">
              <a href={release}><Download aria-hidden="true" /> Download ZIP</a>
            </Button>
          </div>

          <section className="playground" id="playground" aria-labelledby="playground-title">
            <div className="panel-heading">
              <div>
                <h2 id="playground-title" tabIndex={-1}>Link playground</h2>
                <p>Choose an agent and try its link.</p>
              </div>
              <FlaskConical size={19} aria-hidden="true" />
            </div>
            <div className="panel-body">
              <div className="selector-grid">
                <Select label="Agent" value={agent} onChange={(value) => selectAgent(value as AgentId)}>
                  {Object.values(agents).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </Select>
                <Select label="Platform" value={platform} onChange={(value) => setPlatform(value as Platform)}>
                  {platforms.map((item) => <option key={item} value={item}>{platformNames[item]}</option>)}
                </Select>
              </div>
              {route?.fields?.prompt && !isGatewaySetup && !isExistingSession && !isCursorCloudAgent && (
                <label className="field">
                  <span>{isT3Thread ? "Draft (optional)" : "Prompt"}</span>
                  <textarea rows={2} value={currentPrompt} onChange={(event) =>
                    (isT3Thread ? setT3ThreadPrompt : setPrompt)(event.target.value)} />
                </label>
              )}
              {Object.hasOwn(route?.fields ?? {}, "directory") && (
                <label className="field">
                  <span>
                    {agent === "opencode" && platform === "web"
                      ? "OpenCode 1.x project directory (optional)"
                      : route?.required?.includes("directory") ? "Local project directory" : "Local project directory (optional)"}
                  </span>
                  <input
                    value={directory}
                    onChange={(event) => setDirectoryByRoute({ ...directoryByRoute, [routeKey]: event.target.value })}
                    placeholder="/absolute/path/to/project"
                  />
                </label>
              )}
              {Object.hasOwn(route?.fields ?? {}, "server") && !isT3Thread && (
                <label className="field">
                  <span>
                    {isIosGateway ? "Gateway address (optional)"
                      : hasGatewaySetup ? "Gateway HTTPS address (optional)"
                      : isOpenClawBrowser && platform === "web" ? "Gateway base address (optional)" : route?.required?.includes("server")
                      ? serverFieldLabels[agent] ?? "Server origin"
                      : route?.serverBehavior ? "Server origin (optional)" : "Web app address (optional)"}
                  </span>
                  <input
                    value={server}
                    onChange={(event) => setServerByTarget({ ...serverByTarget, [serverKey]: event.target.value })}
                    placeholder={isIosGateway ? "https://gateway.example.com:443"
                      : hasGatewaySetup || (isOpenClawBrowser && platform === "android")
                        ? "https://gateway.example.com/openclaw/" : route?.url}
                  />
                </label>
              )}
              {visibleExtraFields.length > 0 && (
                <details className="extra-fields" key={routeKey}>
                  <summary>Additional link options</summary>
                  <div>
                    {visibleExtraFields.map((field) => {
                      const { label, placeholder } = extraFieldDetails[field];
                      return field === "mode" ? (
                        <Select key={field} label={label} value={extraValues[field] ?? ""} onChange={(value) => updateExtraField(field, value)}>
                          <option value="">Default</option>
                          {route?.modes?.map((mode) => (
                            <option key={mode} value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</option>
                          ))}
                        </Select>
                      ) : (
                        <label className="field" key={field}>
                          <span>{field === "session" && isOpenClawBrowser ? "Session URL (optional)"
                            : field === "session" && agent === "t3-code" ? "Thread ID"
                            : field === "session" && hasClaudeCodeCloudSession ? "Cloud session ID"
                            : field === "session" && route?.sessionUrl ? "Chat ID (UUID)" : label}</span>
                          <input value={extraValues[field] ?? ""} placeholder={field === "session" && isOpenClawBrowser
                            ? "https://gateway.example.com/chat/main" : field === "session" && isOpenCodeAndroid
                              ? "ses_example" : field === "session" && hasClaudeCodeCloudSession ? "session_… or cse_…" : placeholder}
                            onChange={(event) => updateExtraField(field, event.target.value)} />
                        </label>
                      );
                    })}
                  </div>
                </details>
              )}
              {route?.experimental && !isLaunchOption && (
                <label className="opt-in">
                  <input type="checkbox" checked={experimentalRoute === routeKey} onChange={(event) => setExperimentalRoute(event.target.checked ? routeKey : undefined)} />
                  Try a link with unconfirmed behavior
                </label>
              )}
              {route?.behavior === "send" && !isLaunchOption && (
                <label className="opt-in">
                  <input type="checkbox" checked={sendRoute === routeKey} onChange={(event) => setSendRoute(event.target.checked ? routeKey : undefined)} />
                  Allow the link to submit the prompt
                </label>
              )}

              <div className="result" aria-live="polite">
                <div className="result-label">
                  <span>Generated URL</span>
                  {behaviorLabel && <span className="link-behavior">{behaviorLabel}</span>}
                  {href && <CopyButton value={href} label="Copy generated URL" iconOnly />}
                </div>
                {href ? <code>{href}</code> : (
                  <p>{hasSshOptions
                    ? "Check the SSH host, port, and folder. Clear Workspace folder when using SSH."
                    : isExistingSession ? (hasClaudeCodeCloudSession
                      ? "Enter a cloud session ID beginning with session_ or cse_."
                      : "Enter the ID from the app’s existing chat link.")
                    : isT3Thread ? "Enter both a valid environment ID and thread ID."
                    : isCodexTask ? "Enter a task_ ID or a Codex task URL on chatgpt.com."
                    : isCursorCloudAgent ? "Enter a bc- ID or a Cloud Agent URL on cursor.com."
                    : isOpenClawBrowser && options.session ? "Enter a chat session URL on the configured Gateway."
                    : isOpenCodeAndroid ? "Use a valid session ID or choose a session mode."
                    : options.folder ? "Enter an absolute workspace folder path."
                    : isGatewaySetup ? (isIosGateway
                      ? "Enter a Gateway origin with HTTPS or WSS, or use HTTP or WS on a local network."
                      : "Enter an HTTPS address without credentials, a query, or a fragment.")
                    : !route ? "No deeplink confirmed for this platform." : "Complete the required fields or opt in above."}</p>
                )}
              </div>
              <div className="panel-actions">
                {href ? (
                  <>
                    <Button asChild><AgentLink agent={agent} platform={platform} options={options} /></Button>
                    <Button asChild variant="outline" size="icon" className="icon-link">
                      <AgentLink agent={agent} platform={platform} options={options} iconOnly />
                    </Button>
                  </>
                ) : (
                  <Button asChild variant="outline">
                    <a href={agents[agent].home}>Visit {agents[agent].name}</a>
                  </Button>
                )}
                {source && <a className="source-link" href={source}>View source</a>}
              </div>
              {isExistingSession ? (
                <p className="route-note">{hasClaudeCodeCloudSession
                  ? "Opens the session for an account with access to it."
                  : "Uses the app’s documented chat link. The app needs access to that conversation."}</p>
              ) : route?.note && <p className="route-note">{route.note}</p>}
            </div>
          </section>
        </section>

        <section className="matrix" id="support" aria-labelledby="support-title">
          <div className="section-heading">
            <div>
              <h2 id="support-title">Platform support</h2>
              <p>Select an evidence label to try the link and see its source.</p>
            </div>
            <div className="matrix-controls">
              <label className="search">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={search} placeholder="Find an agent" aria-label="Find an agent" onChange={(event) => setSearch(event.target.value)} />
              </label>
              <Select label="Filter by platform" value={filter} onChange={(value) => setFilter(value as Platform | "all")}>
                <option value="all">All platforms</option>
                {platforms.map((item) => <option key={item} value={item}>{platformNames[item]}</option>)}
              </Select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">Agent</th>{platforms.map((item) => <th key={item} scope="col">{platformNames[item]}</th>)}</tr>
              </thead>
              <tbody>
                {visibleAgents.map((entry) => (
                  <tr key={entry.id}>
                    <th scope="row">
                      <button className="agent-cell" type="button" onClick={() => explore(entry.id, platforms.find((item) => getAgentRoute(entry.id, item)) ?? "web")}>
                        <Logo agent={entry.id} /><span>{entry.name}</span>
                      </button>
                    </th>
                    {platforms.map((target) => {
                      const entryRoute = getAgentRoute(entry.id, target);
                      return (
                        <td key={target}>
                          {entryRoute ? (
                            <button className={`evidence evidence-${entryRoute.evidence}`} type="button"
                              aria-label={`${entry.name} on ${platformNames[target]}: ${evidenceNames[entryRoute.evidence]}`}
                              onClick={() => explore(entry.id, target)}
                            >
                              <span aria-hidden="true" />{evidenceNames[entryRoute.evidence]}
                            </button>
                          ) : <span className="no-route" aria-label="No confirmed route">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {visibleAgents.length === 0 && <tr><td className="empty-state" colSpan={platforms.length + 1}>No agents match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="matrix-key" aria-label="Evidence legend">
            <span><strong>Verified</strong> checked in the client</span>
            <span><strong>Documented</strong> described by the provider</span>
            <span><strong>In source</strong> found in first-party code</span>
            <span><strong>Observed</strong> seen in a published integration</span>
          </div>
        </section>

        <ActionPlayground />

        <section className="usage" id="usage" aria-labelledby="usage-title">
          <div>
            <h2 id="usage-title">Use it in your app</h2>
            <p>Build the URL with TypeScript or compose the React link with your shadcn/ui Button. Add <code>iconOnly</code> for a compact button.</p>
            <div className="usage-links">
              <a className="source-link" href={`${repository}#usage`}>Read the integration guide</a>
              <a className="source-link" href={tarball}>Download npm tarball</a>
            </div>
          </div>
          <div className="code-example">
            <div>
              <CodeXml size={17} aria-hidden="true" />
              <span>OpenInAgent.tsx</span>
              {reactExample && <CopyButton value={reactExample} label="Copy code example" iconOnly />}
            </div>
            {reactExample ? <pre><code>{reactExample}</code></pre> : (
              <p>{hasSshOptions
                ? "Enter valid SSH options to generate this example."
                : isCodexTask ? "Enter a valid Codex cloud task to generate this example."
                : isCursorCloudAgent ? "Enter a valid Cloud Agent to generate this example."
                : isExistingSession ? (hasClaudeCodeCloudSession
                  ? "Enter a valid cloud session ID to generate this example."
                  : "Enter a valid chat ID to generate this example.")
                : isT3Thread ? "Enter both a valid environment ID and thread ID."
                : options.folder ? "Enter an absolute workspace folder path to generate this example."
                : isGatewaySetup ? "Enter a valid Gateway address to generate this example."
                : route ? "Opt in to this link to generate its code example." : "Choose a supported platform to see its code example."}</p>
            )}
          </div>
        </section>
      </main>

      <footer>
        <div className="frame footer-row">
          <span>Agent Deeplinks · MIT</span>
          <a href={`${repository}/tree/main/research`}>Research notes</a>
          <a href={`${repository}/releases`}>Releases</a>
        </div>
      </footer>
    </>
  );
}

function getReactExample(agent: AgentId, platform: Platform, options: LinkOptions): string {
  const optionEntries = Object.entries(options).filter(([, value]) => value !== undefined && value !== "");
  const optionLines = optionEntries.map(([field, value]) => `          ${field}: ${JSON.stringify(value)},`);
  const optionsProp = optionLines.length ? `\n        options={{\n${optionLines.join("\n")}\n        }}` : "";
  return `import { AgentLink } from "agent-deeplinks/react"
import { Button } from "@/components/ui/button"

export function OpenInAgent() {
  return (
    <Button asChild variant="outline">
      <AgentLink
        agent="${agent}"
        platform="${platform}"${optionsProp}
      />
    </Button>
  )
}`;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
