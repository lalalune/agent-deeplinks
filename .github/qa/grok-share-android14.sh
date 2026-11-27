#!/bin/bash
set -euo pipefail
umask 077
qa=$1
image='docker.io/redroid/redroid@sha256:d9ef29d08c5e7ff6d4771a9894d4df47725d9a733dc251c47bc40782cc86359a'
network=agent-native-arm-qa-net
bridge=agentarmqa0
device=agent-native-arm-qa-device
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
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
test "$(uname -m)" = aarch64
test "$(docker image inspect --format '{{.Architecture}}' "$image")" = arm64
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
test "$("$adb" -s "$serial" shell getprop ro.build.version.sdk | tr -d '\r')" = 34
guest_abi=$("$adb" -s "$serial" shell getprop ro.product.cpu.abi | tr -d '\r')
native_bridge=$("$adb" -s "$serial" shell getprop ro.dalvik.vm.native.bridge | tr -d '\r')
test "$guest_abi" = arm64-v8a
test -z "$native_bridge" || test "$native_bridge" = 0
{
  printf 'guestArchitecture=aarch64\nsdk=34\nprimaryCpuAbi=%s\nbridge=%s\n' "$guest_abi" "${native_bridge:-none}"
  "$adb" -s "$serial" shell getprop ro.product.cpu.abilist
  "$adb" -s "$serial" shell id
} | tee "$qa/evidence/android-runtime.txt"
function a { timeout 16 "$adb" -s "$serial" "$@"; }
a shell settings put global window_animation_scale 0
a shell settings put global transition_animation_scale 0
a shell settings put global animator_duration_scale 0
a shell input keyevent KEYCODE_WAKEUP
a shell wm dismiss-keyguard || true
pkg=ai.x.grok
share=$(jq -er .native "$qa/evidence/published-links.json")
browser=$(jq -er .browser "$qa/evidence/published-links.json")
a shell cmd package resolve-activity --brief -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE -d "$share" > "$qa/evidence/preinstall-share.txt" 2>&1 || true
{
  for google_package in com.google.android.gms com.android.vending; do
    installed_path=$(a shell pm path "$google_package" || true)
    if [[ -n "$installed_path" ]]; then
      printf '%s: %s\n' "$google_package" "$installed_path"
    else
      printf '%s: absent\n' "$google_package"
    fi
  done
} > "$qa/evidence/google-services.txt"

timeout 110 "$adb" -s "$serial" install-multiple --no-incremental "$qa"/grok/*.apk
a shell dumpsys package "$pkg" | awk '/versionName=|versionCode=/ && !seen[$0]++' | head -5 > "$qa/evidence/$pkg-version.txt"
a shell pm get-app-links --user 0 "$pkg" > "$qa/evidence/$pkg-before.txt"
if a shell pidof "$pkg"; then exit 26; fi
a shell pm path com.android.statementservice | tee "$qa/evidence/stock-verifier.txt"
grep -Eq '^package:/system(_ext)?/' "$qa/evidence/stock-verifier.txt"

{
  for target in 'grok.com 443' 'connectivitycheck.gstatic.com 80' 'www.google.com 443'; do
    read -r domain tcp_port <<<"$target"
    getent ahostsv4 "$domain" | awk -v domain="$domain" -v port="$tcp_port" '{print domain,port,$1}' | sort -u
  done
} > "$qa/evidence/domain-network-allowlist.txt"
python3 - "$qa/evidence/domain-network-allowlist.txt" <<'PYALLOW'
import ipaddress, pathlib, sys
rows = [line.split() for line in pathlib.Path(sys.argv[1]).read_text().splitlines()]
assert {"grok.com"} <= {row[0] for row in rows}
for _, _, value in rows:
    address = ipaddress.ip_address(value)
    assert address.version == 4 and address.is_global
PYALLOW
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
a shell pm verify-app-links --re-verify "$pkg"
end=$((SECONDS + 120))
while (( SECONDS < end )); do
  a shell pm get-app-links --user 0 "$pkg" > "$qa/evidence/$pkg-after.txt"
  if grep -Eq '^ +grok[.]com: verified' "$qa/evidence/$pkg-after.txt"; then break; fi
  sleep 4
done
a shell pm get-app-link-owners --user 0 grok.com > "$qa/evidence/grok.com-owners.txt" 2>&1 || true
close_domain_network
sudo iptables -C DOCKER-USER -i "$bridge" -j REJECT
printf '%s\n' 'Verified destination allowances removed before all app launches.' >> "$qa/evidence/transport-boundary.txt"

grep -Eq '^ +grok[.]com: verified' "$qa/evidence/$pkg-after.txt"

probe() {
  local label=$1 pkg=$2 href=$3
  printf '%s\n' "$href" > "$qa/evidence/$label-request.txt"
  a shell am force-stop "$pkg"
  a shell cmd package resolve-activity --brief -a android.intent.action.VIEW \
    -c android.intent.category.BROWSABLE -d "'$href'" > "$qa/evidence/$label-resolve.txt" 2>&1 || true
  a shell cmd package query-activities --brief -a android.intent.action.VIEW \
    -c android.intent.category.BROWSABLE -d "'$href'" > "$qa/evidence/$label-candidates.txt" 2>&1 || true
  a shell am start -W -a android.intent.action.VIEW \
    -c android.intent.category.BROWSABLE -d "'$href'" > "$qa/evidence/$label-start.txt" 2>&1 || true
  sleep 6
  a shell dumpsys activity activities | grep -m4 -E 'topResumedActivity|mResumedActivity' \
    > "$qa/evidence/$label-resumed.txt" || true
  a shell uiautomator dump "/data/local/tmp/$label.xml" >/dev/null 2>&1 || true
  a pull "/data/local/tmp/$label.xml" "$qa/evidence/$label-ui.xml" >/dev/null 2>&1 || true
  a exec-out screencap -p > "$qa/evidence/$label.png" 2>/dev/null || true
  if grep -Fq "$pkg/" "$qa/evidence/$label-resumed.txt"; then
    printf 'Stock ACTION_VIEW displayed window from %s.\n' "$pkg" > "$qa/evidence/$label-result.txt"
  else
    printf 'Stock ACTION_VIEW did not display a window from %s. See selected and resumed activities.\n' "$pkg" > "$qa/evidence/$label-result.txt"
  fi
  a shell am force-stop "$pkg"
}
probe grok-share-plain "$pkg" "$share"
probe grok-share-flagged "$pkg" "$browser"
cat "$qa"/evidence/*-result.txt

for variant in plain flagged; do
  grep -Eq 'Status: ok|Activity:' "$qa/evidence/grok-share-$variant-start.txt"
  test -s "$qa/evidence/grok-share-$variant-resumed.txt"
done
