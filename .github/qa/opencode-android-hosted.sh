#!/usr/bin/env bash
set -euo pipefail
umask 077

qa=$1
aab=$2
workspace=$PWD
sdk=${ANDROID_SDK_ROOT:-$ANDROID_HOME}
adb="$sdk/platform-tools/adb"
emu="$sdk/emulator/emulator"
evidence="$qa/evidence"
avd=opencode-hosted-release-36
serial=emulator-5554
package=ai.opencode.mobilecode
avd_pid=
servers_started=()
cli=

server_for() {
  local fixture=$1
  shift
  local server_home="$qa/$fixture"
  (
    cd "$server_home/OpenCode $fixture Default"
    env -i PATH=/usr/bin:/bin HOME="$server_home/home" XDG_CACHE_HOME="$server_home/cache" \
      XDG_CONFIG_HOME="$server_home/config" XDG_DATA_HOME="$server_home/data" XDG_STATE_HOME="$server_home/state" \
      XDG_RUNTIME_DIR="$server_home/runtime" TMPDIR="$server_home/tmp" NO_COLOR=1 \
      GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 OPENCODE_DISABLE_AUTOUPDATE=1 "$cli" "$@"
  )
}

finish() {
  local result=$?
  trap - EXIT
  if [[ -n "$avd_pid" ]]; then
    if "$adb" -s "$serial" emu avd name 2>/dev/null | tr -d '\r' | grep -qx "$avd"; then
      "$adb" -s "$serial" emu kill >/dev/null 2>&1 || true
    fi
    kill "$avd_pid" 2>/dev/null || true
  fi
  for fixture in "${servers_started[@]}"; do
    server_for "$fixture" service stop > "$evidence/service-stop-$fixture.log" 2>&1 || true
  done
  for file in A/issuer.private A/server.private B/issuer.private B/server.private test-signing.p12 signing-pass.txt; do
    if [[ -f "$qa/$file" ]]; then unlink "$qa/$file"; fi
  done
  find "$qa" -maxdepth 1 -type f \( -name 'proof.json' -o -name 'activity.txt' -o -name 'resolve.txt' -o -name '*-dispatch.txt' -o -name '*-resolved.txt' -o -name '*.xml' -o -name '*.png' \) -exec cp {} "$evidence/" \;
  printf '%s\n' "$result" > "$evidence/exit.txt"
  exit "$result"
}
trap finish EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

mkdir -p "$qa/android/avd"
export ANDROID_USER_HOME="$qa/android" ANDROID_AVD_HOME="$qa/android/avd"
for fixture in A B; do
  mkdir -p "$qa/$fixture"/{home,cache,config,data,state,tmp,runtime,"OpenCode $fixture Default"}
done
mkdir -p "$qa/A/OpenCode A Target"
for project in "$qa/A/OpenCode A Default" "$qa/B/OpenCode B Default" "$qa/A/OpenCode A Target"; do
  git -C "$project" -c init.defaultBranch=main init -q
  git -C "$project" -c user.name=QA -c user.email=fixture@example.invalid commit -q --allow-empty -m "QA fixture ${project##*/}"
done

java -jar "$qa/bundletool.jar" dump manifest --bundle="$aab" --module=base > "$evidence/manifest.xml"
grep -q 'versionCode="[0-9][0-9]*".*versionName="0.8.13".*package="ai.opencode.mobilecode"' "$evidence/manifest.xml"
version_code=$(sed -nE 's/.*versionCode="([0-9]+)".*versionName="0\.8\.13".*/\1/p' "$evidence/manifest.xml" | head -1)
test -n "$version_code"
sha256sum "$aab" > "$evidence/upstream-aab-digest.txt"
openssl rand -hex 24 > "$qa/signing-pass.txt"
keytool -genkeypair -alias qa -keystore "$qa/test-signing.p12" -storepass:file "$qa/signing-pass.txt" \
  -storetype PKCS12 -keyalg RSA -keysize 2048 -validity 2 -dname 'CN=Disposable OpenCode Android QA' > "$qa/signer.log" 2>&1
java -jar "$qa/bundletool.jar" build-apks --bundle="$aab" --output="$qa/test.apks" --mode=universal --ks="$qa/test-signing.p12" \
  --ks-key-alias=qa --ks-pass="file:$qa/signing-pass.txt" > "$evidence/bundletool.log" 2>&1
