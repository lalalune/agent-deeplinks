#!/usr/bin/env bash
set -euo pipefail
qa=$1
serial=emulator-5556
adb="$ANDROID_HOME/platform-tools/adb"
emulator="$ANDROID_HOME/emulator/emulator"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
pkg=ai.x.grok
"$emulator" -version > "$qa/evidence/emulator-version.txt"
"$emulator" -avd grok-qa -port 5556 -no-window -no-snapshot -no-audio -no-boot-anim \
  -gpu swiftshader_indirect -accel on > "$qa/emulator.log" 2>&1 &
emulator_pid=$!
trap 'kill "$emulator_pid" 2>/dev/null || true' EXIT
a() { timeout 21 "$adb" -s "$serial" "$@"; }
prop() { a shell getprop "$1" | tr -d '\r'; }
end=$((SECONDS + 215))
until [[ "$(prop sys.boot_completed 2>/dev/null || true)" = 1 ]]; do
  if ((SECONDS >= end)) || ! kill -0 "$emulator_pid" 2>/dev/null; then
    tail -35 "$qa/emulator.log" | tee "$qa/evidence/emulator-boot-failure.txt"
    exit 1
  fi
  sleep 3
done
test "$(prop ro.build.version.sdk)" = 34
guest_abis=$(prop ro.product.cpu.abilist)
app_abi=$(cat "$qa/evidence/app-abi.txt")
{
  for key in ro.build.fingerprint ro.build.version.release ro.build.version.sdk ro.product.cpu.abilist ro.dalvik.vm.native.bridge; do
    printf '%s=%s\n' "$key" "$(prop "$key")"
  done
  for android_package in com.android.statementservice com.google.android.gms com.android.vending; do
    printf '%s %s\n' "$android_package" "$(a shell pm path "$android_package" || true)"
  done
  a shell settings get global captive_portal_mode
} | tee "$qa/evidence/android-runtime.txt"
if [[ ",$guest_abis," != *",$app_abi,"* ]]; then
  printf 'APK split ABI %s is unavailable in emulator list %s.\n' "$app_abi" "$guest_abis" | tee "$qa/evidence/abi-mismatch.txt"
  exit 2
fi
a shell input keyevent KEYCODE_WAKEUP
a shell wm dismiss-keyguard || true
share=$(jq -er .native "$qa/evidence/published-links.json")
browser=$(jq -er .browser "$qa/evidence/published-links.json")
a shell cmd package resolve-activity --brief -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE -d "$share" > "$qa/evidence/preinstall-share.txt" 2>&1 || true
timeout 105 "$adb" -s "$serial" install-multiple --no-incremental "$qa"/grok/*.apk | tee "$qa/evidence/install-result.txt"
a shell dumpsys package "$pkg" | awk '/versionName=|versionCode=|primaryCpuAbi=/ && !seen[$0]++' > "$qa/evidence/app-version.txt"
a shell pm get-app-links --user 0 "$pkg" > "$qa/evidence/domain-before.txt"
a shell pm verify-app-links --re-verify "$pkg"
end=$((SECONDS + 185))
while (( SECONDS < end )); do
  a shell pm get-app-links --user 0 "$pkg" > "$qa/evidence/domain-after.txt"
  if grep -Eq '^ +grok[.]com: verified' "$qa/evidence/domain-after.txt"; then
    break
  fi
  sleep 4
done
a shell pm get-app-link-owners --user 0 grok.com > "$qa/evidence/domain-owners.txt" 2>&1 || true
a logcat -d -v brief -s DomainVerificationService DomainVerificationAgent IntentFilterIntentSvc StatementService \
  > "$qa/evidence/domain-verifier.txt" 2>&1 || true
cat "$qa/evidence/domain-after.txt"
if ! grep -Eq '^ +grok[.]com: verified' "$qa/evidence/domain-after.txt"; then
  echo 'Default App Links verification did not report grok.com verified in 185 seconds.' | tee "$qa/evidence/domain-result.txt"
fi

probe() {
  local label=$1 href=$2
  a shell am force-stop "$pkg"
  a shell cmd package resolve-activity --brief -a android.intent.action.VIEW \
    -c android.intent.category.BROWSABLE -d "'$href'" > "$qa/evidence/$label-resolve.txt" 2>&1 || true
  a shell cmd package query-activities --brief -a android.intent.action.VIEW \
    -c android.intent.category.BROWSABLE -d "'$href'" > "$qa/evidence/$label-candidates.txt" 2>&1 || true
  a shell am start -W -a android.intent.action.VIEW \
    -c android.intent.category.BROWSABLE -d "'$href'" > "$qa/evidence/$label-start.txt" 2>&1 || true
  sleep 6
  a shell dumpsys activity activities | awk '/topResumedActivity|mResumedActivity/' > "$qa/evidence/$label-resumed.txt"
  a shell uiautomator dump "/data/local/tmp/$label.xml" >/dev/null 2>&1 || true
  a pull "/data/local/tmp/$label.xml" "$qa/evidence/$label-ui.xml" >/dev/null 2>&1 || true
  a exec-out screencap -p > "$qa/evidence/$label.png"
  a shell am force-stop "$pkg"
  cat "$qa/evidence/$label-start.txt" "$qa/evidence/$label-resumed.txt"
}
probe share-plain "$share"
probe share-browser-flag "$browser"
