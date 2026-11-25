import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { agents, getAgentActions, getAgentIcon, getAgentLink, getAgentRoute, getHermesSkillLink, getOpenCodeAndroidPairingLink, platforms } from "../dist/index.js";

import { AgentLink } from "../dist/react.js";

const special = "Keep A&B + café/🎉?\nNew line.";

test("opens an OpenCode pairing review from an issued connect link", () => {
  const source = "http://10.0.2.2:18443/auth/connect/qa_Code-123";
  assert.equal(getOpenCodeAndroidPairingLink(source), "opencode://pair?code=qa_Code-123&url=http%3A%2F%2F10.0.2.2%3A18443");
  const ipv6 = new URL(getOpenCodeAndroidPairingLink("https://[2001:db8::1]:8443/auth/connect/abc"));
  assert.equal(ipv6.searchParams.get("url"), "https://[2001:db8::1]:8443");
  assert.equal(getAgentLink("opencode", "android"), "opencode://");
  for (const invalid of [
    "https://example.com/auth/connect/",
    "https://example.com/auth/connect/a%2Fb",
    "https://example.com/auth/connect/abc=",
    "https://example.com/auth/connect/abc?",
    "https://example.com/auth/connect/abc#fragment",
    "https://example.com/auth/Connect/abc",
    "https://user:password@example.com/auth/connect/abc",
    "https://example.com:0/auth/connect/abc",
    "https://example.com:65536/auth/connect/abc",
    "https://example.com/prefix/../auth/connect/abc",
    "opencode://auth/connect/abc",
  ]) assert.equal(getOpenCodeAndroidPairingLink(invalid), null, invalid);
});

test("encodes and round trips special characters without changing the route", () => {
  const href = getAgentLink("codex", "desktop", { prompt: special });
  assert.equal(href, `codex://new?prompt=${encodeURIComponent(special)}`);
  assert.equal(new URL(href).searchParams.get("prompt"), special);
  assert.equal(getAgentLink("codex", "desktop"), "codex://threads/new");
  assert.doesNotThrow(() => getAgentLink("codex", "desktop", { prompt: "\udfff" }));
});

test("encodes provider-specific field names and honors local workspace precedence", () => {
  assert.equal(
    getAgentLink("claude-code", "cli", { prompt: special, cwd: "/local/path with space", repo: "owner/repo" }),
    `claude-cli://open?q=${encodeURIComponent(special)}&cwd=%2Flocal%2Fpath%20with%20space`,
  );
  assert.equal(
    getAgentLink("codex", "desktop", { path: "C:\\Dev\\repo", originUrl: "https://example.com/a/b.git" }),
    "codex://new?path=C%3A%5CDev%5Crepo&originUrl=https%3A%2F%2Fexample.com%2Fa%2Fb.git",
  );
  assert.equal(
    getAgentLink("claude-code", "desktop", { prompt: special, folder: "/tmp/Claude Code review + & café" }),
    `claude://code/new?q=${encodeURIComponent(special)}&folder=%2Ftmp%2FClaude%20Code%20review%20%2B%20%26%20caf%C3%A9`,
  );
  assert.equal(getAgentLink("claude-code", "cli", { cwd: "//host/share" }), null);
  assert.equal(getAgentLink("claude-code", "cli", { cwd: "/repo/../other" }), null);
  assert.equal(getAgentLink("claude-code", "cli", { repo: "owner/extra/repo" }), null);
  assert.equal(getAgentLink("opencode", "desktop", { prompt: special }), null);
  assert.equal(
    getAgentLink("zcode", "desktop", { directory: "/local/path with space" }),
    "zcode://workspace/open?path=%2Flocal%2Fpath%20with%20space",
  );
  assert.equal(getAgentLink("zcode", "desktop"), null);
  assert.equal(getAgentLink("hermes", "desktop", { prompt: special }), null);
});

test("preserves Cursor prompt text through both desktop decoders", () => {
  const prompt = "Review C++ &case=literal and %2F with café ☃.\nSecond line.";
  const native = "cursor://anysphere.cursor-deeplink/prompt?text=";
  const web = "https://cursor.com/link/prompt?text=";
  const encoded = encodeURIComponent(prompt);
  const desktop = getAgentLink("cursor", "desktop", { prompt });
  assert.equal(desktop, `${native}${encodeURIComponent(encoded)}`);
  const afterDispatch = new URLSearchParams(decodeURIComponent(new URL(desktop).search.slice(1)));
  assert.equal(afterDispatch.get("text"), prompt);
  assert.equal(getAgentLink("cursor", "web", { prompt }), `${web}${encoded}`);
  assert.equal(getAgentLink("cursor", "desktop", { prompt: "x".repeat(10_000 - native.length) }).length, 10_000);
  assert.equal(getAgentLink("cursor", "desktop", { prompt: "+".repeat(2_000) }), null);
});

test("opens Claude Code Desktop’s SSH session review", () => {
  const base = "claude://code/new";
  const sshHost = "dev@build.example.com";
  const sshFolder = "~/QA café + & code";
  assert.equal(getAgentLink("claude-code", "desktop", { sshHost }), `${base}?ssh_host=dev%40build.example.com`);
  assert.equal(
    getAgentLink("claude-code", "desktop", { prompt: special, sshHost, sshPort: "2222", sshFolder }),
    `${base}?q=${encodeURIComponent(special)}&ssh_host=dev%40build.example.com&ssh_port=2222&ssh_folder=${encodeURIComponent(sshFolder)}`,
  );
  assert.equal(
    getAgentLink("claude-code", "desktop", { sshHost: "dev@::1", sshPort: "65535", sshFolder: "~" }),
    `${base}?ssh_host=dev%40%3A%3A1&ssh_port=65535&ssh_folder=~`,
  );
  for (const options of [
    { sshPort: "2222" }, { sshFolder }, { sshHost, folder: "/tmp/work" },
    { sshHost: "-dev@build.example.com" }, { sshHost: "dev@@build.example.com" },
    { sshHost: "1e2" }, { sshHost: "build.example.com\n" },
    { sshHost: "build.example.com:2222", sshPort: "22" },
    ...["0", "022", "65536", "2e2"].map((sshPort) => ({ sshHost, sshPort })),
    ...["project", "//srv/project", "~someone/work", "~/../private", "~/quote'", "~/line\nbreak"].map((sshFolder) => ({ sshHost, sshFolder })),
  ]) {
    assert.equal(getAgentLink("claude-code", "desktop", options), null, JSON.stringify(options));
  }
  for (const platform of ["web", "ios", "android", "cli", "vscode"]) {
    assert.equal(getAgentLink("claude-code", platform, { sshHost }), null);
  }
});