unzip -p "$qa/test.apks" universal.apk > "$qa/test.apk"
"$sdk/build-tools/36.0.0/apksigner" verify --print-certs "$qa/test.apk" > "$evidence/disposable-apk-signature.txt"
sha256sum "$qa/test.apk" > "$evidence/disposable-apk-digest.txt"
export DEEPLINKS_QA_CERT
DEEPLINKS_QA_CERT=$(awk '/Signer #1 certificate SHA-256 digest:/{print $NF}' "$evidence/disposable-apk-signature.txt")
[[ "$DEEPLINKS_QA_CERT" =~ ^[0-9a-f]{64}$ ]]

cli=$(find "$qa/cli" -type f -name opencode -print -quit)
test -x "$cli"
export DEEPLINKS_QA_NODE DEEPLINKS_QA_LIBRARY
DEEPLINKS_QA_NODE=$(command -v node)
DEEPLINKS_QA_LIBRARY="$qa/library/package/dist/index.js"
server_for A --version | tee "$evidence/cli-version.txt"
grep -qx 'opencode v2.4.2' "$evidence/cli-version.txt"
for fixture in A B; do
  port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')
  server_for "$fixture" service set hostname 127.0.0.1
  server_for "$fixture" service set port "$port"
  servers_started+=("$fixture")
  server_for "$fixture" service start > "$qa/$fixture/server.private" 2>&1
  lsof -nP -iTCP:"$port" -sTCP:LISTEN > "$evidence/listener-$fixture.txt"
  awk -v local="127.0.0.1:$port" 'NR>1 {n++; if ($9!=local) exit 1} END {if (n!=1) exit 1}' "$evidence/listener-$fixture.txt"
  python3 "$workspace/.github/qa/opencode-android-idle.py" "$qa/$fixture" "$port" "$fixture"
  cp "$qa/$fixture/session-fixture.json" "$evidence/session-fixture-$fixture.json"
done

if "$adb" devices | awk -v serial="$serial" '$1==serial { seen=1 } END {exit !seen}'; then exit 3; fi
printf '%s\n' no | avdmanager create avd --name "$avd" --package 'system-images;android-36;default;x86_64' --device pixel_7 > "$evidence/avd-create.log" 2>&1
"$emu" -avd "$avd" -port 5554 -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -accel on -no-snapshot -no-metrics -cores 4 -memory 4096 > "$evidence/emulator.log" 2>&1 &
avd_pid=$!
booted=0
for _ in $(seq 1 65); do
  kill -0 "$avd_pid"
  if [[ "$(timeout 2 "$adb" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)" == 1 ]]; then booted=1; break; fi
  sleep 2
done
test "$booted" = 1
"$adb" -s "$serial" emu avd name | tr -d '\r' | grep -qx "$avd"
"$adb" -s "$serial" shell getprop ro.product.cpu.abi | tr -d '\r' | tee "$evidence/device-abi.txt" | grep -qx x86_64
timeout 16 "$adb" -s "$serial" shell cmd activity wait-for-broadcast-idle > "$evidence/broadcast-idle.txt" 2>&1 || true
"$adb" -s "$serial" install --no-incremental "$qa/test.apk" | tee "$evidence/install.txt"
"$adb" -s "$serial" shell dumpsys package "$package" | awk '/versionCode=|versionName=/' > "$evidence/version.txt"
grep -q "versionCode=$version_code" "$evidence/version.txt"
grep -q 'versionName=0.8.13' "$evidence/version.txt"
for fixture in A B; do
  endpoint=$(jq -r .address "$qa/$fixture/session-fixture.json")
  server_for "$fixture" pair --url "$endpoint" > "$qa/$fixture/issuer.private" 2>&1
done
python3 "$workspace/.github/qa/opencode-android-pair.py" "$qa" "$adb" "$serial" "$package"
for fixture in A B; do
  python3 - "$qa/$fixture/data/opencode/opencode.db" "$evidence/db-counts-$fixture.txt" "$fixture" <<'PYCOUNTS'
import pathlib, sqlite3, sys
with sqlite3.connect(f'file:{sys.argv[1]}?mode=ro', uri=True) as db:
    result = {table: db.execute(f'SELECT count(*) from {table}').fetchone()[0] for table in ('session_v2', 'session_message', 'account')}
pathlib.Path(sys.argv[2]).write_text('\n'.join(f'{table}|{count}' for table, count in result.items())+'\n')
assert result == {'session_v2': 2 if sys.argv[3] == 'A' else 1, 'session_message': 0, 'account': 0}
PYCOUNTS
done
jq -e '.pairs.A.confirmed and .pairs.B.confirmed and .routes["scoped-A"].cold and .routes["scoped-A"].destinationVisible and .routes["project-draft-A"].destinationVisible and .browserRoute.openCodeAbsentFromResolver' "$qa/proof.json"
