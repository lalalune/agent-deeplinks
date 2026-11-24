# Agent Deeplinks

Open AI agents from a website, a README, or an app. The package builds provider URLs, includes SVG brand marks, and ships a React link that works with shadcn/ui.

[Playground](https://playground.agent-deeplinks.pages.dev/) · [Download ZIP](https://github.com/lalalune/agent-deeplinks/releases/latest/download/agent-deeplinks.zip) · [Evidence and source notes](research/README.md)

## Install

```sh
npm install agent-deeplinks
```

You can also install the tarball directly from GitHub Releases.

```sh
npm install https://github.com/lalalune/agent-deeplinks/releases/latest/download/agent-deeplinks.tgz
```

On npm 12, add `--allow-remote=root` when installing the tarball URL. [npm 12 install defaults](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)

You can also download the ZIP from GitHub Releases and install its bundled npm tarball. The ZIP includes a static demo and the SVG files.

```sh
npm install ./agent-deeplinks-0.1.26.tgz
```

## Usage

The TypeScript API works without React.

```ts
import { agents, getAgentLink, getAgentRoute } from "agent-deeplinks"

const url = getAgentLink("cursor", "web", { prompt: "Explain this project." })
const route = getAgentRoute("cursor", "web")
console.log(url, route?.behavior, agents.cursor.name)
```

`getAgentLink(agent, platform, options)` returns a URL or `null` if the route is unavailable, its parameters are invalid, or it needs an opt-in. Platform IDs are `web`, `desktop`, `ios`, `android`, `cli`, and `vscode`. Call `getAgentRoute` to see the accepted fields, behavior, constraints, sources, and evidence. `agents[id].home` is a product-site fallback.

Experimental routes require `allowExperimental: true`. Routes that auto-submit require `allowSend: true`. Prompt text goes into the URL and can appear in browser history and logs. Keep credentials and private data out of shareable links.

Cursor Desktop links encode the draft for both decoders in the app. The official Cursor web handoff can turn literal plus signs into spaces in the desktop review. Choose Desktop when the exact punctuation matters. [Cursor verification](research/coding-agents.md#cursor)

Claude Code's iOS, Android, and HTTPS draft links support a prompt, a session `mode` of `plan` or `code`, an optional GitHub `repo` in `owner/name` format, and an optional `branch` when a repository is supplied.

Use `getAgentLink("claude-code", "vscode", { prompt: "Review my changes." })` to prefill a draft in the Claude Code extension for VS Code. Pass `session` to resume a session from the current workspace.

For Claude and Claude Code web links, use `browserOnly: true` to keep the link in the browser on iOS. Leave it unset for the usual Universal Link handoff.

Claude Code Desktop also accepts `sshHost` with optional `sshPort` and `sshFolder`. Claude shows the target for review before use and keeps the prompt as an editable draft. This requires Desktop v2.110.0 or later and a signed-in account. [SSH deeplinks](https://code.claude.com/docs/en/desktop#open-an-ssh-session-from-a-link)

```ts
const remoteDraft = getAgentLink("claude-code", "desktop", {
  sshHost: "dev@build.example.com",
  sshPort: "2222",
  sshFolder: "~/project",
  prompt: "Review the build logs.",
})
```

GitHub Copilot Desktop can open a draft with a prompt, an `owner/repo` repository, or a custom agent. The Web option wraps draft links in GitHub’s hosted launcher. Choose `vscode` to open the VS Code Agents window with a prompt and an optional `workspace` folder URI.

```ts
const copilot = getAgentLink("github-copilot", "web", {
  prompt: "Explain how this project runs its tests.",
  repo: "owner/repo",
  mode: "interactive",
})
```

Codex desktop links can carry both an absolute `path` and an `originUrl`. The desktop app tries the local path first and then matches the remote if the path does not resolve to a directory.

For Hermes and OpenClaw, set `server` to the URL of your Webapp or Control UI when opening from another device. With no address supplied, the Web links use each product's localhost default. In a fresh local browser tab, Hermes shows how to sign in with the host's `hermes webapp` command. Hermes on iOS and Android requires your configured Web Access address.

For OpenCode 2.x on the web or in an iPhone browser, supply the server origin in `server` and select your project after sign-in. The Web route's optional `directory` parameter builds the older OpenCode 1.x project URL. OpenCode Desktop accepts the local directory and an optional prompt.

For Android, pass a one-time `/auth/connect/<code>` URL from [`opencode pair`](https://opencode.ai/docs/cli/commands#pair) to `getOpenCodeAndroidPairingLink`. It builds a custom-scheme link to the native pairing review without fetching the one-time URL. The user confirms the connection in OpenCode. The server address in the issued URL must be reachable from the phone.

```ts
import { getOpenCodeAndroidPairingLink } from "agent-deeplinks"

const href = getOpenCodeAndroidPairingLink(issuedPairingUrl)
```

T3 Code accepts an optional server origin on the web. Leave it unset for the hosted chooser. For a self-hosted link, pair that browser with your T3 server first. The link can then open a draft directly in the paired browser.

ZCode's web, iOS, and Android links open its versioned Remote Control sign-in page in a browser. Connecting requires the same account and region as an online desktop with Remote Control enabled. [ZCode Remote Control instructions](https://zcode.z.ai/en/docs/remote-control)

Kimi Code Desktop accepts a local `directory` and opens a fresh draft. Hosted Remote Control uses the same Kimi account as the running host. Supply `server` for another region or for a local address from `kimi web`, then enter the local server token in the browser.

Call `getAgentLink("openclaw", "desktop")` or choose `"ios"` to open the dashboard. With a connected Gateway, supplying a prompt opens OpenClaw's run confirmation.
On Android, pass the configured Gateway address in `server` to open its Control UI in a browser.

Use `getHermesSkillLink("official/security/1password")` or pass a direct skill URL to open Hermes Desktop's [skill install review](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills#desktop-install-links). The signed macOS canary displayed the requested skill and destination before installation.

### shadcn/ui

For your existing [shadcn/ui Button](https://ui.shadcn.com/docs/components/radix/button), use `asChild` to keep a regular anchor and keyboard navigation.

```tsx
import { Button } from "@/components/ui/button"
import { AgentLink } from "agent-deeplinks/react"

const options = { prompt: "Explain this project." }

export function OpenInCodex() {
  return (
    <>
      <Button asChild variant="outline">
        <AgentLink agent="codex" platform="desktop" options={options} />
      </Button>
      <Button asChild variant="outline" size="icon">
        <AgentLink agent="codex" platform="desktop" options={options} iconOnly />
      </Button>
    </>
  )
}
```

Check `getAgentLink` before showing a button if you offer dynamic agent and platform choices. `AgentLink` renders nothing for invalid or unavailable links. Supply `aria-label` to customize the default accessible name of an icon-only link. The demo also shows a product-site fallback for unavailable routes.

Use `getAgentIcon(id)` for an SVG data URL, `AgentIcon` from the React entry point, or import a standalone SVG with a bundler that supports SVG assets.

```ts
import cursorIcon from "agent-deeplinks/icons/cursor.svg"
```

See [SVG sources and trademark notes](icons/README.md).

## Develop and deploy

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
npm run release:zip
```

The npm package builds into `dist/` and the static site builds into `site/dist/`. Point a Cloudflare Pages Git project at the repository with build command `npm run build:site` and output directory `site/dist`. For a Direct Upload project, build locally and run `npx wrangler pages deploy site/dist --project-name agent-deeplinks`.

Pushing a version tag matching `package.json` builds and attaches the ZIP and npm tarball to a GitHub release.

### Publish to npm

Matching version tags run the package checks and publish the tarball through GitHub Actions using npm trusted publishing. The registry publisher is `lalalune/agent-deeplinks` and `npm-publish.yml`. [npm trusted publishing setup](https://docs.npmjs.com/trusted-publishers/)
