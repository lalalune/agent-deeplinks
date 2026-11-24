import { test } from "node:test";
import assert from "node:assert/strict";
import { agents, getAgentIcon, getAgentLink, getAgentRoute, getHermesSkillLink, platforms } from "../dist/index.js";

const special = "Keep A&B + café/🎉?\nNew line.";

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
    "codex://new?path=C%3A%5CDev%5Crepo",
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
  assert.equal(getAgentLink("cursor", "android", { prompt: special }), null);
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
  assert.equal(getAgentLink("hermes", "web", { server: "javascript:alert(1)" }), null);
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
  assert.equal(getAgentLink("opencode", "desktop"), "opencode://");
  assert.equal(getAgentLink("opencode", "desktop", { directory: "/tmp/project", prompt: special }), null);
  assert.ok(getAgentLink("opencode", "desktop", { directory: "/tmp/project", prompt: special, allowExperimental: true }));
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
  assert.equal(getAgentLink("claude-code", "ios"), "claude://code");
  assert.equal(getAgentLink("claude-code", "web"), "https://claude.ai/code");
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
