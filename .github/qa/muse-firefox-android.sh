#!/bin/bash
set -euo pipefail
umask 077
qa=$1
phase=initialize
image='docker.io/redroid/redroid@sha256:dc2024a999dd0acb1112a23cddc9537ec8cb60a0dbe5a87ce9fbd75a2f5e94d2'
network=agent-native-arm-qa-net
bridge=agentarmqa0
device=agent-native-arm-qa-device
browser_pid=
export HOME="$qa/android-host-home"
mkdir -p "$HOME" "$qa"/{home,state,fixture,data}
adb="$qa/owned-adb"
cat > "$adb" <<'ADB'
#!/bin/bash
exec /usr/bin/adb -P 5038 "$@"
ADB
chmod 700 "$adb"
serial=
booted=0
container_created=0
network_created=0
egress_guard=0
declare -a public_allow=()
guest_ip=
dns_started=0

close_domain_network() {
  for endpoint in "${public_allow[@]}"; do
    read -r ip tcp_port <<<"$endpoint"
    sudo iptables -D DOCKER-USER -i "$bridge" -s "$guest_ip" -d "$ip" -p tcp --dport "$tcp_port" -j RETURN || true
    sudo iptables -t nat -D POSTROUTING -s "$guest_ip" -d "$ip" -p tcp --dport "$tcp_port" -j MASQUERADE || true
  done
  public_allow=()
  if [[ "$dns_started" == 1 ]]; then
    sudo kill "$(cat "$qa/domain-dns.pid")" 2>/dev/null || true
    dns_started=0
  fi
}

