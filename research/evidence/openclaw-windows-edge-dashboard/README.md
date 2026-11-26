# OpenClaw Dashboard on Windows

Windows Server 2025 ran the Authenticode-valid OpenClaw Windows Hub 2026.11.3 x64 against a disposable loopback Gateway 2026.11.9. The stock Gateway CLI approved one matching Hub operator request. The Hub showed **Connected** before its process stopped. No account or node capability was configured.

| Check | Observed result |
| --- | --- |
| Published input | `agent-deeplinks@0.1.34` generated `openclaw://dashboard`. |
| Browser baseline | Microsoft-signed Edge used a fresh disposable user data directory and was open to `about:blank`. Its observer listened only on loopback. No Gateway tab was open and the Windows HTTP resolver was untouched. |
| Cold stock dispatch | Zero Hub processes were running. Stock Windows Shell started a new signed Hub process whose argument was `openclaw://dashboard/`. The original Gateway stayed ready. |
| Exact browser destination | Exactly one Edge tab appeared at the same disposable loopback origin. Its document title identified OpenClaw. |
| Rendered Dashboard | The renderer displayed **Main Session**, **Message Assistant**, and **Connected**. The composer was editable and no pairing or sign-in gate was visible. |
| Gateway confirmation | The stock CLI reported one newly connected Control UI browser device and zero pending approvals. The fixture received zero model requests. |

The hosted job reported failure. Its final assertion additionally required a standalone sidebar navigation label, which the DOM observer did not find. The table reports the rendered labels and live Gateway state captured before that assertion. The minimized evidence includes no screenshot.

The published artifact archive SHA-256 is `c7c31301c57bad6a5b9f275c4d4a4011530bf4ea574cb0c32e78a8aa3ce7c60e`. Its digest and the recorded runner commit were independently checked when preparing this summary.

[Hosted job](https://github.com/lalalune/agent-deeplinks/actions/runs/45554862084/job/139004351431) · [Original evidence artifact](https://github.com/lalalune/agent-deeplinks/actions/runs/45554862084/artifacts/14996305198) · [Exact runner commit](https://github.com/lalalune/agent-deeplinks/commit/d004ae79c573d198de7b5baa48f0f76b866a02be)
