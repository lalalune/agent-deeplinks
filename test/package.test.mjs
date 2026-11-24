import { test } from "node:test";
import assert from "node:assert/strict";
import { agents, getAgentIcon, getAgentLink, getAgentRoute, getHermesSkillLink, getOpenCodeAndroidPairingLink, platforms } from "../dist/index.js";

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
  assert.equal(getAgentLink("grok", "web", { prompt: special }), null);
  const grok = new URL(getAgentLink("grok", "web", { prompt: special, allowExperimental: true }));
  assert.equal(grok.searchParams.get("q"), special);
  assert.equal(grok.searchParams.get("stay_in_browser"), "true");

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
        field.startsWith("allow") || Object.hasOwn(route.fields ?? {}, field)));
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
  assert.equal(getAgentLink("openclaw", "android", { server: "https://gateway.example/openclaw/", prompt: special }), null);
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

test("opens the OpenClaw dashboard without a prompt and encodes Hermes skill reviews", () => {
  assert.equal(getAgentLink("openclaw", "desktop"), "openclaw://dashboard");
  assert.equal(getAgentLink("openclaw", "ios"), "openclaw://dashboard");
  assert.equal(new URL(getAgentLink("openclaw", "desktop", { prompt: special })).searchParams.get("message"), special);
  for (const skill of ["official/security/1password", "clawhub/sample-skill", "https://example.com/skill.md"]) {
    assert.equal(new URL(getHermesSkillLink(skill)).searchParams.get("identifier"), skill);
  }
  assert.equal(getHermesSkillLink("bare-name"), null);
  assert.equal(getHermesSkillLink("official/../skill"), null);
  assert.equal(getHermesSkillLink("file:///tmp/skill.md"), null);
});

test("opens Claude Code in VS Code with an optional draft and session", () => {
  const base = "vscode://anthropic.claude-code/open";
  const session = "12345678-1234-4234-9234-123456789abc";
  assert.equal(getAgentLink("claude-code", "vscode"), base);
  assert.equal(getAgentLink("claude-code", "vscode", { session }), `${base}?session=${session}`);
  assert.equal(
    getAgentLink("claude-code", "vscode", { prompt: special, session }),
    `${base}?prompt=${encodeURIComponent(special)}&session=${session}`,
  );
  assert.equal(getAgentLink("claude-code", "vscode", { cwd: "/tmp/project" }), null);
  for (const invalid of ["./a", "a\\b", "a..b", "a\u0000b"]) {
    assert.equal(getAgentLink("claude-code", "vscode", { session: invalid }), null);
  }
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
