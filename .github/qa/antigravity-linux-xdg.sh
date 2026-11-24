#!/usr/bin/env bash
set -euo pipefail

scratch="$RUNNER_TEMP/antigravity-linux"
evidence="$scratch/evidence"
url=$(node --input-type=module -e 'import { getAgentLink } from "./dist/index.js"; console.log(getAgentLink("antigravity", "desktop"));')
test "$url" = 'antigravity://'
printf '%s\n' "$url" > "$evidence/link.txt"

mime='x-scheme-handler/antigravity'
desktop_id='antigravity-link-qa.desktop'
desktop_file="$XDG_DATA_HOME/applications/$desktop_id"
xdg-mime query default "$mime" > "$evidence/stock-xdg-default.txt"
gio mime "$mime" > "$evidence/stock-gio-associations.txt"
test ! -s "$evidence/stock-xdg-default.txt"

mkdir -p "$(dirname "$desktop_file")"
cat > "$desktop_file" <<ENTRY
[Desktop Entry]
Type=Application
Name=Google Antigravity
Exec="$ANTIGRAVITY_QA_EXE" %u
MimeType=$mime;
Terminal=false
ENTRY
desktop-file-validate "$desktop_file"
cp "$desktop_file" "$evidence/installed-handler.desktop"
update-desktop-database "$(dirname "$desktop_file")"
xdg-mime default "$desktop_id" "$mime"
xdg-mime query default "$mime" | tee "$evidence/configured-xdg-default.txt"
grep -Fx "$desktop_id" "$evidence/configured-xdg-default.txt"
gio mime "$mime" | tee "$evidence/configured-gio-associations.txt"
grep -F "$desktop_id" "$evidence/configured-gio-associations.txt"

openbox --sm-disable > "$evidence/window-manager.log" 2>&1 &
window_manager=$!
trap 'kill "$window_manager" 2>/dev/null || true' EXIT
for attempt in {1..20}; do
  if wmctrl -m >/dev/null 2>&1; then break; fi
  sleep 0.25
done
wmctrl -m > "$evidence/window-manager.txt"

xdg-open "$url" > "$evidence/xdg-open.log" 2>&1
node .github/qa/antigravity-linux-xdg.mjs "$url"
