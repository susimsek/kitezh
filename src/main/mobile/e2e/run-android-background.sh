#!/usr/bin/env bash
set -euo pipefail

mobile_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$mobile_dir"

for executable in adb curl grep maestro node pnpm; do
  if ! command -v "$executable" >/dev/null 2>&1; then
    printf 'Required executable not found: %s\n' "$executable" >&2
    exit 1
  fi
done

run_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/kitezh-android-e2e"
mkdir -p "$run_dir"

android_serial="${ANDROID_SERIAL:-}"
if [[ -z "$android_serial" ]]; then
  android_serial="$(adb devices | awk '$2 == "device" && $1 ~ /^emulator-/ { print $1; exit }')"
fi
if [[ -z "$android_serial" ]]; then
  printf 'No connected Android emulator was found.\n' >&2
  exit 1
fi

adb -s "$android_serial" wait-for-device
for attempt in $(seq 1 60); do
  if [[ "$(adb -s "$android_serial" shell getprop sys.boot_completed | tr -d '\r')" == "1" ]]; then
    break
  fi
  if [[ "$attempt" == "60" ]]; then
    printf 'Android emulator did not finish booting.\n' >&2
    exit 1
  fi
  sleep 2
done

fixture_pid=""
metro_pid=""
cleanup() {
  [[ -z "$metro_pid" ]] || kill "$metro_pid" 2>/dev/null || true
  [[ -z "$fixture_pid" ]] || kill "$fixture_pid" 2>/dev/null || true
}
trap cleanup EXIT

node e2e/fixture-server.mjs --host 0.0.0.0 --port 8080 > "$run_dir/fixture.log" 2>&1 &
fixture_pid=$!
export REACT_NATIVE_PACKAGER_HOSTNAME="10.0.2.2"
export EXPO_PUBLIC_AUTHORIZATION_SERVER_ISSUER="http://10.0.2.2:8080"
pnpm exec expo start --host lan --port 8081 --dev-client > "$run_dir/metro.log" 2>&1 &
metro_pid=$!

fixture_ready=false
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:8080/health >/dev/null; then
    fixture_ready=true
    break
  fi
  sleep 1
done
test "$fixture_ready" = true

metro_ready=false
for attempt in $(seq 1 60); do
  if curl --fail --silent http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
    metro_ready=true
    break
  fi
  sleep 1
done
test "$metro_ready" = true

CI=1 pnpm exec expo prebuild --clean --platform android
if ! (cd android && ./gradlew --no-daemon --stacktrace assembleDebug) > "$run_dir/gradle.log" 2>&1; then
  tail -n 120 "$run_dir/gradle.log" >&2
  exit 1
fi

apk_path="android/app/build/outputs/apk/debug/app-debug.apk"
test -f "$apk_path"
adb -s "$android_serial" install -r "$apk_path"
adb -s "$android_serial" shell monkey -p io.github.susimsek.kitezh.mobile 1 >/dev/null

maestro test --device "$android_serial" e2e/maestro/cold-start.yaml
maestro test --device "$android_serial" e2e/maestro/settings-locale-theme.yaml
maestro test --device "$android_serial" e2e/maestro/deep-links.yaml
maestro test --device "$android_serial" e2e/maestro/authenticated-fixture.yaml
