# ChatGPT and Codex Desktop cold links on Windows

The passing hosted Windows Server 2025 job installed the official OpenAI x64 MSIX `26.1120.6357.0` using Microsoft's offline deployment cmdlets. The package passed Authenticode validation and matched the pinned SHA-256. Its installed manifest registered `codex:`. Setup used a disposable local provider and the bundled CLI to create and name one local thread. No Microsoft Store or OpenAI account was used.

The workflow installed the digest-pinned `agent-deeplinks@0.1.36` release tarball. Before each test it stopped the installed app and verified that its process count was zero. Stock Windows Shell accepted the exact package-generated URL and started a distinct `ChatGPT.exe` process for each case. The screenshot and native accessibility observation matched that same process.

| Package URL form | Native outcome | Screenshot |
| --- | --- | --- |
| `codex://threads/<local-thread-id>` (ChatGPT and Codex existing-thread helpers) | **QA existing Codex local thread café** appeared as the active heading and selected entry in **Recents**. The same saved thread still had zero turns after the tests. | [Existing thread](existing-thread.png) |
| `codex://threads/new?mode=chat&prompt=<encoded>` | The editable composer contained the exact unsent draft `ChatGPT cold draft + & café ☃`. | [ChatGPT draft](chatgpt-draft.png) |
| `codex://new?prompt=<encoded>` | The editable composer contained the exact unsent draft `Codex cold draft + & café ☃`. Windows added `/` after `new` in the process argument and preserved the query. | [Codex draft](codex-draft.png) |

All three screenshots showed **ChatGPT Work** with the isolated local provider. The results verify the two new-draft URL forms and the existing-thread URL in that environment. ChatGPT/Codex UI mode switching was outside the observed scope. The local provider received zero requests, and neither draft was submitted.

The MSIX SHA-256 was `70a09c02a0dab1411fff42a6d9ec8ae8a6ef1c03686c0c8fdcfdbf0fc90dbbdc`. The release tarball SHA-256 was `3e891546c7b07ece3bc8a23baf7626c21549f963a6996d9c3bc8bd95e2377c11`. The archived evidence digest was independently verified as `6a9c77d2ccbfca8e2ef1bce81f2929790cb0efebd0f31355507c3598aaae097d`. The three native-window captures contain only synthetic QA content.

[Passing hosted job](https://github.com/lalalune/agent-deeplinks/actions/runs/45556735459/job/139010480644) · [Exact runner commit](https://github.com/lalalune/agent-deeplinks/commit/d93569966c83a9b9ee96eb6afea2717d653a4b64)
