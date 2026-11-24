# Agent Deeplinks

Open AI agents from a website, a README, or an app. The package builds provider URLs, includes SVG brand marks, and ships a React link that works with shadcn/ui.

[Demo](https://agent-deeplinks.pages.dev/) · [Download ZIP](https://github.com/lalalune/agent-deeplinks/releases/latest/download/agent-deeplinks.zip) · [Evidence and source notes](research/README.md)

## Install

```sh
npm install https://github.com/lalalune/agent-deeplinks/releases/latest/download/agent-deeplinks.tgz
```

You can also download the ZIP from GitHub Releases and install its bundled npm tarball. The ZIP includes a static demo and the SVG files.

```sh
npm install ./agent-deeplinks-0.1.3.tgz
```

## Usage

The TypeScript API works without React.

```ts
import { agents, getAgentLink, getAgentRoute } from "agent-deeplinks"

const url = getAgentLink("cursor", "web", { prompt: "Explain this project." })
const route = getAgentRoute("cursor", "web")
console.log(url, route?.behavior, agents.cursor.name)
```

`getAgentLink(agent, platform, options)` returns a URL or `null` if the route is unavailable, its parameters are invalid, or it needs an opt-in. Platform IDs are `web`, `desktop`, `ios`, `android`, and `cli`. Call `getAgentRoute` to see the accepted fields, behavior, constraints, sources, and evidence. `agents[id].home` is a product-site fallback.

Experimental routes require `allowExperimental: true`. Routes that auto-submit require `allowSend: true`. Prompt text goes into the URL and can appear in browser history and logs. Keep credentials and private data out of shareable links.

Claude Code's iOS, Android, and HTTPS draft links support a prompt, a session `mode` of `plan` or `code`, an optional GitHub `repo` in `owner/name` format, and an optional `branch` when a repository is supplied.

For Hermes and OpenClaw, set `server` to the URL of your Webapp or Control UI when opening from another device. With no address supplied, the links use each product's localhost default. OpenCode accepts its server origin and an optional project directory.

T3 Code accepts an optional server origin on the web. Leave it unset for the hosted chooser. For a self-hosted link, pair that browser with your T3 server and let the workspace connect first.

Call `getAgentLink("openclaw", "desktop")` or choose `"ios"` to open the dashboard. Supplying a prompt opens OpenClaw's run confirmation.

Use `getHermesSkillLink("official/security/1password")` or pass a direct skill URL to open Hermes Desktop's [skill install review](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills#desktop-install-links).

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

Pushing a version tag matching `package.json` builds and attaches the ZIP and npm tarball to a GitHub release. npm registry publishing requires a publisher account.