test("returns null for undiscovered routes and handles documented size limits", () => {
  assert.equal(getAgentLink("hermes", "ios"), null);
  for (const platform of ["ios", "android"]) {
    assert.equal(getAgentLink("antigravity", platform), "https://antigravity.google.com/");
    assert.equal(getAgentLink("antigravity", platform, { prompt: special }), null);
  }
  assert.equal(getAgentLink("cursor", "android"), "https://cursor.com/agents");
  assert.equal(getAgentLink("cursor", "android", { prompt: special }), null);
  assert.equal(getAgentLink("cursor", "web"), "https://cursor.com/agents");
  const cursorBase = "https://cursor.com/link/prompt?text=";
  assert.equal(getAgentLink("cursor", "web", { prompt: "x".repeat(10_000 - cursorBase.length) }).length, 10_000);
  assert.equal(getAgentLink("cursor", "web", { prompt: "é".repeat(2_000) }), null);
  assert.equal(getAgentLink("claude-code", "cli", { prompt: "a".repeat(5_001) }), null);
  assert.equal(getAgentLink("t3-code", "desktop", { prompt: "hi", model: "model" }), null);
  assert.equal(getAgentLink("openclaw", "ios", { prompt: "🧪".repeat(241) }), null);
  assert.ok(getAgentLink("openclaw", "ios", { prompt: "🧪".repeat(240) }));
});

test("preserves draft safeguards and encodes self-hosted OpenCode workspace paths", () => {
  const chat = new URL(getAgentLink("chatgpt", "web", { prompt: special }));
  assert.equal(chat.searchParams.get("q"), special);
  assert.equal(chat.searchParams.get("disable_auto_send"), "1");
  assert.equal(chat.searchParams.get("no_universal_links"), "1");
  assert.equal(new URL(getAgentLink("chatgpt", "desktop")).searchParams.get("mode"), "chat");

  assert.equal(getAgentLink("grok", "android"), "https://grok.com/");
  assert.equal(getAgentLink("grok", "web"), "https://grok.com/?stay_in_browser=true");
  const grok = getAgentLink("grok", "web", { prompt: special });
  assert.equal(grok, `https://grok.com/?q=${encodeURIComponent(special)}&stay_in_browser=true`);
  assert.equal(getAgentRoute("grok", "web").behavior, "confirm");
  assert.equal(getAgentLink("grok", "web", { prompt: special, allowExperimental: true }), grok);
  for (const platform of ["ios", "android"]) {
    assert.equal(getAgentLink("grok", platform, { prompt: special }), null);
  }

  const directory = "/tmp/me & café";
  const server = "http://localhost:4096";
  const openCode = new URL(getAgentLink("opencode", "web", { server, directory }));
  assert.equal(openCode.origin, server);
  assert.equal(openCode.pathname, `/${Buffer.from(directory).toString("base64url")}/session`);
  assert.equal(openCode.search, "");
  assert.equal(getAgentLink("opencode", "web", { server, directory, prompt: special }), null);
  assert.equal(getAgentLink("opencode", "web", { server }), server);
  assert.equal(getAgentLink("opencode", "web", { server: "http://example.com", directory }), null);
  assert.equal(getAgentLink("opencode", "web", { server: "https://user:password@example.com", directory }), null);
});

test("every catalog route builds a parseable URL with its required fields", () => {
  const sample = {
    prompt: special,
    directory: "/local/project",
    server: "https://opencode.example",
    allowExperimental: true,
    allowSend: true,
  };
  for (const entry of Object.values(agents)) {
    assert.equal(new URL(entry.home).protocol, "https:");
    assert.match(getAgentIcon(entry.id), /^data:image\/svg\+xml,/u, entry.id);
    for (const platform of platforms) {
      const route = getAgentRoute(entry.id, platform);
      if (!route) continue;
      const options = Object.fromEntries(Object.entries(sample).filter(([field]) =>
        field.startsWith("allow") ||
        (Object.hasOwn(route.fields ?? {}, field) && (field !== "server" || route.url.startsWith("http")))));
      const href = getAgentLink(entry.id, platform, options);
      assert.ok(href, `${entry.id}/${platform}`);
      assert.equal(new URL(href).protocol, new URL(options.server ?? route.url).protocol);
      for (const source of route.sources) assert.equal(new URL(source).protocol, "https:");
      if (route.experimental || route.behavior === "send") {
        assert.equal(getAgentLink(entry.id, platform, { ...options, allowExperimental: false, allowSend: false }), null);
      }
    }
  }
});

test("opens configured self-hosted Web apps from another device", () => {
  assert.equal(getAgentLink("hermes", "web"), "http://127.0.0.1:9120/");
  assert.equal(getAgentLink("hermes", "web", { server: "http://192.168.1.20:9120" }), "http://192.168.1.20:9120/");
  assert.equal(getAgentLink("openclaw", "web", { server: "https://gateway.example/openclaw/" }), "https://gateway.example/openclaw/");
  assert.equal(getAgentLink("openclaw", "web", { server: "https://gateway.example/?token=private" }), null);
  assert.equal(getAgentLink("openclaw", "android"), null);
  assert.equal(getAgentLink("openclaw", "android", { server: "https://gateway.example/openclaw/" }), "https://gateway.example/openclaw/");
  assert.equal(
    getAgentLink("openclaw", "android", { server: "https://gateway.example/openclaw/", prompt: special }),
    `https://gateway.example/openclaw/chat?draft=${encodeURIComponent(special)}`,
  );
  assert.equal(getAgentLink("openclaw", "android", { server: "https://gateway.example/?token=private" }), null);
  assert.equal(getAgentLink("hermes", "web", { server: "javascript:alert(1)" }), null);
  for (const platform of ["ios", "android"]) {
    assert.equal(getAgentLink("hermes", platform), null);
    assert.equal(getAgentLink("hermes", platform, { server: "https://home.example/hermes/" }), "https://home.example/hermes/");
    assert.equal(getAgentLink("hermes", platform, { server: "https://home.example/hermes/?token=private" }), null);
  }
  assert.equal(getAgentLink("opencode", "ios"), null);
  assert.equal(getAgentLink("opencode", "ios", { server: "https://open.example/" }), "https://open.example");
  assert.equal(getAgentLink("opencode", "ios", { server: "https://open.example/", directory: "/tmp/project" }), null);
});

