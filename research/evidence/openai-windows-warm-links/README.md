# ChatGPT and Codex Desktop warm links on Windows

The passing hosted Windows Server 2025 job installed OpenAI's Authenticode-valid x64 MSIX `26.1120.6357.0` using the official offline procedure. The installed manifest declared `codex:` with `--single-argument %1`. The fixture used a disposable loopback provider and the bundled CLI to create one named local thread. No Microsoft Store or OpenAI account was used.

For each case, stock Windows Shell opened the blank `codex://threads/new` link and the newly started app displayed its normal workspace. Native accessibility confirmed that the target thread or draft was absent before the test link. The job passed the exact URL from the digest-pinned `agent-deeplinks@0.1.37` release tarball to Windows Shell while the window was running. All three results appeared in the already-open app with the same process ID and native window handle. Shell returned a separate activation process ID for each link, and its command line was unavailable by the time it could be sampled. [Representative blank workspace](ready.png)

| Package URL form | Result in the original window | Screenshot |
| --- | --- | --- |
| `codex://threads/<local-thread-id>` (both existing-thread helpers) | **QA existing Codex local thread café** appeared as the active heading and selected entry in **Recents**. | [Existing thread](existing-thread.png) |
| `codex://threads/new?mode=chat&prompt=<encoded>` | The editable composer contained the exact unsent draft `ChatGPT warm draft + & café ☃`. | [ChatGPT draft](chatgpt-draft.png) |
| `codex://new?prompt=<encoded>` | The editable composer contained the exact unsent draft `Codex warm draft + & café ☃`. | [Codex draft](codex-draft.png) |

The renderer showed **ChatGPT Work** for each URL with the isolated local provider. The test verifies the two different new-draft URL forms and the existing-thread URL in that environment. ChatGPT/Codex UI mode switching was outside the observed scope. The saved local thread still had zero turns. The local provider received zero requests, and neither draft was submitted.

The MSIX SHA-256 was `70a09c02a0dab1411fff42a6d9ec8ae8a6ef1c03686c0c8fdcfdbf0fc90dbbdc`. The release tarball SHA-256 was `f5c4d3773d77c47a12e9471c01f9679beaa0ff1797801e4abd8bfeb212ac9d0a`. The archived evidence digest was independently verified as `63744a680cff13babd18ac40e1a757fe627dba72f8077ab1476a93a450ae7ead`. The reviewed screenshots contain only the synthetic workspace and fixture text.

[Passing hosted job](https://github.com/lalalune/agent-deeplinks/actions/runs/45560439451/job/139022577753) · [Exact runner commit](https://github.com/lalalune/agent-deeplinks/commit/f9cd9fcbadb5840deabe14ff049ea4a0867582cc)
