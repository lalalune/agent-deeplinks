# Deep link research

Investigation started November 24, 2026. The [package catalog](../src/catalog.ts) records a route's accepted fields, behavior, source URLs, and evidence. Each report below records what actually reached an app and which checks remain.

- [ChatGPT, Codex, Claude, and Claude Code](openai-anthropic.md)
- [Cursor, Antigravity, T3 Code, OpenCode, and ZCode](coding-agents.md)
- [Grok, Grok Bot, Meta Muse, Kimi, Hermes Agent, and OpenClaw](other-agents.md)
- [SVG source and trademark information](../icons/README.md)

## Reference integrations

- [Slop Cash](https://slop.cash/) published Cursor's HTTPS handoff, Claude's `/new?q=`, ChatGPT and Grok's `?q=`, Meta AI's `?prompt=`, OpenClaw's `openclaw://agent?message=`, and Hermes' `hermes://skill/install?identifier=` in its [shipped app bundle](https://slop.cash/assets/App-Dm7mYddy.js). The Hermes button passes a skill URL. The links sit next to a copyable prompt, so a working flow on the site does not prove that a target processes its query parameter.
- [Slop Date](https://slop.date/) published those Cursor, Claude, ChatGPT, Grok, OpenClaw, and Hermes forms in its page HTML. It also lists Gemini and Perplexity links.
- [Vibestack](https://vibestack.fun/) published desktop links for Codex, Claude Code, Grok Bot, and Cursor, and the same Meta Muse HTTPS route in its [shipped bundle](https://vibestack.fun/assets/index-zW0Je-nk.js).
- The [Flavio Copes deep links glossary](https://flaviocopes.com/ai-glossary/deep-links/) indexed Cursor, Claude Code, and Codex on November 3. xAI subsequently documented Grok Bot deeplinks on November 19.

## Evidence levels

| Level | What it records |
| --- | --- |
| Verified | A client showed the documented outcome with an inert sample on the platform and version recorded in the report. |
| Documented | The provider documents this route and its behavior. |
| In source | First-party code, a shipped app asset, or a client association defines the route. |
| Observed | A published integration emits the route, or a limited runtime probe found it. Prompt behavior can still require confirmation. |

An HTTP success confirms a front door. Scheme registration confirms an installed handler. Neither confirms that a composer consumed a prompt. Use the notes for any platform, account, install, or setup requirements.

## Published playground checks

The v0.1.7 and v0.1.8 Cloudflare deployments generated all 59 catalog routes in Chromium 158, Firefox 159, and WebKit 27.2. Each matrix entry produced the exact URL in both shadcn/ui buttons, and all 18 SVGs decoded. The checks also confirmed that flagged links stayed disabled until opt-in and that the page fit a 375px viewport. Provider links were left unopened during these browser checks.

The v0.1.9 production deployment passed the same checks for all 63 routes in Chromium 158, Firefox 159, and WebKit 27.2. An empty npm project installed the public release tarball and loaded the core API, React entry point, and 18 standalone SVG exports. The ZIP contains the same tarball and the same demo JavaScript as production. [Production playground](https://agent-deeplinks.pages.dev/) · [v0.1.9 release](https://github.com/lalalune/agent-deeplinks/releases/tag/v0.1.9)

The v0.1.10 release passed the full browser matrix for 66 routes in all three engines. Its OpenCode regression check also confirmed that a desktop directory does not carry over to the Web link. A fresh project installed the public tarball and checked all 18 SVG exports, the React entry point, and the current and legacy OpenCode URL forms. The ZIP and production demo JavaScript matched byte for byte. [Production playground](https://agent-deeplinks.pages.dev/) · [v0.1.10 release](https://github.com/lalalune/agent-deeplinks/releases/tag/v0.1.10)

The v0.1.11 release passed the same cross-browser matrix for 67 routes, including the new OpenClaw Android browser launch with a caller-configured Gateway address. A clean install loaded the package, React entry point, and 18 SVG exports. The public ZIP contains the exact npm tarball and Cloudflare demo JavaScript. [Production playground](https://agent-deeplinks.pages.dev/) · [v0.1.11 release](https://github.com/lalalune/agent-deeplinks/releases/tag/v0.1.11)

The v0.1.12 release passed all 67 Playground entries in Chromium 158, Firefox 159, and WebKit 27.2. The standalone install, SVG exports, and ZIP-to-production JavaScript comparison passed. The catalog incorporates the new Windows and Ubuntu desktop evidence. [v0.1.12 release](https://github.com/lalalune/agent-deeplinks/releases/tag/v0.1.12) · [Native results](coding-agents.md)

The v0.1.13 release passed the full Playground matrix for 71 routes and 19 SVGs in all three engines. A fresh install loaded the React entry point and matched the official Kimi Code SVG hash. The ZIP's tarball and demo JavaScript matched the public release and the production assets on both domains. [Production Playground](https://deeplinks.fun/) · [Pages endpoint](https://agent-deeplinks.pages.dev/) · [v0.1.13 release](https://github.com/lalalune/agent-deeplinks/releases/tag/v0.1.13)

The v0.1.14 preview passed all 71 Playground routes and 19 SVGs in Chromium 158, Firefox 159, and WebKit 27.2, including the required opt-ins and the 375px layout. Both Cloudflare domains served the same verified build at release time. A fresh install from GitHub rendered both React button variants, and the ZIP contains the exact published tarball and production JavaScript. [v0.1.14 release](https://github.com/lalalune/agent-deeplinks/releases/tag/v0.1.14) · [Release build](https://github.com/lalalune/agent-deeplinks/actions/runs/45448590930)

The v0.1.15 preview passed the same 71-route matrix in Chromium 158, Firefox 159, and WebKit 27.2. The dedicated Playground alias serves the same JavaScript as the ZIP's static demo. The ZIP, GitHub release, and npm registry contain the same tarball. A fresh `npm install agent-deeplinks` rendered both React button variants and loaded all 19 SVG exports. `npm audit signatures` reported no missing or invalid signatures or attestations. [Playground](https://playground.agent-deeplinks.pages.dev/) · [Pinned deployment](https://f211bf35.agent-deeplinks.pages.dev/) · [v0.1.15 release](https://github.com/lalalune/agent-deeplinks/releases/tag/v0.1.15) · [Trusted npm publish](https://github.com/lalalune/agent-deeplinks/actions/runs/45451312225)

## Native device checks

- T3 Code's signed Android 2.3.0 beta displayed the exact unsent draft on Android 16 after pairing to a connected environment. [Test details](coding-agents.md#t3-code)
- T3 Code's iOS 2.3.0 Release build displayed the exact unsent multiline Unicode draft on an iPhone 17 simulator with iOS 26.4 after pairing to a loopback environment. [Test details](coding-agents.md#t3-code)

## Gemini and Perplexity from Slop Date

- **Gemini** uses `https://gemini.google.com/app?q=…` on Slop Date and in Chromium 140's starter-pack source. A fresh signed-out browser returned HTTP 200, with an empty visible composer and no observed model request containing the marker while non-read requests and WebSockets were intercepted. Current Chromium instead uses `/prompt` and a browser-supplied `X-Omnibox-Gemini` header. The older plain URL is experimental. A generic native prompt route remains unverified. [Slop Date](https://slop.date/) · [Chromium 140 template](https://chromium.googlesource.com/chromium/src/+/refs/tags/140.0.7339.81/components/search_engines/template_url_starter_pack_data.cc) · [Current Chromium test](https://chromium.googlesource.com/chromium/src/+/main/components/omnibox/browser/autocomplete_controller_unittest.cc)
- **Gemini mobile** associates `/app/download/ios` with the production iOS app and redirects an iPhone browser to the official App Store listing. On an Android tablet with the Google-signed Gemini 1.0.995038376 installed, the production certificate matched the host's Digital Asset Links fingerprint, `gemini.google.com` was verified, and the package manager matched `/gemini/download/mobile` to `BardEntryPointActivity`, the same activity as the app launcher. The default resolver returned a chooser. The Android browser fallback redirected to Google Play. No app launch or prompt submission was attempted on the tablet. [iOS handoff](https://gemini.google.com/app/download/ios) · [Android handoff](https://gemini.google.com/gemini/download/mobile) · [iOS association](https://gemini.google.com/.well-known/apple-app-site-association) · [Android association](https://gemini.google.com/.well-known/assetlinks.json)
- **Perplexity** publishes `https://www.perplexity.ai/search?s=o&q=…` in its OpenSearch template. Treat a prompt-bearing link as a search submission and opt in explicitly. The official iOS association matches `/search` and `/search/*`, so the same link may open the app. On Android the domain declares the app without specifying path handling. In fresh signed-out sessions, both Slop Date's URL and the exact package-generated OpenSearch form redirected to `/search/new` in Chromium and reached a Cloudflare HTTP 403 challenge. The exact route returned HTTP 200 in WebKit after the same redirect. The marker appeared in neither browser. Signed-in results and native query handling remain unchecked. [OpenSearch](https://www.perplexity.ai/opensearch.xml) · [iOS association](https://www.perplexity.ai/.well-known/apple-app-site-association) · [Android association](https://www.perplexity.ai/.well-known/assetlinks.json)

## Gemini for macOS installer inspection

Google's [macOS download](https://gemini.google/download/mac/) redirected to the first-party [Gemini.dmg](https://dl.google.com/release2/j33ro/release/Gemini.dmg). Its disk-image checksum passed before the read-only mount. The arm64 bundle reports identifier `com.google.GeminiMacOS`, version 1.147.6.1557, and Developer ID Application signer Google LLC (`EQHXZ8M8AV`). Full strict code-signature verification was stopped at the test time limit. Its `CFBundleURLTypes` declare `googlegemini` and `comgooglegemini`, and its activity types list `com.google.gemini.handoff`. The main app's entitlements contain no associated domains. This identifies the custom scheme registration. An externally supported blank-chat or draft route remains unverified. [Gemini desktop](https://gemini.google/desktop/)