test("builds T3 Code hosted and previously paired self-hosted Web drafts", () => {
  const hosted = new URL(getAgentLink("t3-code", "web", { prompt: special }));
  assert.equal(hosted.origin, "https://app.t3.codes");
  assert.equal(hosted.pathname, "/new");
  assert.equal(hosted.searchParams.get("prompt"), special);
  const server = "http://127.0.0.1:43943";
  const loopback = new URL(getAgentLink("t3-code", "web", { prompt: special, server, repo: "owner/project" }));
  assert.equal(loopback.origin, server);
  assert.equal(loopback.pathname, "/new");
  assert.equal(loopback.searchParams.get("prompt"), special);
  assert.equal(loopback.searchParams.get("repo"), "owner/project");
  assert.equal(getAgentLink("t3-code", "web", { prompt: special, server: "https://t3.example/base" }), null);
  assert.equal(getAgentRoute("t3-code", "web").serverBehavior, "draft");
});

test("builds T3 Code links to a thread with exact scoped ID encoding", () => {
  const environment = "env.1";
  const session = "thread:delegated/mcp%3A1.";
  const path = "env%2E1/thread%3Adelegated%2Fmcp%253A1%2E";
  const prompt = "Review + & café ✓";
  for (const platform of ["web", "desktop", "ios", "android"]) {
    const base = platform === "web" ? "https://app.t3.codes/threads" : "t3code://threads";
    assert.equal(getAgentLink("t3-code", platform, { environment, session }), `${base}/${path}`);
    assert.equal(getAgentLink("t3-code", platform, { environment, session, prompt: "  " }), `${base}/${path}`);
    assert.equal(getAgentLink("t3-code", platform, { environment, session, prompt }),
      `${base}/${path}?prompt=${encodeURIComponent(prompt)}`);
  }
  assert.equal(getAgentLink("t3-code", "web", { environment, prompt }), null);
  assert.equal(getAgentLink("t3-code", "android", { session, prompt }), null);
  assert.equal(getAgentLink("t3-code", "web", { environment, session, server: "https://t3.example/" }), null);
  assert.equal(getAgentLink("t3-code", "desktop", { environment, session, repo: "example/workspace" }), null);
  assert.equal(getAgentLink("t3-code", "android", { environment, session, prompt: "a".repeat(8001) }), null);
  for (const invalid of [".", "..", " \n", "env\u0000id", "\ud800"]) {
    assert.equal(getAgentLink("t3-code", "web", { environment: invalid, session }), null, invalid);
    assert.equal(getAgentLink("t3-code", "ios", { environment, session: invalid }), null, invalid);
  }
});

test("requires opt-in before opening web links with submission or unknown behavior", () => {
  assert.equal(getAgentLink("perplexity", "web"), "https://www.perplexity.ai/");
  for (const platform of ["web", "ios"]) {
    assert.equal(getAgentLink("perplexity", platform, { prompt: special }), null);
    const link = new URL(getAgentLink("perplexity", platform, { prompt: special, allowSend: true }));
    assert.equal(link.pathname, "/search");
    assert.equal(link.searchParams.get("s"), "o");
    assert.equal(link.searchParams.get("q"), special);
  }
  assert.equal(getAgentLink("gemini", "web"), "https://gemini.google.com/app");
  assert.equal(getAgentLink("gemini", "web", { prompt: special }), null);
  assert.equal(new URL(getAgentLink("gemini", "web", { prompt: special, allowExperimental: true })).searchParams.get("q"), special);
  assert.equal(getAgentLink("gemini", "ios"), "https://gemini.google.com/app/download/ios");
  assert.equal(getAgentLink("gemini", "android"), "https://gemini.google.com/gemini/download/mobile");
  assert.equal(getAgentLink("gemini", "android", { prompt: special, allowExperimental: true }), null);
  for (const platform of ["ios", "android"]) {
    assert.equal(getAgentLink("kimi", platform), "https://kimi.onelink.me/BZg1/");
    assert.equal(getAgentLink("kimi", platform, { prompt: special }), null);
  }
  const kimi = new URL(getAgentLink("kimi", "android", { prompt: special, allowExperimental: true }));
  assert.equal(kimi.protocol, "kimi:");
  assert.equal(kimi.hostname, "page");
  assert.equal(kimi.pathname, "/chat");
  assert.equal(kimi.searchParams.get("prompt"), special);
  assert.equal(kimi.searchParams.get("create_new"), "true");
  assert.equal(kimi.searchParams.get("auto_send"), "false");
  assert.equal(getAgentLink("meta-muse", "web"), "https://muse.ai/chat?nr=1");
  assert.equal(getAgentLink("meta-muse", "web", { prompt: special }), null);
  assert.equal(getAgentLink("meta-muse", "ios"), "https://applink.muse.ai/");
  assert.equal(getAgentLink("meta-muse", "android"), "https://play.google.com/store/apps/details?id=com.facebook.aura");
  assert.equal(getAgentLink("claude", "android"), "https://play.google.com/store/apps/details?id=com.anthropic.claude");
  for (const platform of ["ios", "android"]) {
    assert.equal(getAgentLink("codex", platform), "https://chatgpt.com/app/codex");
    assert.equal(getAgentLink("codex", platform, { prompt: special }), null);
  }
  assert.equal(getAgentLink("opencode", "desktop"), "opencode://");
  assert.equal(getAgentLink("opencode", "android"), "opencode://");
  assert.equal(getAgentLink("opencode", "android", { prompt: special }), null);
  const openCodeDraft = new URL(getAgentLink("opencode", "desktop", { directory: "/tmp/project", prompt: special }));
  assert.equal(openCodeDraft.searchParams.get("directory"), "/tmp/project");
  assert.equal(openCodeDraft.searchParams.get("prompt"), special);
});

