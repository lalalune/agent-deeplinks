import { createRoot } from "react-dom/client";
import { Check, ChevronDown, Clipboard, CodeXml, Download, FlaskConical, Github, Search, Terminal } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  agents, getAgentIcon, getAgentLink, getAgentRoute, platformNames, platforms,
} from "../src/index.js";
import type { AgentId, Evidence, LinkBehavior, LinkOptions, Platform } from "../src/index.js";
import { AgentIcon, AgentLink } from "../src/react.js";
import { Button } from "./components/ui/button.js";
import "./styles.css";

const repository = "https://github.com/lalalune/agent-deeplinks";
const release = `${repository}/releases/latest/download/agent-deeplinks.zip`;
const tarball = `${repository}/releases/latest/download/agent-deeplinks.tgz`;
const install = `npm install ${tarball}`;
const examplePrompt = "Read the README and suggest three improvements.";

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

function App() {
  const [agent, setAgent] = useState<AgentId>("codex");
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [prompt, setPrompt] = useState(examplePrompt);
  const [directory, setDirectory] = useState("");
  const [server, setServer] = useState("");
  const [experimentalRoute, setExperimentalRoute] = useState<string>();
  const [sendRoute, setSendRoute] = useState<string>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Platform | "all">("all");

  const route = getAgentRoute(agent, platform);
  const routeKey = `${agent}/${platform}`;
  const options: LinkOptions = {
    ...(route?.fields?.prompt ? { prompt } : {}),
    ...(Object.hasOwn(route?.fields ?? {}, "directory") && directory ? { directory } : {}),
    ...(Object.hasOwn(route?.fields ?? {}, "server") ? { server } : {}),
    ...(route?.experimental && experimentalRoute === routeKey ? { allowExperimental: true } : {}),
    ...(route?.behavior === "send" && sendRoute === routeKey ? { allowSend: true } : {}),
  };
  const href = getAgentLink(agent, platform, options);
  const source = route?.sources[0];
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
              {route?.fields?.prompt && (
                <label className="field">
                  <span>Prompt</span>
                  <textarea rows={2} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
                </label>
              )}
              {Object.hasOwn(route?.fields ?? {}, "directory") && (
                <label className="field">
                  <span>{route?.required?.includes("directory") ? "Local project directory" : "Local project directory (optional)"}</span>
                  <input value={directory} onChange={(event) => setDirectory(event.target.value)} placeholder="/absolute/path/to/project" />
                </label>
              )}
              {Object.hasOwn(route?.fields ?? {}, "server") && (
                <label className="field">
                  <span>Server origin</span>
                  <input value={server} onChange={(event) => setServer(event.target.value)} placeholder="http://localhost:4096" />
                </label>
              )}
              {route?.experimental && (
                <label className="opt-in">
                  <input type="checkbox" checked={experimentalRoute === routeKey} onChange={(event) => setExperimentalRoute(event.target.checked ? routeKey : undefined)} />
                  Try a link with unconfirmed behavior
                </label>
              )}
              {route?.behavior === "send" && (
                <label className="opt-in">
                  <input type="checkbox" checked={sendRoute === routeKey} onChange={(event) => setSendRoute(event.target.checked ? routeKey : undefined)} />
                  Allow the link to submit the prompt
                </label>
              )}

              <div className="result" aria-live="polite">
                <div className="result-label">
                  <span>Generated URL</span>
                  {route && <span className="link-behavior">{behaviorNames[route.behavior]}</span>}
                  {href && <CopyButton value={href} label="Copy generated URL" iconOnly />}
                </div>
                {href ? <code>{href}</code> : (
                  <p>{!route ? "No deeplink confirmed for this platform." : "Complete the required fields or opt in above."}</p>
                )}
              </div>
              <div className="panel-actions">
                {href ? (
                  <>
                    <Button asChild><AgentLink agent={agent} platform={platform} options={options} /></Button>
                    <Button asChild variant="outline" size="icon">
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
              {route?.note && <p className="route-note">{route.note}</p>}
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
            <div><CodeXml size={17} aria-hidden="true" /> <span>OpenInCodex.tsx</span><CopyButton value={reactExample} label="Copy code example" iconOnly /></div>
            <pre><code>{reactExample}</code></pre>
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

const reactExample = `import { AgentLink } from "agent-deeplinks/react"
import { Button } from "@/components/ui/button"

<Button asChild variant="outline">
  <AgentLink
    agent="codex"
    platform="desktop"
    options={{ prompt: "Explain this project." }}
  />
</Button>`;

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
