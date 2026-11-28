#!/bin/bash
set -euo pipefail
umask 077
qa=$1
image='docker.io/redroid/redroid@sha256:dc2024a999dd0acb1112a23cddc9537ec8cb60a0dbe5a87ce9fbd75a2f5e94d2'
network=t3-native-arm-qa-net
bridge=t3nativearm0
device=t3-native-arm-qa-device
export ANDROID_USER_HOME="$qa/android-host-home"
mkdir -p "$ANDROID_USER_HOME" "$qa"/data
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
unset BASH_ENV ENV
finish() {
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
"$adb" -s "$serial" shell settings put global window_animation_scale 0
"$adb" -s "$serial" shell settings put global transition_animation_scale 0
"$adb" -s "$serial" shell settings put global animator_duration_scale 0
timeout 100 "$adb" -s "$serial" install --no-incremental "$qa/t3code.apk"
"$adb" -s "$serial" shell dumpsys package com.t3tools.t3code > "$qa/android-package-full.txt"
grep -m2 -E 'versionCode=|versionName=' "$qa/android-package-full.txt" > "$qa/evidence/android-package.txt"
grep -q 'versionCode=833 ' "$qa/evidence/android-package.txt"
grep -q 'versionName=2.4.0' "$qa/evidence/android-package.txt"
app=com.t3tools.t3code
if "$adb" -s "$serial" shell pidof "$app" >/dev/null; then exit 26; fi
python3 .github/qa/t3-add-environment-android.py "$qa" "$adb" "$serial"
