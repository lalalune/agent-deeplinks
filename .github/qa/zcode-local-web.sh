#!/usr/bin/env bash
set -euo pipefail
qa=$1
export ZCODE_DATA_BASE_DIR="$qa/storage"
workspace="$qa/QA workspace + café"
mkdir -p "$workspace" "$ZCODE_DATA_BASE_DIR"
export ZCODE_CREDENTIAL_SECRET_FILE="$qa/credential.secret"
unset ZCODE_CREDENTIAL_SECRET
node --input-type=module -e '
  import { randomBytes } from "node:crypto";
  import { writeFileSync } from "node:fs";
  writeFileSync(process.argv[1], randomBytes(48).toString("base64url"), { flag: "wx", mode: 0o600 });
' "$ZCODE_CREDENTIAL_SECRET_FILE"
test "$(stat -c '%a' "$ZCODE_CREDENTIAL_SECRET_FILE")" = 600
binary="$qa/extracted/zcode/bin/zcode.mjs"
node "$binary" --web --help > "$qa/evidence/web-help.txt"
node "$binary" --web --workspace "$workspace" --port 3030 --no-open >"$qa/server.log" 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; unlink "$ZCODE_CREDENTIAL_SECRET_FILE"' EXIT
url='http://127.0.0.1:3030/'
end=$((SECONDS + 80))
until curl --silent --fail --max-time 1 --output "$qa/web.html" "$url"; do
  if ((SECONDS >= end)) || ! kill -0 "$server_pid" 2>/dev/null; then
    tail -60 "$qa/server.log" | tee "$qa/evidence/server-error.txt"
    exit 1
  fi
  sleep 2
done
grep -E '127\.0\.0\.1:3030|localhost:3030|listening|workspace' "$qa/server.log" | head -18 > "$qa/evidence/server-setup.txt" || true
ss -ltn '( sport = :3030 )' > "$qa/evidence/listening.txt"
grep -Eq '127\.0\.0\.1:3030' "$qa/evidence/listening.txt"
node .github/qa/zcode-local-web.mjs "$qa" "$url"
find "$workspace" -mindepth 1 -maxdepth 1 -print > "$qa/evidence/workspace-entries.txt"
