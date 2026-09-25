#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
RUNTIME_DIR="/srv/docker/liveticker/dev/worker"
SOURCE_WORKER="${SCRIPT_DIR}/publishing_worker_dev.py"
SOURCE_REALTIME="${SCRIPT_DIR}/realtime_wake.py"
TARGET_WORKER="${RUNTIME_DIR}/publishing_worker_dev.py"
TARGET_REALTIME="${RUNTIME_DIR}/realtime_wake.py"
REALTIME_KEY="/srv/docker/liveticker/dev/secrets/realtime_publishable_key"
EXPECTED_REMOTE_FRAGMENT="Plaerrdeifl/portal-v4-dev"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

ok() {
  printf '%-28s %s\n' "$1" "OK"
}

[[ -f "${SOURCE_WORKER}" ]] || fail "Source worker missing: ${SOURCE_WORKER}"
[[ -f "${SOURCE_REALTIME}" ]] || fail "Source Realtime module missing: ${SOURCE_REALTIME}"
[[ -d "${RUNTIME_DIR}" ]] || fail "Runtime directory missing: ${RUNTIME_DIR}"
[[ -s "${REALTIME_KEY}" ]] || fail "Realtime publishable-key file missing: ${REALTIME_KEY}"

REMOTE_URL="$(git -C "${REPO_ROOT}" remote get-url origin 2>/dev/null || true)"
[[ "${REMOTE_URL}" == *"${EXPECTED_REMOTE_FRAGMENT}"* ]] || fail "Refusing deploy: origin is not portal-v4-dev"

python3 - "${SOURCE_WORKER}" "${SOURCE_REALTIME}" <<'PY'
import pathlib
import sys

for name in sys.argv[1:]:
    path = pathlib.Path(name)
    compile(path.read_text(encoding="utf-8"), str(path), "exec")
PY
ok "worker syntax"

install -m 0644 -- "${SOURCE_WORKER}" "${TARGET_WORKER}"
install -m 0644 -- "${SOURCE_REALTIME}" "${TARGET_REALTIME}"

verify_same() {
  local source="$1"
  local target="$2"
  local label="$3"
  local source_hash target_hash
  source_hash="$(sha256sum -- "${source}" | awk '{print $1}')"
  target_hash="$(sha256sum -- "${target}" | awk '{print $1}')"
  [[ "${source_hash}" == "${target_hash}" ]] || fail "Hash mismatch: ${label}"
  ok "${label}"
}

verify_same "${SOURCE_WORKER}" "${TARGET_WORKER}" "publishing_worker_dev.py"
verify_same "${SOURCE_REALTIME}" "${TARGET_REALTIME}" "realtime_wake.py"

printf '\nDEV publishing worker files deployed successfully.\n'
printf 'Service was NOT restarted.\n'