test("opens an exact, new, or last OpenCode session on the current paired Android server", () => {
  const session = "ses_def5b4057ffeE4y13yx0KVfUlG";
  assert.equal(getAgentLink("opencode", "android"), "opencode://");
  assert.equal(getAgentLink("opencode", "android", { session }), `opencode://session/${session}`);
  assert.equal(getAgentLink("opencode", "android", { mode: "new" }), "opencode://new-session");
  assert.equal(getAgentLink("opencode", "android", { mode: "last" }), "opencode://last-session");
  assert.equal(getAgentLink("opencode", "android", { session, mode: "new" }), null);
  assert.equal(getAgentLink("opencode", "android", { mode: "something-else" }), null);
  assert.equal(getAgentLink("opencode", "android", { session, server: "https://agent.example/" }), null);
  for (const badSession of ["not_a_session", "../last", "ses_x?server=wrong", "ses_x%2Ftail", "x y", "ses_x\n", "\n", "ses_K"]) {
    assert.equal(getAgentLink("opencode", "android", { session: badSession }), null, badSession);
  }
});

test("builds documented Claude Code mobile drafts and their HTTPS equivalents", () => {
  const options = { prompt: special, mode: "plan", repo: "owner/repo", branch: "feature/café" };
  const ios = new URL(getAgentLink("claude-code", "ios", options));
  assert.equal(ios.protocol, "claude:");
  assert.equal(ios.hostname, "code");
  assert.equal(ios.pathname, "/new");
  assert.deepEqual(Object.fromEntries(ios.searchParams), {
    q: special, mode: options.mode, repo: options.repo, branch: options.branch,
  });
  assert.equal(getAgentLink("claude-code", "android", options), ios.href);
  const web = new URL(getAgentLink("claude-code", "web", options));
  assert.equal(web.origin, "https://claude.ai");
  assert.equal(web.pathname, "/code/new");
  assert.equal(web.search, ios.search);
  assert.equal(web.hash, "");
  const browserOnly = new URL(getAgentLink("claude-code", "web", { ...options, browserOnly: true }));
  assert.equal(browserOnly.search, ios.search);
  assert.equal(browserOnly.hash, "#no_universal_links");
  assert.equal(getAgentLink("claude-code", "ios"), "claude://code");
  assert.equal(getAgentLink("claude-code", "web"), "https://claude.ai/code");
  assert.equal(getAgentLink("claude-code", "web", { browserOnly: true }), "https://claude.ai/code#no_universal_links");
  assert.equal(getAgentLink("claude", "web", { prompt: special, browserOnly: true }), null);
  assert.equal(getAgentLink("claude", "web", { browserOnly: true }), "https://claude.ai/new#no_universal_links");
  const chat = new URL(getAgentLink("claude", "web", { prompt: special, browserOnly: true, allowExperimental: true }));
  assert.equal(chat.searchParams.get("q"), special);
  assert.equal(chat.hash, "#no_universal_links");
  assert.equal(getAgentLink("claude-code", "android", { mode: "other" }), null);
  assert.equal(getAgentLink("claude-code", "android", { branch: "main" }), null);
  assert.equal(getAgentLink("claude-code", "ios", { folder: "/tmp/project" }), null);
});

test("opens documented Claude Code cloud session IDs on web and mobile", () => {
  const bases = { web: "https://claude.ai/code", ios: "claude://code", android: "claude://code" };
  for (const [platform, base] of Object.entries(bases)) {
    for (const session of ["session_01HJKLMNOPQRSTUVWXYZ", "cse_test-0123_"]) {
      assert.equal(getAgentLink("claude-code", platform, { session }), `${base}/${session}`);
      assert.equal(getAgentLink("claude-code", platform, { session, browserOnly: true }),
        `${base}/${session}${platform === "web" ? "#no_universal_links" : ""}`);
      for (const draft of [{ prompt: special }, { mode: "plan" }, { repo: "owner/repo", branch: "main" }]) {
        assert.equal(getAgentLink("claude-code", platform, { session, ...draft }), null);
      }
    }
    for (const invalid of ["new", "sessions", "session_", "cse_", "session_./path", "session_x%2Fy", "cse_x?mode=code", "session_x#hash", "session_x\n", "cse_…"]) {
      assert.equal(getAgentLink("claude-code", platform, { session: invalid }), null, invalid);
    }
  }
  assert.equal(getAgentLink("claude-code", "desktop", { session: "session_01HJKLMNOPQRSTUVWXYZ" }), null);
});

test("opens the OpenClaw dashboard without a prompt and encodes Hermes skill reviews", () => {
  assert.equal(getAgentLink("openclaw", "desktop"), "openclaw://dashboard");
  assert.equal(getAgentLink("openclaw", "ios"), "openclaw://dashboard");
  assert.equal(
    getAgentLink("openclaw", "ios", { prompt: "iOS link verification only." }),
    "openclaw://agent?message=iOS%20link%20verification%20only.",
  );
  assert.equal(new URL(getAgentLink("openclaw", "desktop", { prompt: special })).searchParams.get("message"), special);
  for (const skill of ["official/security/1password", "clawhub/sample-skill", "https://example.com/skill.md"]) {
    assert.equal(new URL(getHermesSkillLink(skill)).searchParams.get("identifier"), skill);
  }
  assert.equal(getHermesSkillLink("bare-name"), null);
  assert.equal(getHermesSkillLink("official/../skill"), null);
  assert.equal(getHermesSkillLink("file:///tmp/skill.md"), null);
});

test("opens an authenticated OpenClaw browser draft in the last or specified chat", () => {
  const server = "https://gateway.example:18443/team/openclaw/";
  const session = "https://gateway.example:18443/team/openclaw/chat/link-fixture/draft/proof";
  const prompt = "Draft + & %2B 100% café ☃\nSecond line — 東京";
  const query = `?draft=${encodeURIComponent(prompt)}`;
  assert.equal(getAgentLink("openclaw", "web"), "http://127.0.0.1:18789/");
  assert.equal(getAgentLink("openclaw", "web", { prompt }), `http://127.0.0.1:18789/chat${query}`);
  assert.equal(getAgentLink("openclaw", "web", { server, prompt }), `${server}chat${query}`);
  assert.equal(getAgentLink("openclaw", "web", { server, session }), session);
  assert.equal(getAgentLink("openclaw", "web", { server, session, prompt }), `${session}${query}`);
  assert.equal(getAgentLink("openclaw", "android", { server, session, prompt }), `${session}${query}`);
  assert.equal(getAgentLink("openclaw", "android", { prompt }), null);
  for (const invalid of [
    "https://gateway.example:18443/team/other/chat/main",
    "https://other.example:18443/team/openclaw/chat/main",
    "https://gateway.example:18443/team/openclaw/chat/",
    `${session}?token=private`, `${session}#token=private`, "openclaw://dashboard",
    "/team/openclaw/chat/main",
  ]) assert.equal(getAgentLink("openclaw", "web", { server, session: invalid, prompt }), null, invalid);
});