finish() {
  local rc=$?
  if [[ -n "$browser_pid" ]]; then kill "$browser_pid" 2>/dev/null || true; fi
  close_domain_network
  if [[ "$container_created" == 1 ]]; then
    docker logs --tail 120 "$device" > "$qa/evidence/container-boot.log" 2>&1 || true
    if [[ "$booted" == 0 ]]; then
      docker inspect --format '{{json .State}}' "$device" > "$qa/evidence/boot-container-state.json" 2>&1 || true
      {
        for key in sys.boot_completed init.svc.adbd ro.product.cpu.abi ro.boot.use_memfd dev.bootcomplete; do
          printf '%s: ' "$key"
          timeout 4 docker exec "$device" /system/bin/getprop "$key" || true
        done
        docker port "$device" 5555/tcp || true
        grep -E "^([* ]|cannot|failed|connected|already)" "$qa/adb-connect.log" || true
      } > "$qa/evidence/boot-guest-and-transport.txt" 2>&1
      timeout 8 docker exec "$device" /system/bin/logcat -b main -b system -b crash -d -t 160 \
        > "$qa/evidence/boot-guest-logcat.txt" 2>&1 || true
      timeout 8 docker exec "$device" /system/bin/logcat -b crash -d -t 80 \
        > "$qa/evidence/boot-guest-crash.txt" 2>&1 || true
    fi
    docker rm -f "$device" >/dev/null 2>&1 || true
  fi
  if [[ "$egress_guard" == 1 ]]; then
    sudo iptables -D DOCKER-USER -i "$bridge" -j REJECT || true
  fi
  if [[ "$network_created" == 1 ]]; then docker network rm "$network" >/dev/null 2>&1 || true; fi
  "$adb" kill-server >/dev/null 2>&1 || true
  {
    printf '### Muse Android QA\n\n- Terminal phase: %s\n- Exit code: %s\n' "$phase" "$rc"
    for name in android-runtime.txt com.facebook.aura-version.txt org.mozilla.firefox-version.txt app-links.txt \
      stock-android-result.txt firefox-preference.txt browser-events.jsonl native-input.txt result.txt; do
      if [[ -s "$qa/evidence/$name" ]]; then
        printf '\n**%s**\n\n```text\n' "$name"
        head -16 "$qa/evidence/$name"
        printf '\n```\n'
      fi
    done
    printf '\n**Labels from the last visible checkpoint**\n\n```text\n'
    python3 - "$qa/evidence" <<'PY'
import pathlib, sys, xml.etree.ElementTree as ET
files = sorted(pathlib.Path(sys.argv[1]).glob("*.xml"), key=lambda file: file.stat().st_mtime)
if files:
    print(files[-1].name)
    for text in dict.fromkeys(n.get("text") or n.get("content-desc") for n in ET.parse(files[-1]).iter("node")):
        if text:
            print(text[:150])
PY
    printf '\n```\n'
  } | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
test "$(uname -m)" = aarch64
test "$(docker image inspect --format '{{.Architecture}}' "$image")" = arm64
phase=start-stock-arm-android
test -z "$(docker ps -aq --filter "name=^/${device}$")"
"$adb" start-server >/dev/null
test -z "$("$adb" devices | awk 'NR > 1 && NF {print $1}')"
docker network create --driver bridge --ipv6=false \
  --opt "com.docker.network.bridge.name=$bridge" \
  --opt com.docker.network.bridge.enable_ip_masquerade=false "$network" > /dev/null
network_created=1
test "$(docker network inspect --format '{{.EnableIPv6}}' "$network")" = false
sudo iptables -I DOCKER-USER 1 -i "$bridge" -j REJECT
egress_guard=1
sudo iptables -C DOCKER-USER -i "$bridge" -j REJECT
dns_gateway=$(docker network inspect --format '{{(index .IPAM.Config 0).Gateway}}' "$network")
docker run -d --name "$device" --platform linux/arm64 --privileged --network "$network" \
  --dns "$dns_gateway" --publish 127.0.0.1:5555:5555 \
  --mount "type=bind,src=$qa/data,dst=/data" "$image" \
  androidboot.use_memfd=1 androidboot.redroid_gpu_mode=guest \
  androidboot.redroid_net_ndns=1 "androidboot.redroid_net_dns1=$dns_gateway" \
  androidboot.redroid_width=540 androidboot.redroid_height=1200 androidboot.redroid_dpi=210 > /dev/null
container_created=1
test "$(docker port "$device" 5555/tcp)" = 127.0.0.1:5555
guest_ip=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$device")
python3 - "$guest_ip" "$dns_gateway" <<'PYIP'
import ipaddress, sys
for value in sys.argv[1:]:
    address = ipaddress.ip_address(value)
    assert address.is_private and address.version == 4
PYIP
printf '%s\n' "Loopback-only ADB published. Forwarded egress from the dedicated IPv4 bridge is denied." \
  | tee "$qa/evidence/transport-boundary.txt"
serial=127.0.0.1:5555
end=$((SECONDS + 165))
while (( SECONDS < end )); do
  test "$(docker inspect --format '{{.State.Running}}' "$device")" = true
  if [[ $(timeout 3 docker exec "$device" /system/bin/getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true) == 1 ]]; then
    timeout 4 "$adb" connect "$serial" > "$qa/adb-connect.log" 2>&1 || true
    if [[ $(timeout 4 "$adb" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true) == 1 ]]; then
      booted=1
      break
    fi
  fi
  sleep 3
done
test "$booted" = 1
printf '%s\n' 'Android reported completed boot through direct guest inspection and ADB.'
test "$("$adb" devices | awk 'NR > 1 && NF {print $1,$2}')" = "$serial device"
test "$("$adb" -s "$serial" shell uname -m | tr -d '\r')" = aarch64
test "$("$adb" -s "$serial" shell getprop ro.build.version.sdk | tr -d '\r')" = 35
guest_abi=$("$adb" -s "$serial" shell getprop ro.product.cpu.abi | tr -d '\r')
native_bridge=$("$adb" -s "$serial" shell getprop ro.dalvik.vm.native.bridge | tr -d '\r')
test "$guest_abi" = arm64-v8a
test -z "$native_bridge" || test "$native_bridge" = 0
{
  printf 'guestArchitecture=aarch64\nsdk=35\nprimaryCpuAbi=%s\nbridge=%s\n' "$guest_abi" "${native_bridge:-none}"
  "$adb" -s "$serial" shell getprop ro.product.cpu.abilist
  "$adb" -s "$serial" shell id
} | tee "$qa/evidence/android-runtime.txt"
function a { timeout 16 "$adb" -s "$serial" "$@"; }
a shell settings put global window_animation_scale 0
a shell settings put global transition_animation_scale 0
a shell settings put global animator_duration_scale 0
a shell settings put system screen_off_timeout 600000
a shell input keyevent KEYCODE_WAKEUP
a shell wm dismiss-keyguard || true
app=com.facebook.aura
browser=org.mozilla.firefox
route=$(cat "$qa/evidence/emitted-route.txt")
test "$route" = 'https://agent.meta.ai/chat'
port=43777
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
phase=install-pinned-apps
timeout 100 "$adb" -s "$serial" install --no-incremental "$qa/firefox.apk"
a shell cmd package resolve-activity --brief -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE -d "$route" > "$qa/evidence/before-muse-install.txt"
! grep -Fq "$app/" "$qa/evidence/before-muse-install.txt"
timeout 100 "$adb" -s "$serial" install --no-incremental "$qa/muse.apk"
for pkg in "$app" "$browser"; do
  a shell dumpsys package "$pkg" | awk '/versionName=|versionCode=/ && !seen[$0]++' > "$qa/evidence/$pkg-version.txt"
done
grep -Fq 'versionName=18.0.0.8.161' "$qa/evidence/$app-version.txt"
grep -Fq 'versionName=161.0' "$qa/evidence/$browser-version.txt"
a shell pm path com.android.statementservice | grep -E '^package:/system(_ext)?/' > "$qa/evidence/stock-verifier.txt"
phase=verify-publisher-domain
{
  for target in 'applink.muse.ai 443' 'agent.meta.ai 443' 'muse.ai 443' 'www.muse.ai 443' 'connectivitycheck.gstatic.com 80' 'www.google.com 443'; do
    read -r domain tcp_port <<<"$target"
    getent ahostsv4 "$domain" | awk -v domain="$domain" -v port="$tcp_port" '{print domain,port,$1}' | sort -u
  done
} > "$qa/evidence/domain-network-allowlist.txt"
python3 - "$qa/evidence/domain-network-allowlist.txt" <<'PY'
import ipaddress, pathlib, sys
rows = [line.split() for line in pathlib.Path(sys.argv[1]).read_text().splitlines()]
assert {"applink.muse.ai", "agent.meta.ai"} <= {row[0] for row in rows}
assert all(ipaddress.ip_address(ip).is_global and ipaddress.ip_address(ip).version == 4 for _, _, ip in rows)
PY
dns_args=()
while read -r domain tcp_port ip; do
  dns_args+=("--host-record=$domain,$ip")
  public_allow+=("$ip $tcp_port")
  sudo iptables -t nat -A POSTROUTING -s "$guest_ip" -d "$ip" -p tcp --dport "$tcp_port" -j MASQUERADE
  sudo iptables -I DOCKER-USER 1 -i "$bridge" -s "$guest_ip" -d "$ip" -p tcp --dport "$tcp_port" -j RETURN
done < "$qa/evidence/domain-network-allowlist.txt"
sudo dnsmasq --conf-file=/dev/null --listen-address="$dns_gateway" --bind-interfaces \
  --no-resolv --no-hosts --pid-file="$qa/domain-dns.pid" "${dns_args[@]}"
dns_started=1
a shell pm verify-app-links --re-verify "$app"
end=$((SECONDS + 120))
while (( SECONDS < end )); do
  a shell pm get-app-links --user 0 "$app" > "$qa/evidence/app-links.txt"
  if grep -Eq '^ +agent[.]meta[.]ai: verified' "$qa/evidence/app-links.txt"; then break; fi
  sleep 4
done
grep -Eq '^ +agent[.]meta[.]ai: verified' "$qa/evidence/app-links.txt"
close_domain_network
sudo iptables -C DOCKER-USER -i "$bridge" -j REJECT
printf '%s\n' 'All forwarded guest egress denied after genuine Android App Links verification.' >> "$qa/evidence/transport-boundary.txt"

function capture {
  local label=$1
  a exec-out screencap -p > "$qa/evidence/$label.png" || true
  a shell uiautomator dump /data/local/tmp/owned-muse-browser.xml >/dev/null 2>&1 || return 1
  a pull /data/local/tmp/owned-muse-browser.xml "$qa/evidence/$label.xml" >/dev/null 2>&1
}
function foreground {
  a shell dumpsys activity activities | grep -m4 -E 'topResumedActivity|mResumedActivity' || true
}
function has_label {
  python3 "$here/muse-firefox-label.py" "$qa/evidence/$1.xml" "$2" "$3" --exists
}
phase=stock-current-muse-native-baseline
a shell am force-stop "$app"
a shell cmd package resolve-activity --brief -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE -d "$route" > "$qa/evidence/stock-android-resolve.txt"
a shell am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE \
  -d "$route" > "$qa/evidence/stock-android-start.txt" 2>&1 || true
for attempt in {1..6}; do
  sleep 2
  foreground > "$qa/evidence/stock-android-foreground.txt"
  if grep -Fq "$app/" "$qa/evidence/stock-android-foreground.txt" && capture stock-android &&
    has_label stock-android "$app" 'Welcome to Muse'; then break; fi
done
grep -Fq "$app/" "$qa/evidence/stock-android-foreground.txt"
has_label stock-android "$app" 'Welcome to Muse'
grep -Eqi 'Mobile number or email|Log in' "$qa/evidence/stock-android.xml"
printf '%s\n' 'Current Meta-signed Muse 18.0.0.8.161 launched from the stock untargeted exact displayed Android route and showed its native sign-in screen. No account used.' > "$qa/evidence/stock-android-result.txt"
a shell am force-stop "$app"

phase=start-loopback-browser-fixture
node "$here/muse-firefox-fixture.mjs" "$qa" "$port" > "$qa/evidence/browser-events.jsonl" &
browser_pid=$!
for attempt in {1..20}; do
  if curl -fsS --max-time 2 "http://127.0.0.1:$port/health" >/dev/null; then break; fi
  sleep 1
done
curl -fsS --max-time 6 "http://127.0.0.1:$port/health" >/dev/null
a reverse "tcp:$port" "tcp:$port"
function tap_label {
  local checkpoint=$1 pkg=$2 label=$3
  local where
  where=$(python3 "$here/muse-firefox-label.py" "$qa/evidence/$checkpoint.xml" "$pkg" "$label") || return 1
  printf '%s\t%s\t%s\n' "$checkpoint" "$label" "$where" >> "$qa/evidence/native-input.txt"
  read -r x y <<<"$where"
  a shell input tap "$x" "$y"
}
function open_fixture {
  local mode=$1
  a shell am start -a android.intent.action.VIEW -c android.intent.category.BROWSABLE \
    -d "http://127.0.0.1:$port/$mode" -p "$browser" > "$qa/evidence/$mode-browser-start.txt"
  for step in {1..7}; do
    sleep 3
    capture "$mode-browser" || continue
    if grep -Fq 'Open Meta Muse' "$qa/evidence/$mode-browser.xml"; then return; fi
    for button in 'Start browsing' 'Skip sign-in' 'Skip' 'Not now'; do
      if tap_label "$mode-browser" "$browser" "$button"; then break; fi
    done
  done
  return 1
}

phase=first-firefox-browser-load
open_fixture icon-and-name
phase=default-firefox-browser-tap
if ! tap_label icon-and-name-browser "$browser" 'Open Meta Muse'; then
  exit 31
fi
sleep 5
capture default-after-tap || true
foreground > "$qa/evidence/default-after-tap-foreground.txt"
if grep -Fq "$app/" "$qa/evidence/default-after-tap-foreground.txt"; then
  printf '%s\n' 'Firefox default forwarded the anchor to Muse.' > "$qa/evidence/firefox-preference.txt"
else
  if tap_label default-after-tap "$browser" 'Open'; then
    sleep 5
    capture default-after-confirm || true
    foreground > "$qa/evidence/default-after-tap-foreground.txt"
  fi
fi

if ! grep -Fq "$app/" "$qa/evidence/default-after-tap-foreground.txt"; then
  phase=firefox-open-links-preference
  printf '%s\n' 'Firefox default did not dispatch the HTTPS link to the installed app. Test a documented Firefox preference in the disposable profile.' > "$qa/evidence/firefox-preference.txt"
  open_fixture icon-and-name
  capture firefox-menu-before
  if ! tap_label firefox-menu-before "$browser" 'More options'; then
    tap_label firefox-menu-before "$browser" 'Menu'
  fi
  sleep 2
  capture firefox-menu
  tap_label firefox-menu "$browser" 'Settings'
  sleep 2
  for scroll in {1..7}; do
    capture "firefox-settings-$scroll"
    if tap_label "firefox-settings-$scroll" "$browser" 'Open links in apps'; then break; fi
    a shell input swipe 250 925 250 390 420
    sleep 1
  done
  sleep 2
  capture firefox-links-setting
  tap_label firefox-links-setting "$browser" 'Always'
  printf '%s\n' 'Selected the stock Always choice for Open links in apps in this disposable profile.' >> "$qa/evidence/firefox-preference.txt"
  a shell input keyevent KEYCODE_BACK
fi

for mode in icon-and-name icon-only; do
  phase="browser-tap-$mode"
  a shell am force-stop "$app"
  if a shell pidof "$app" > "$qa/evidence/$mode-muse-pids-before.txt"; then
    test ! -s "$qa/evidence/$mode-muse-pids-before.txt"
  fi
  open_fixture "$mode"
  foreground > "$qa/evidence/$mode-before-foreground.txt"
  grep -Fq "$browser/" "$qa/evidence/$mode-before-foreground.txt"
  tap_label "$mode-browser" "$browser" 'Open Meta Muse'
  for wait in {1..8}; do
    sleep 3
    foreground > "$qa/evidence/$mode-after-foreground.txt"
    if grep -Fq "$app/" "$qa/evidence/$mode-after-foreground.txt"; then
      if capture "$mode-native" && has_label "$mode-native" "$app" 'Welcome to Muse'; then break; fi
    else
      capture "$mode-browser-after" || continue
      if tap_label "$mode-browser-after" "$browser" 'Open'; then continue; fi
    fi
  done
  grep -Fq "$app/" "$qa/evidence/$mode-after-foreground.txt"
  has_label "$mode-native" "$app" 'Welcome to Muse'
  grep -Eqi 'Mobile number or email|Log in' "$qa/evidence/$mode-native.xml"
  a shell pidof "$app" > "$qa/evidence/$mode-muse-pids-after.txt"
done
phase=verify-trusted-touch-events
jq -es --arg route "$route" '
  all(["icon-and-name", "icon-only"][]; . as $mode |
    any($events[]; .type == "touch" and .mode == $mode and .href == $route and .trusted == true and .active == true))
' "$qa/evidence/browser-events.jsonl" --slurpfile events "$qa/evidence/browser-events.jsonl"
printf '%s\n' 'Both touch gestures from stock Firefox opened the Meta-signed app to its native sign-in screen.' > "$qa/evidence/result.txt"
phase=complete
