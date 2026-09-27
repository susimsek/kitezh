#!/usr/bin/env sh
set -eu

repository_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "Git repository bulunamadı." >&2
  exit 1
}

hooks_path="$repository_root/.githooks"
pre_push_hook="$hooks_path/pre-push"

if [ ! -f "$pre_push_hook" ]; then
  echo "Pre-push hook bulunamadı: $pre_push_hook" >&2
  exit 1
fi

chmod +x "$pre_push_hook"
git -C "$repository_root" config --local core.hooksPath .githooks

echo "Git hooks etkinleştirildi: .githooks"
if [ -z "${SONARQUBE_TOKEN:-${SONAR_TOKEN:-}}" ]; then
  echo "Sonar tokenı tanımlı değil; pre-push Sonar taraması atlanacak."
else
  echo "Sonar tokenı bulundu; pre-push Sonar taraması çalıştırılacak."
fi
