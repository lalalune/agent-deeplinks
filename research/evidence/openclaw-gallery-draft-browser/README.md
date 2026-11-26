# OpenClaw gallery links that include a draft

Stock OpenClaw 2026.11.10 authenticated the browser profiles and resolved the exact idle session from `/chat/link-fixture/dashboard/proof?dashboard=expanded&draft=…`. Both browsers removed the query parameters and ended at the matching chat pathname. The Gateway received zero messages and made zero model requests.

- Desktop Chromium at 1440 × 900 kept the expanded Dashboard as the main panel with the app sidebar. The chat composer was absent. The observer found no exact draft in hidden composer elements or browser storage keys named for drafts. There was no directly visible **Restore split** button, so no layout action was taken.
- Pixel 9 emulation in Chromium at 360 × 732 CSS pixels showed the exact editable multiline Unicode draft in chat. The observed layout did not show the Dashboard panel.

The workflow pass asserts session resolution and no mutation for both profiles. Draft appearance differs by profile. [Hosted job](https://github.com/lalalune/agent-deeplinks/actions/runs/45703514637/job/139519440394) · [Original archive](https://github.com/lalalune/agent-deeplinks/actions/runs/45703514637/artifacts/15062744964)