test("opens the OpenClaw macOS Gateway review with an uncredentialed HTTPS address", () => {
  const server = "https://gateway.example:18443/a+b/%25/openclaw/";
  const href = getAgentLink("openclaw", "desktop", { server });
  const gateway = new URL(href);
  assert.equal(gateway.protocol, "openclaw:");
  assert.equal(gateway.host, "gateway");
  assert.equal(gateway.pathname, "/add");
  assert.deepEqual([...gateway.searchParams], [["url", server]]);
  assert.equal(getAgentRoute("openclaw", "desktop").serverBehavior, "confirm");
  assert.equal(getAgentLink("openclaw", "desktop", { server, prompt: special }), null);
  for (const invalid of [
    "http://gateway.example/",
    "https:/gateway.example/",
    "https:///gateway.example/",
    "https://gateway.example:0/",
    "https://gateway.example:65536/",
    "https://person:token@gateway.example/",
    "https://@gateway.example/",
    "https://gateway.example/?",
    "https://gateway.example/?token=secret",
    "https://gateway.example/#",
    "https://gateway.example/#secret",
    "https://gate\nway.example/",
    "https://gateway.example\\path",
  ]) {
    assert.equal(getAgentLink("openclaw", "desktop", { server: invalid }), null, invalid);
  }
});

test("stages OpenClaw iOS Gateway setup with a host, explicit port, and TLS setting", () => {
  const gateway = "openclaw://gateway";
  assert.equal(
    getAgentLink("openclaw", "ios", { server: "https://gateway.example.invalid:18443/" }),
    `${gateway}?host=gateway.example.invalid&port=18443&tls=1`,
  );
  assert.equal(
    getAgentLink("openclaw", "ios", { server: "wss://gateway.example.invalid" }),
    `${gateway}?host=gateway.example.invalid&port=443&tls=1`,
  );
  assert.equal(
    getAgentLink("openclaw", "ios", { server: "https://[2001:db8::1]:65535" }),
    `${gateway}?host=2001%3Adb8%3A%3A1&port=65535&tls=1`,
  );
  assert.equal(
    getAgentLink("openclaw", "ios", { server: "http://localhost:80" }),
    `${gateway}?host=localhost&port=80&tls=0`,
  );
  assert.equal(
    getAgentLink("openclaw", "ios", { server: "ws://studio.local" }),
    `${gateway}?host=studio.local&port=18789&tls=0`,
  );
  for (const server of [
    "ws://10.12.0.2:18789", "http://172.31.0.1", "ws://192.168.0.10", "ws://169.254.20.1",
    "ws://127.2.3.4", "ws://[::1]", "ws://[::ffff:127.0.0.1]", "ws://[fd00::5]", "ws://[feb0::2]",
  ]) {
    assert.equal(new URL(getAgentLink("openclaw", "ios", { server })).searchParams.get("tls"), "0", server);
  }
  for (const server of [
    "https://gateway.example.invalid:0/", "https://gateway.example.invalid:65536/",
    "http://gateway.example.invalid/", "ws://100.64.0.1/", "ws://172.32.0.1/",
    "http://10.0.example/", "http://127.0.0.1.example/", "ws://[2001:db8::1]/",
    "https://gateway.example.invalid/openclaw/", "https://gateway.example.invalid/path/..",
    "https://person:secret@gateway.example.invalid/", "https://@gateway.example.invalid/",
    "https://gateway.example.invalid/?", "https://gateway.example.invalid/#",
    "https://gateway.example.invalid/?token=secret", "https://gateway.example.invalid/#secret",
  ]) {
    assert.equal(getAgentLink("openclaw", "ios", { server }), null, server);
  }
  assert.equal(getAgentLink("openclaw", "ios", { server: "https://gateway.example.invalid", prompt: special }), null);
  assert.equal(getAgentLink("openclaw", "desktop", { server: "wss://gateway.example.invalid" }), null);
});

test("opens Claude Code in VS Code with an optional draft and session", () => {
  const base = "vscode://anthropic.claude-code/open";
  const session = "12345678-1234-4234-9234-123456789abc";
  const prompt = `${special} Keep %2B and 100%.`;
  assert.equal(getAgentLink("claude-code", "vscode"), base);
  assert.equal(getAgentLink("claude-code", "vscode", { session }), `${base}?session=${session}`);
  const uri = getAgentLink("claude-code", "vscode", { prompt, session });
  assert.equal(uri, `${base}?prompt=${encodeURIComponent(encodeURIComponent(prompt))}&session=${session}`);
  const parameters = new URLSearchParams(decodeURIComponent(new URL(uri).search.slice(1)));
  assert.equal(parameters.get("prompt"), prompt);
  assert.equal(parameters.get("session"), session);
  assert.equal(getAgentLink("claude-code", "vscode", { cwd: "/tmp/project" }), null);
  for (const invalid of ["./a", "a\\b", "a..b", "a\u0000b"]) {
    assert.equal(getAgentLink("claude-code", "vscode", { session: invalid }), null);
  }
});

test("opens existing desktop chats with the provider's session UUID route", () => {
  const session = "12345678-1234-4234-9234-123456789abc";
  const bases = {
    claude: "claude://claude.ai/chat",
    chatgpt: "codex://threads",
    codex: "codex://threads",
  };
  for (const [agent, base] of Object.entries(bases)) {
    assert.equal(getAgentLink(agent, "desktop", { session }), `${base}/${session}`);
    assert.equal(getAgentRoute(agent, "desktop").sessionUrl, base);
    assert.equal(getAgentLink(agent, "desktop", { session, prompt: special }), null);
    assert.equal(getAgentLink(agent, "ios", { session }), null);
    for (const invalid of ["new", "wake", "local_chat-1", "/", "session?mode=chat", "id#fragment", "%2F", `${session}\n`, "…"]) {
      assert.equal(getAgentLink(agent, "desktop", { session: invalid }), null);
    }
  }
  assert.equal(getAgentLink("codex", "desktop", { session, path: "/tmp/project" }), null);
  assert.equal(getAgentLink("codex", "desktop", { session, originUrl: "https://github.com/owner/repo" }), null);
  assert.equal(getAgentLink("codex", "desktop", { prompt: "Existing new-chat behavior" }), "codex://new?prompt=Existing%20new-chat%20behavior");
});

