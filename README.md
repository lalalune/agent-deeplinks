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
npm install ./agent-deeplinks-0.1.48.tgz
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

To open an existing desktop chat in Claude, ChatGPT, or Codex, pass its conversation or local thread UUID as `session`. For Claude use the UUID from the chat URL. In ChatGPT and Codex use the ID from **Copy chat deep link**. The destination app needs access to the chat. [Claude Desktop links](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link) · [ChatGPT and Codex links](https://learn.chatgpt.com/docs/reference/commands#deep-links)

```ts
const session = "12345678-1234-4234-9234-123456789abc"
const existingChat = getAgentLink("codex", "desktop", { session })
```

Use `cloudAgent` on any Cursor target to open an existing Cloud Agent. Pass its `bc-…` ID or its Cursor URL, including team URLs. Desktop opens the agent by ID. Web and mobile keep the original team path when provided. This link is separate from a new prompt. [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints) · [Cursor desktop link](https://forum.cursor.com/t/open-by-id-url-for-the-cloud-agent/159908/7)

Use `getAgentLink("grok-build", "web")` to open the Grok Build inbox in a browser. The `ios` target hands off the inbox or an existing `bc-…` Cloud Agent to Cursor. Pass a Cloud Agent ID or its personal or team `https://grok.com/build/…` link as `cloudAgent`. The receiving app must have access to the agent. The separately installed `grok` terminal app uses `grok --resume <session-id>` for local sessions. [Grok Build links](research/other-agents.md#grok-build)

Use `task` to open an existing Codex Cloud task on `web`, `ios`, or `android`. Pass the `task_…` ID emitted by the Codex CLI or paste the HTTPS task link from ChatGPT. The app needs access to that task. A pasted link keeps its task path and discards query and fragment text. On `web`, set `browserOnly: true` to apply the iOS browser-only exclusion. [Codex Cloud access](https://help.openai.com/en/articles/20001545-using-codex-cloud) · [Codex CLI URL format](https://github.com/openai/codex/blob/3f65e9f13165d85d1b1fbe20ce06c55758f927b9/codex-rs/cloud-tasks/src/util.rs#L122-L135)

Experimental routes require `allowExperimental: true`. Routes that auto-submit require `allowSend: true`. Prompt text goes into the URL and can appear in browser history and logs. Keep credentials and private data out of shareable links.

Cursor Desktop links encode the draft for both decoders in the app. The official Cursor web handoff can turn literal plus signs into spaces in the desktop review. Choose Desktop when the exact punctuation matters. [Cursor verification](research/coding-agents.md#cursor)

Grok’s Web link opens a send review. Choosing **Cancel** leaves the prompt editable. Use the Web target for this behavior on a phone. The native iOS and Android targets are app handoffs.

Claude Code's iOS, Android, and HTTPS draft links support a prompt, a session `mode` of `plan` or `code`, an optional GitHub `repo` in `owner/name` format, and an optional `branch` when a repository is supplied.

Use `getAgentLink("claude-code", "vscode", { prompt: "Review my changes." })` to prefill a draft in the Claude Code extension for VS Code. Pass `session` to resume a session from the current workspace.

For an existing Claude Code cloud session, pass its `session_…` or `cse_…` ID as `session` on `web`, `ios`, or `android`. The link opens the existing session. Fields for a new draft cannot be combined with `session`. [Anthropic’s cloud and mobile links](https://support.claude.com/en/articles/14898120-open-the-claude-mobile-app-with-a-link)

For Claude and Claude Code web links, use `browserOnly: true` to keep the link in the browser on iOS. Leave it unset for the usual Universal Link handoff.

Claude Code Desktop accepts `folder` as an absolute local workspace path. It asks the user to confirm the folder before using it. [Claude Desktop deeplinks](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)

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

For OpenCode 2.x on the web or in an iPhone browser, supply the server origin in `server`. Add `session` to open a saved session by ID in a browser already connected to that server. On Web, `directory` alone builds the older OpenCode 1.x project URL. OpenCode Desktop accepts the local directory and an optional prompt.

```ts
getAgentLink("opencode", "web", {
  server: "https://code.example.com",
  session: "ses_example",
})
```

To pair OpenCode, pass an issued `/auth/connect/<code>` URL from `opencode pair` as `target` with `action: "server-pair"`. Web opens the one-time sign-in URL. iOS opens the native TestFlight app’s pairing flow. Android opens a native pairing review, where the user confirms the connection. The address in the link must be reachable from the opening device. [OpenCode pairing command](https://opencode.ai/docs/cli/commands#pair)

```ts
const href = getAgentLink("opencode", "android", {
  action: "server-pair",
  target: issuedPairingUrl,
})
```

`getOpenCodeAndroidPairingLink(issuedPairingUrl)` is also available. The package builds URLs locally. Opening the Web URL spends the code, so the Playground’s copyable React example uses a sample code. The iPhone route is sourced from OpenCode’s link serializer and awaits installed-app verification.

After pairing OpenCode on Android, pass `session` to open a saved session by ID on the current server. Use `mode: "new"` for a blank session or `mode: "last"` to reopen the last session. The app uses its current paired server.

```ts
getAgentLink("opencode", "android", { session: "ses_example" })
getAgentLink("opencode", "android", { mode: "new" })
getAgentLink("opencode", "android", { mode: "last" })
```

T3 Code accepts an optional server origin on the web. Leave it unset for the hosted chooser. For a self-hosted link, pair that browser with your T3 server first. The link can then open a draft directly in the paired browser.

Pass both `environment` and `session` to open an existing T3 Code thread. The Web link opens T3’s hosted chooser. Desktop, iOS, and Android use the app’s custom scheme. An optional `prompt` stages a draft. On mobile, T3 asks before replacing a different saved draft.

```ts
getAgentLink("t3-code", "web", {
  environment: "your-environment-id",
  session: "your-thread-id",
  prompt: "Review the next step.",
})
```

ZCode's web, iOS, and Android links open its versioned Remote Control sign-in page in a browser. Connecting requires the same account and region as an online desktop with Remote Control enabled. [ZCode Remote Control instructions](https://zcode.z.ai/en/docs/remote-control)

Kimi Code Desktop accepts a local `directory` and opens a fresh draft. Hosted Remote Control uses the same Kimi account as the running host. Supply `server` for another region or for a local address from `kimi web`, then enter the local server token in the browser.

Call `getAgentLink("openclaw", "desktop")` or choose `"ios"` for the dashboard URL. On macOS and iOS, supplying a prompt opens run confirmation when a Gateway is connected. The Linux 2026.11.9 AppImage opened the connected Dashboard on cold and warm launch after its first launch registered the handler. The DEB from that release opened the app and dropped the URL. Windows Hub opens its setup screen in a fresh profile. [Linux and Windows verification](research/other-agents.md#hermes-agent-and-openclaw)
For the macOS [Add Gateway form](https://docs.openclaw.ai/platforms/mac/remote#open-the-mac-app-from-a-website), supply the Gateway HTTPS base address in `server`. The address can include a port and path. The user reviews it and chooses **Connect** in OpenClaw.
On iOS, pass a Gateway origin in `server` to stage the host, port, and TLS for review. Use HTTPS or WSS for TLS. HTTP and WS are limited to local hosts. Omitted ports use 443 for TLS and 18789 for plaintext. Enter credentials in the app if prompted. [iOS Gateway review](https://github.com/openclaw/openclaw/blob/v2026.11.8/apps/ios/Sources/Onboarding/OnboardingWizardView.swift#L938-L985)
For the OpenClaw Control UI, use `web` or `android` and sign in to the Gateway in the same browser tab first. Supply its base URL in `server` on Android or for a custom web address. With a `prompt`, the link opens an unsent draft in the last selected chat. Pass a copied chat or dashboard URL in `session` to choose a specific session on that same Gateway. Normal dashboards accept an optional draft. Focused dashboards open the presentation view without a draft. Gallery links preserve `dashboard=expanded` for plain launches. Adding a draft uses the same session’s standard Dashboard, which showed the composer in both tested browsers. [OpenClaw browser link formats](https://docs.openclaw.ai/web/urls#session-and-dashboard-urls)

```ts
const gatewaySetup = getAgentLink("openclaw", "desktop", {
  server: "https://gateway.example.com/openclaw/",
})
const mobileGatewaySetup = getAgentLink("openclaw", "ios", {
  server: "https://gateway.example.com:18443",
})
const browserDraft = getAgentLink("openclaw", "web", {
  server: "https://gateway.example.com/openclaw/",
  session: "https://gateway.example.com/openclaw/chat/main",
  prompt: "Review today’s reminders.",
})
```

Use `getHermesSkillLink("official/security/1password")` or pass a direct skill URL to open Hermes Desktop's [skill install review](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills#desktop-install-links). The signed macOS canary displayed the requested skill and destination before installation. The official Linux diagnostic AppImage accepts `hermes://launch` as a command-line argument. Its first launch left the system URL handler unset.

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

## Apps and plugins

Use `getAgentActions(agent, platform)` to discover app, plugin, skill, template, and shared conversation destinations. Pass the action ID in `getAgentLink` or in the options for either `AgentLink` button variant. `getAgentRoute(agent, platform, action)` describes its accepted fields, behavior, and evidence.

```ts
import { getAgentActions, getAgentLink } from "agent-deeplinks"

const available = getAgentActions("chatgpt", "web")
const app = getAgentLink("chatgpt", "web", {
  action: "app",
  target: "plugin_asdk_app_6abadab6e7d881919e7491d52c7846e8",
  tool: "cad.browse",
  appPath: "/parts/part_joystick",
})
const draft = getAgentLink("codex", "desktop", {
  action: "plugin-chat",
  target: "openai-developers@openai-curated",
  prompt: "Find the docs for app deep links.",
})
```

The Playground includes an editable example for each action. ChatGPT app links use the named global entrypoint in Work on the web, desktop, or iOS. A Codex plugin chat link stages an unsent draft. [Apps and plugins playground](https://playground.agent-deeplinks.pages.dev/#apps) · [Provider formats and evidence](research/plugin-links.md)

Pass a ChatGPT, Claude, Grok, or Kimi share URL or its share ID as `target` with `action: "shared-chat"`. iOS links use Universal Links, and ChatGPT and Grok also support Android App Links. Android may hand some web variants to the installed app. Kimi shares open on the original regional website. Access follows the conversation's original sharing settings. [ChatGPT and Claude](research/openai-anthropic.md#shared-conversations) · [Grok](research/other-agents.md#grok-and-grok-bot)

For a shared Codex snapshot, use `getAgentLink("codex", platform, { action: "shared-chat", target })` with the snapshot URL or its `cx_…` identifier. Web, iOS, and Android open the read-only browser viewer. Shared workspace snapshots keep their original access permissions. [OpenAI snapshot guide](https://learn.chatgpt.com/docs/use-chatgpt#share-a-read-only-snapshot-of-a-codex-thread)

For ZCode, use `action: "shared-chat"` on `web`, `ios`, or `android` with a share code or URL. The link opens the signed-out browser viewer when sharing permissions allow it. A pasted China share keeps its `/cn/` path. [ZCode sharing guide](https://zcode.z.ai/en/docs/agents#sharing-a-conversation)

For Cursor, use `action: "command"` or `action: "rule"` with a filename stem as `target` and its text as `content`. The desktop link opens the review. The web link opens Cursor’s hosted preview. Cursor adds the file extension when the recipient confirms. [Cursor link reference](https://cursor.com/docs/reference/deeplinks)

In Codex and ChatGPT Desktop, use `action: "settings"`, `"skills"`, or `"automations"`. Settings accepts an optional documented section such as `connections/ssh`. Scheduled opens the task screen. Some app versions open the create form directly. [OpenAI desktop link reference](https://learn.chatgpt.com/docs/reference/commands#deep-links)

For Grok Bot, pass a shared Team Bot URL or UUID as `target` with `action: "team-bot"`. For a published template, use `action: "bot-template"` with the shared URL or its 21-character ID. Desktop uses the native URL emitted by xAI. Web and mobile use xAI’s share pages, including the optional template slug. Opening a shared Team Bot requires access, and adding a template requires a separate confirmation. [Grok Bot share links](research/plugin-links.md)

Use `action: "bot-marketplace"` on `web`, `ios`, or `android` to open the Grok Bot Marketplace. Leave `target` empty for the gallery, or pass a category such as `engineering`, a path such as `bots/projects-manager`, or the complete Marketplace URL. The template page has a separate **Import Bot** button. [Grok Bot Marketplace](https://x.ai/bot/marketplace)

To reopen an active Antigravity CLI conversation, pass its printed Remote Control URL with `action: "remote-session"` on `web`, `ios`, or `android`. The receiving browser needs the same Google account while the original CLI is still running. [Antigravity CLI Remote Control](https://antigravity.google/docs/remote-control/#enable-remote-control-in-an-active-session-remote-control)

For OpenClaw 2026.11.10 on macOS and Linux, use `plugin-install`, `skill-install`, or `template-install` with a ClawHub package name as `target`, such as `@openclaw/discord`. These links route to the item in the connected Gateway. Installation is a separate action. [OpenClaw catalog link formats and evidence](research/plugin-links.md)

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
