#!/usr/bin/env bash
set -euo pipefail

mobile_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$mobile_dir"

if ! command -v maestro >/dev/null 2>&1 && [[ -x "$HOME/.maestro/bin/maestro" ]]; then
  PATH="$HOME/.maestro/bin:$PATH"
  export PATH
fi

for executable in maestro node pnpm xcodebuild xcrun; do
  if ! command -v "$executable" >/dev/null 2>&1; then
    printf 'Required executable not found: %s\n' "$executable" >&2
    exit 1
  fi
done

run_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/kitezh-ios-e2e"
derived_data_dir="$run_dir/derived-data"
mkdir -p "$run_dir"
fixture_port="${FIXTURE_PORT:-9090}"

if [[ -n "${SIMULATOR_UDID:-}" ]]; then
  simulator_udid="$SIMULATOR_UDID"
else
  simulator_udid="$(xcrun simctl list devices available -j | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const devices = Object.values(JSON.parse(input).devices).flat();
      const selected = devices.find((device) => device.state === "Booted" && device.name.includes("iPhone"))
        ?? devices.find((device) => device.isAvailable && device.name.includes("iPhone"));
      if (!selected) process.exit(1);
      process.stdout.write(selected.udid);
    });
  ')"
fi

if ! xcrun simctl list devices available -j | node -e '
  let input = "";
  process.stdin.on("data", (chunk) => input += chunk);
  process.stdin.on("end", () => {
    const devices = Object.values(JSON.parse(input).devices).flat();
    const device = devices.find((candidate) => candidate.udid === process.argv[1]);
    process.exit(device?.state === "Booted" ? 0 : 1);
  });
' "$simulator_udid"; then
  xcrun simctl boot "$simulator_udid"
fi
xcrun simctl bootstatus "$simulator_udid" -b

fixture_pid=""
metro_pid=""
cleanup() {
  [[ -z "$metro_pid" ]] || kill "$metro_pid" 2>/dev/null || true
  [[ -z "$fixture_pid" ]] || kill "$fixture_pid" 2>/dev/null || true
}
trap cleanup EXIT

node e2e/fixture-server.mjs --host 0.0.0.0 --port "$fixture_port" > "$run_dir/fixture.log" 2>&1 &
fixture_pid=$!
export REACT_NATIVE_PACKAGER_HOSTNAME="127.0.0.1"
export EXPO_PUBLIC_AUTHORIZATION_SERVER_ISSUER="http://127.0.0.1:$fixture_port"
pnpm exec expo start --port 8081 --dev-client > "$run_dir/metro.log" 2>&1 &
metro_pid=$!

fixture_ready=false
for attempt in $(seq 1 30); do
  if curl --fail --silent "http://127.0.0.1:$fixture_port/health" >/dev/null; then
    fixture_ready=true
    break
  fi
  sleep 1
done
[[ "$fixture_ready" == true ]]

metro_ready=false
for attempt in $(seq 1 60); do
  if curl --fail --silent http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
    metro_ready=true
    break
  fi
  sleep 1
done
[[ "$metro_ready" == true ]]

if [[ "${SKIP_IOS_BUILD:-false}" != "true" ]]; then
  CI=1 pnpm exec expo prebuild --platform ios
  if ! xcodebuild \
    -workspace ios/Kitezh.xcworkspace \
    -scheme Kitezh \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination "platform=iOS Simulator,id=$simulator_udid" \
    -derivedDataPath "$derived_data_dir" \
    CODE_SIGNING_ALLOWED=YES \
    CODE_SIGNING_REQUIRED=YES \
    CODE_SIGN_IDENTITY=- \
    build > "$run_dir/xcodebuild.log" 2>&1; then
    tail -n 100 "$run_dir/xcodebuild.log" >&2
    exit 1
  fi
fi

xcrun simctl install "$simulator_udid" \
  "$derived_data_dir/Build/Products/Debug-iphonesimulator/Kitezh.app"
xcrun simctl launch "$simulator_udid" io.github.susimsek.kitezh.mobile

default_flows=(
  cold-start
  oauth-lifecycle
  settings-locale-theme
  deep-links
  authenticated-fixture
  discovery-unavailable
  discovery-timeout
  session-lifecycle
  mfa-required-actions
  account-mfa
  passkey-login-attempt
  admin-policy-save
  admin-settings-groups
  account-profile
  account-notifications
  account-personal-access-tokens
)
IFS=',' read -r -a selected_flows <<< "${MAESTRO_FLOWS:-${default_flows[*]// /,}}"
for flow in "${selected_flows[@]}"; do
  case "$flow" in
    discovery-unavailable)
      curl --fail --silent --show-error -X POST \
        "http://127.0.0.1:$fixture_port/fixture/discovery-mode?mode=unavailable-once" >/dev/null
      ;;
    discovery-timeout)
      curl --fail --silent --show-error -X POST \
        "http://127.0.0.1:$fixture_port/fixture/discovery-mode?mode=timeout-once" >/dev/null
      ;;
  esac
  maestro test --udid "$simulator_udid" "e2e/maestro/${flow}.yaml"
done