test("opens an existing Cursor Cloud Agent and preserves team URLs", () => {
  const cloudAgent = "bc-8da7657c-0caf-49d1-8a21-81e0761b0eb0";
  const agentUrl = `https://cursor.com/agents/${cloudAgent}`;
  const teamUrl = `https://cursor.com/t/team-qa/agents/${cloudAgent}`;
  const native = `cursor://anysphere.cursor-deeplink/background-agent?bcId=${cloudAgent}`;
  for (const platform of ["web", "desktop", "ios", "android"]) {
    for (const [input, output] of [[cloudAgent, agentUrl], [agentUrl, agentUrl], [teamUrl + "/?s=test#tracking", teamUrl]]) {
      assert.equal(getAgentLink("cursor", platform, { cloudAgent: input }), platform === "desktop" ? native : output);
      assert.equal(getAgentLink("cursor", platform, { cloudAgent: input, prompt: special }), null);
    }
    for (const input of ["bc-", "bc-1234", `${cloudAgent}\n`, `https://cursor.com.evil.test/agents/${cloudAgent}`,
      `https://cursor.com@evil.test/agents/${cloudAgent}`, `https://cursor.com/t/../agents/${cloudAgent}`, `${agentUrl}/extra`]) {
      assert.equal(getAgentLink("cursor", platform, { cloudAgent: input }), null, input);
    }
  }
  assert.equal(getAgentLink("cursor", "desktop"), null);
  assert.equal(getAgentLink("cursor", "web"), "https://cursor.com/agents");
  assert.equal(getAgentLink("cursor", "ios"), "https://cursor.com/agents");
  assert.equal(getAgentLink("cursor", "android"), "https://cursor.com/agents");
});

test("opens Codex cloud tasks from CLI IDs and first-party URLs", () => {
  const id = "task_i_05c25d340000445599000123abc9d001";
  const legacy = `https://chatgpt.com/codex/tasks/${id}`;
  const current = "https://chatgpt.com/codex/cloud/tasks/34b77f4f-f3a9-4866-bf9b-31fcd282d693";
  for (const platform of ["web", "ios", "android"]) {
    for (const [task, expected] of [
      [id, legacy], [legacy, legacy], [current + "?ref=source#context", current],
      ["https://chatgpt.com/app/codex/tasks/" + id, legacy],
    ]) {
      assert.equal(getAgentLink("codex", platform, { task }), expected);
      assert.equal(getAgentLink("codex", platform, { task, browserOnly: true }),
        expected + (platform === "web" ? "#no_universal_links" : ""));
      assert.equal(getAgentLink("codex", platform, { task, prompt: special }), null);
    }
    for (const task of ["task_", "new", "task_bad/path", "task_x%2Fy", "task_x\n", "https://chatgpt.com.evil.test/codex/tasks/" + id,
      "https://chatgpt.com@evil.test/codex/tasks/" + id, "https://chatgpt.com/codex/tasks/../" + id,
      "https://chatgpt.com/codex/tasks/" + id + "/extra"]) {
      assert.equal(getAgentLink("codex", platform, { task }), null, task);
    }
  }
  assert.equal(getAgentLink("codex", "desktop", { task: id }), null);
  assert.equal(getAgentLink("codex", "web"), "https://chatgpt.com/codex");
  assert.equal(getAgentLink("codex", "ios"), "https://chatgpt.com/app/codex");
  assert.equal(getAgentLink("codex", "android"), "https://chatgpt.com/app/codex");
});

test("builds GitHub Copilot draft links and validates their session context", () => {
  const options = { prompt: special, repo: "owner/repo", pr: "123", mode: "interactive" };
  const native = `ghapp://session/new?prompt=${encodeURIComponent(special)}&repo=owner%2Frepo&pr=123&mode=interactive`;
  assert.equal(getAgentLink("github-copilot", "desktop", options), native);
  assert.equal(getAgentLink("github-copilot", "web", options),
    `https://github.com/copilot/app/launch?open=${encodeURIComponent(native)}`);
  assert.equal(getAgentLink("github-copilot", "web"), "https://github.com/copilot");
  assert.equal(getAgentLink("github-copilot", "desktop"), null);
  assert.equal(getAgentLink("github-copilot", "desktop", { repo: "owner/repo", branch: "topic/launch" }),
    "ghapp://session/new?repo=owner%2Frepo&branch=topic%2Flaunch");
  assert.equal(getAgentLink("github-copilot", "desktop", { customAgent: "Review agent" }),
    "ghapp://session/new?agent=Review%20agent");
  for (const invalid of [
    { ...options, branch: "main" },
    { prompt: special, branch: "main" },
    { prompt: special, pr: "123" },
    { ...options, pr: "0" },
    { ...options, pr: "9".repeat(25) },
    { ...options, customAgent: "Reviewer" },
    { ...options, mode: "code" },
    { mode: "plan", customAgent: " " },
  ]) {
    assert.equal(getAgentLink("github-copilot", "desktop", invalid), null);
    assert.equal(getAgentLink("github-copilot", "web", invalid), null);
  }
  const decodeVSCodeQuery = (url) => new URLSearchParams(decodeURIComponent(new URL(url).search.slice(1)));
  for (const workspace of ["file:///tmp/QA%20folder", "file://server/share/a", "vscode-remote://ssh-remote+host/work"]) {
    const uri = getAgentLink("github-copilot", "vscode", { prompt: special, workspace });
    assert.equal(uri, `vscode://agents/new?prompt=${encodeURIComponent(encodeURIComponent(special))}&workspace=${encodeURIComponent(encodeURIComponent(workspace))}`);
    const decoded = decodeVSCodeQuery(uri);
    assert.equal(decoded.get("prompt"), special);
    assert.equal(decoded.get("workspace"), workspace);
  }
  assert.equal(getAgentLink("github-copilot", "vscode"), null);
  assert.equal(getAgentLink("github-copilot", "vscode", { workspace: "file:///tmp/QA" }), null);
  assert.equal(getAgentLink("github-copilot", "vscode", { prompt: special, workspace: " file:///tmp/QA" }), null);
  assert.equal(getAgentLink("github-copilot", "vscode", { prompt: special, workspace: "file:relative" }), null);
  assert.equal(getAgentLink("github-copilot", "vscode", { prompt: special, workspace: "https://example.com/project" }), null);
  assert.equal(getAgentLink("github-copilot", "vscode", { prompt: special, workspace: "file:///tmp/QA?query=1" }), null);
  const unescapedWorkspace = getAgentLink("github-copilot", "vscode", { prompt: special, workspace: "file:///tmp/QA folder" });
  assert.equal(decodeVSCodeQuery(unescapedWorkspace).get("workspace"), "file:///tmp/QA%20folder");
  assert.equal(getAgentLink("claude-code", "ios", { prompt: special, mode: "autopilot" }), null);
});

