# OpenClaw browser Dashboard session deep links

A checksum-verified OpenClaw 2026.11.10 Gateway created one idle session named **Isolated Dashboard Proof** under a non-root Control UI base path. Fresh desktop and Pixel 9 emulated Chromium profiles connected normally to the same disposable Gateway. All eight browser cases received an accepted `board.get` for the exact session key. The session history contained zero messages before and after, and there were no model requests.

- **Standard Dashboard** kept the chat composer beside the Dashboard on desktop. Pixel stacked the Dashboard below chat in a 360 × 732 CSS viewport. Both profiles showed the exact unsent multiline Unicode draft when requested and consumed the draft query.
- **Focused Dashboard** kept the focus URL and filled each viewport with the Dashboard. Neither application navigation nor the chat composer was displayed. Browser fullscreen was off.
- **Dashboards gallery** recovered the initially private chat document and canonicalized the expanded link to the same session's standard Dashboard URL. Desktop made the Dashboard the main pane and placed chat alongside it. Pixel stacked the Dashboard below chat.

The idle board contained no widgets. The desktop standard-route capture caught its loading placeholder, while the standard draft capture rendered the empty board in the same split layout. [Passing job](https://github.com/lalalune/agent-deeplinks/actions/runs/45703008909/job/139517702883) · [Original archive](https://github.com/lalalune/agent-deeplinks/actions/runs/45703008909/artifacts/15063712402)
