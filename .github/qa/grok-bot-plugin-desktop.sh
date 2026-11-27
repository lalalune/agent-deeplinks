#!/usr/bin/env bash
set -euo pipefail
qa="$RUNNER_TEMP/grok-bot-plugin-desktop"
profile=$(mktemp -d "$qa/profile.XXXXXXXX")
for path in home config data cache state runtime tmp; do mkdir -m 700 "$profile/$path"; done
script="$(realpath .github/qa/grok-bot-plugin-desktop.mjs)"
# The fresh child shell expands its own environment and window-manager PID.
# shellcheck disable=SC2016
env -i PATH="$PATH" LANG=C.UTF-8 HOME="$profile/home" HOME_ROOT="$profile" QA_DIR="$qa" QA_SCRIPT="$script" \
  XDG_CONFIG_HOME="$profile/config" XDG_DATA_HOME="$profile/data" XDG_CACHE_HOME="$profile/cache" \
  XDG_STATE_HOME="$profile/state" XDG_RUNTIME_DIR="$profile/runtime" XDG_CURRENT_DESKTOP=GNOME TMPDIR="$profile/tmp" \
  xvfb-run -a --server-args='-screen 0 1440x1000x24' dbus-run-session -- bash -c '
    openbox --sm-disable >"$QA_DIR/window-manager.log" 2>&1 &
    manager=$!
    trap "kill $manager 2>/dev/null || true" EXIT
    node "$QA_SCRIPT"
  '