test("opens the versioned ZCode Remote Control viewer on browser surfaces", () => {
  for (const platform of ["web", "ios", "android"]) {
    assert.equal(getAgentLink("zcode", platform), "https://zcode.z.ai/remote/v4?app_version=4.0.0");
    assert.equal(getAgentLink("zcode", platform, { prompt: special }), null);
  }
});

test("opens Kimi Code workspaces and configured browser clients", () => {
  const directory = "/tmp/Workspace + & café #%";
  const href = getAgentLink("kimi-code", "desktop", { directory });
  assert.equal(href, `kimi-code://open?root=${encodeURIComponent(directory)}&new=1`);
  const windows = "C:\\Workspace + & café";
  assert.equal(new URL(getAgentLink("kimi-code", "desktop", { directory: windows })).searchParams.get("root"), windows);
  assert.equal(getAgentLink("kimi-code", "desktop", { directory: "relative" }), null);
  assert.equal(getAgentLink("kimi-code", "desktop", { directory, prompt: special }), null);
  assert.equal(getAgentLink("kimi-code", "desktop"), null);
  const server = "https://code-rc.kimi.ai/devices/qa-device/";
  for (const platform of ["web", "ios", "android"]) {
    assert.equal(getAgentLink("kimi-code", platform), "https://code-rc.kimi.ai/");
    assert.equal(getAgentLink("kimi-code", platform, { server: "http://127.0.0.1:58627" }), "http://127.0.0.1:58627/");
    assert.equal(getAgentLink("kimi-code", platform, { server }), server);
    assert.equal(getAgentLink("kimi-code", platform, { server: `${server}#token=private` }), null);
    assert.equal(getAgentLink("kimi-code", platform, { server: `${server}?token=private` }), null);
  }
});

test("builds ChatGPT sidebar app links for the documented surfaces", () => {
  const id = "plugin_asdk_app_6abadab6e7d881919e7491d52c7846e8";
  const target = `https://chatgpt.com/plugins/${id}?open_in_app`;
  const appPath = "/parts/part_joystick?label=café + A&B";
  const options = { action: "app", target, tool: "cad.browse", appPath };
  for (const [platform, base] of [
    ["web", "https://chatgpt.com/plugins/"],
    ["desktop", "codex://plugins/"],
    ["ios", "chatgpt://plugins/"],
  ]) {
    const href = getAgentLink("chatgpt", platform, options);
    assert.equal(href, `${base}${id}/app/cad.browse?path=${encodeURIComponent(appPath)}`);
    assert.equal(new URL(href).searchParams.get("path"), appPath);
    assert.equal(getAgentRoute("chatgpt", platform, "app").behavior, "launch");
  }
  assert.equal(getAgentLink("chatgpt", "desktop", { action: "app", target: "my-plugin", tool: "parts/library", marketplace: "my-market" }),
    "codex://plugins/my-plugin@my-market/app/parts%2Flibrary");
  assert.equal(getAgentLink("chatgpt", "web", { ...options, marketplace: "my-market" }), null);
  assert.equal(getAgentLink("chatgpt", "android", options), null);
  assert.equal(getAgentLink("chatgpt", "web", { action: "app", target }), null);
  assert.equal(getAgentLink("chatgpt", "web", { ...options, prompt: special }), null);
  assert.equal(getAgentLink("chatgpt", "web", { ...options, target: "https://chatgpt.com.example/plugins/example" }), null);
  assert.equal(getAgentLink("chatgpt", "web", { ...options, target: "plugin%2Fid" }), null);
  assert.equal(getAgentLink("chatgpt", "web", { ...options, tool: ".." }), null);
  for (const invalid of ["https://example.com", "//example.com", "/\\example.com", "/path#fragment", "/\npath"]) {
    assert.equal(getAgentLink("chatgpt", "web", { ...options, appPath: invalid }), null);
  }
  assert.equal(getAgentLink("chatgpt", "web", { action: "plugin", target }), `https://chatgpt.com/plugins/${id}`);
});

test("prefills a Codex plugin mention in an unsent message and opens explicit install routes", () => {
  const target = "openai-developers@openai-curated";
  const detail = `codex://plugins/${target}`;
  for (const agent of ["codex", "chatgpt"]) {
    const href = getAgentLink(agent, "desktop", { action: "plugin-chat", target: `${detail}?source=manage`, prompt: special });
    assert.equal(new URL(href).searchParams.get("prompt"), `[@openai-developers](plugin://${target}) ${special}`);
    assert.match(href, /^codex:\/\/new\?prompt=/u);
    assert.equal(getAgentLink(agent, "desktop", { action: "plugin-chat", target }), null);
    assert.equal(getAgentLink(agent, "desktop", { action: "plugin", target }), detail);
    assert.equal(getAgentLink(agent, "desktop", { action: "plugin-install", target: "openai-developers", marketplace: "openai-curated" }),
      "codex://plugins/install/openai-developers?marketplace=openai-curated");
  }
  assert.equal(getAgentLink("codex", "web", { action: "plugin-chat", target, prompt: special }), null);
  assert.equal(getAgentLink("codex", "desktop", { action: "plugin-chat", target: "bad](https://example.com)", prompt: special }), null);
});

