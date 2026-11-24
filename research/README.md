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

## Native device checks

- T3 Code Android 2.3.0 build 816 was installed from the provider's signed beta APK. The APK SHA-256 matched the official release asset, Android 15 resolved `t3code://new` as a browsable intent to T3 Code's MainActivity, and T3 Code displayed a warning that no connected environment supported starting a thread without a project. This establishes that the app handled the link. The temporary emulator repeatedly displayed Android System UI or system process “isn't responding” dialogs during direct pairing. Connected composer prefill remains unverified. [Official beta release](https://github.com/pingdotgg/t3code/releases/tag/v0.1.12-nightly.20261123.5165)

## Gemini and Perplexity from Slop Date

- **Gemini** uses `https://gemini.google.com/app?q=…` on Slop Date and in Chromium 140's starter-pack source. A fresh signed-out browser returned HTTP 200, with an empty visible composer and no observed model request containing the marker while non-read requests and WebSockets were intercepted. Current Chromium instead uses `/prompt` and a browser-supplied `X-Omnibox-Gemini` header. The older plain URL is experimental. Gemini's iOS association covers selected destinations such as Daily Brief and existing threads. A generic native prompt route remains unverified. The Android association identifies the Gemini package at the host level. [Slop Date](https://slop.date/) · [Chromium 140 template](https://chromium.googlesource.com/chromium/src/+/refs/tags/140.0.7339.81/components/search_engines/template_url_starter_pack_data.cc) · [Current Chromium test](https://chromium.googlesource.com/chromium/src/+/main/components/omnibox/browser/autocomplete_controller_unittest.cc) · [iOS association](https://gemini.google.com/.well-known/apple-app-site-association) · [Android association](https://gemini.google.com/.well-known/assetlinks.json)
- **Perplexity** publishes `https://www.perplexity.ai/search?s=o&q=…` in its OpenSearch template. Treat a prompt-bearing link as a search submission and opt in explicitly. The official iOS association matches `/search` and `/search/*`, so the same link may open the app. On Android the domain declares the app without specifying path handling. Our signed-out browser navigation to Slop Date's `/search?q=…` form redirected to `/search/new` and reached HTTP 403 with a Cloudflare verification page. Native query and browser results remain unchecked. [OpenSearch](https://www.perplexity.ai/opensearch.xml) · [iOS association](https://www.perplexity.ai/.well-known/apple-app-site-association) · [Android association](https://www.perplexity.ai/.well-known/assetlinks.json)

## Gemini for macOS installer inspection

Google's [macOS download](https://gemini.google/download/mac/) redirected to the first-party [Gemini.dmg](https://dl.google.com/release2/j33ro/release/Gemini.dmg). Its disk-image checksum passed before the read-only mount. The arm64 bundle reports identifier `com.google.GeminiMacOS`, version 1.147.6.1557, and Developer ID Application signer Google LLC (`EQHXZ8M8AV`). Full strict code-signature verification was stopped at the test time limit. Its `CFBundleURLTypes` declare `googlegemini` and `comgooglegemini`, and its activity types list `com.google.gemini.handoff`. The main app's entitlements contain no associated domains. This identifies the custom scheme registration. An externally supported blank-chat or draft route remains unverified. [Gemini desktop](https://gemini.google/desktop/)