test("builds a ChatGPT Work plugin draft and a separate install review", () => {
  const id = "Plugin_60db802073a48191b7256d1c268d7a47";
  const target = `https://chatgpt.com/plugins/${id}`;
  const options = { action: "plugin-chat", target, prompt: special };
  const href = getAgentLink("chatgpt", "web", options);
  assert.equal(href, `${target}?install&prompt=${encodeURIComponent(special)}&surface=work`);
  assert.equal(getAgentRoute("chatgpt", "web", "plugin-chat").behavior, "draft");
  assert.equal(getAgentLink("chatgpt", "web", { action: "plugin-chat", target }), null);
  assert.equal(getAgentLink("chatgpt", "web", { action: "plugin-install", target }), `${target}?install`);
  assert.equal(getAgentLink("chatgpt", "web", { action: "plugin-install", target, prompt: special }), null);
});

test("builds provider-specific plugin, skill and shared-assistant destinations", () => {
  const cases = [
    ["grok-bot", "web", { action: "plugin", target: "9007199254740993" }, "https://x.ai/bot/plugin/9007199254740993"],
    ["grok-bot", "ios", { action: "team-plugin", target: "grokbot://app/v1/plugin/add?id=456" }, "grokbot://app/v1/plugin/add?id=456"],
    ["antigravity", "web", { action: "plugin", target: "firebase" }, "https://antigravity.google/docs/marketplace/?plugin=firebase#browse-marketplace-plugins"],
    ["antigravity", "desktop", { action: "plugin", target: "stripe", marketplace: "antigravity-plugins-partners" }, "antigravity://plugin/stripe?marketplace=antigravity-plugins-partners"],
    ["antigravity", "desktop", { action: "skill", target: "sample", marketplace: "antigravity-plugins-partners" }, "antigravity://customizations/marketplaces/antigravity-plugins-partners/skills/sample"],
    ["claude", "desktop", { action: "plugin-install", target: "slack", marketplace: "anthropics/knowledge-work-plugins" }, "https://claude.ai/desktop/customize/plugins/new?marketplace=anthropics%2Fknowledge-work-plugins&plugin=slack"],
    ["claude", "web", { action: "plugin", target: "268ba6b9-a27c-4bc8-9dc2-2a0b5ab79bfb@anthropic-plugin-directory" }, "https://claude.ai/customize/plugins/id/268ba6b9-a27c-4bc8-9dc2-2a0b5ab79bfb%40anthropic-plugin-directory"],
    ["claude", "web", { action: "connector", target: "https://claude.ai/directory/ringcentral-chat" }, "https://claude.ai/directory/ringcentral-chat"],
    ["cursor", "web", { action: "plugin", target: "cursor/google-drive" }, "https://cursor.com/marketplace/cursor/google-drive"],
    ["hermes", "desktop", { action: "skill-install", target: "official/security/1password" }, getHermesSkillLink("official/security/1password")],
    ["chatgpt", "web", { action: "custom-gpt", target: "https://chatgpt.com/g/g-1234-sample" }, "https://chatgpt.com/g/g-1234-sample"],
    ["gemini", "web", { action: "gem", target: "gem-id" }, "https://gemini.google.com/gem/gem-id"],
    ["perplexity", "ios", { action: "project", target: "https://www.perplexity.ai/collections/sample-Project.Id" }, "https://www.perplexity.ai/collections/sample-Project.Id"],
  ];
  for (const [agent, platform, options, url] of cases) {
    assert.equal(getAgentLink(agent, platform, options), url, `${agent}/${platform}/${options.action}`);
  }
  assert.equal(getAgentLink("grok-bot", "desktop", { action: "team-plugin", target: "grokbot://other/v1/plugin/add?id=456" }), null);
  assert.equal(getAgentLink("cursor", "web", { action: "plugin", target: "cursor/../x" }), null);
  assert.equal(getAgentLink("gemini", "web", { action: "gem", target: "https://elsewhere.example/gem/id" }), null);
  assert.equal(getAgentLink("perplexity", "web", { action: "project", target: "https://www.perplexity.ai/search/anything" }), null);
});

test("encodes Cursor MCP configurations as UTF-8 base64 in review links", () => {
  const config = { url: "https://example.com/mcp", headers: { "X-Label": "Café + 🎉" } };
  const options = { action: "mcp-install", target: "MCP café", config: JSON.stringify(config) };
  for (const [platform, base] of [
    ["desktop", "cursor://anysphere.cursor-deeplink/mcp/install"],
    ["web", "https://cursor.com/install-mcp"],
  ]) {
    const href = getAgentLink("cursor", platform, options);
    assert.equal(href.split("?")[0], base);
    const params = new URL(href).searchParams;
    assert.equal(params.get("name"), options.target);
    assert.deepEqual(JSON.parse(Buffer.from(params.get("config"), "base64").toString("utf8")), config);
    assert.equal(getAgentLink("cursor", platform, { ...options, config: "{}" }), null);
    assert.equal(getAgentLink("cursor", platform, { ...options, config: "{" }), null);
  }
});

test("discovers supported actions without replacing default routes and uses them through React", () => {
  assert.deepEqual(getAgentActions("chatgpt", "android"), []);
  assert.deepEqual(getAgentActions("does-not-exist", "web"), []);
  assert.equal(getAgentRoute("chatgpt", "android", "app"), null);
  assert.equal(getAgentRoute("chatgpt", "web").url, "https://chatgpt.com/");
  for (const { id } of Object.values(agents)) {
    for (const platform of platforms) {
      const actions = getAgentActions(id, platform);
      assert.equal(new Set(actions.map((action) => action.id)).size, actions.length);
      for (const action of actions) {
        assert.equal(getAgentRoute(id, platform, action.id), action);
        for (const { field } of action.inputs) assert.ok(Object.hasOwn(action.fields, field));
        for (const field of action.required) assert.ok(action.inputs.some((input) => input.field === field));
        for (const source of action.sources) assert.equal(new URL(source).protocol, "https:");
        assert.equal(getAgentLink(id, platform, { action: action.id }), null);
      }
    }
  }

  const markup = renderToStaticMarkup(createElement(AgentLink, {
    agent: "chatgpt",
    platform: "web",
    options: { action: "app", target: "sample-plugin", tool: "cad.browse" },
    children: "Open CAD",
  }));
  assert.match(markup, /href="https:\/\/chatgpt\.com\/plugins\/sample-plugin\/app\/cad\.browse"/u);
});
