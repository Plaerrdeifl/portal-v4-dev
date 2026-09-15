#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
RUNTIME_DIR="/srv/docker/liveticker/whatsapp-worker"
SOURCE_WORKER="${SCRIPT_DIR}/worker.mjs"
SOURCE_DELIVERY="${SCRIPT_DIR}/delivery.mjs"
SOURCE_ASSETS="${SCRIPT_DIR}/assets"
TARGET_WORKER="${RUNTIME_DIR}/worker.mjs"
TARGET_DELIVERY="${RUNTIME_DIR}/delivery.mjs"
TARGET_ASSETS="${RUNTIME_DIR}/assets"
NODE_BIN="/home/benny/.nvm/versions/node/v24.20.0/bin/node"
EXPECTED_REMOTE_FRAGMENT="Plaerrdeifl/portal-v4-dev"
EXPECTED_PROJECT_REF="tpieykhhawszlzsoflnl"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

ok() {
  printf '%-24s %s\n' "$1" "OK"
}

[[ -x "${NODE_BIN}" ]] || fail "Node binary missing: ${NODE_BIN}"
[[ -f "${SOURCE_WORKER}" ]] || fail "Source worker missing: ${SOURCE_WORKER}"
[[ -f "${SOURCE_DELIVERY}" ]] || fail "Source delivery module missing: ${SOURCE_DELIVERY}"
[[ -d "${SOURCE_ASSETS}" ]] || fail "Source assets missing: ${SOURCE_ASSETS}"
[[ -d "${RUNTIME_DIR}" ]] || fail "Runtime directory missing: ${RUNTIME_DIR}"
[[ -f "${RUNTIME_DIR}/.env" ]] || fail "Runtime .env missing"

REMOTE_URL="$(git -C "${REPO_ROOT}" remote get-url origin 2>/dev/null || true)"
[[ "${REMOTE_URL}" == *"${EXPECTED_REMOTE_FRAGMENT}"* ]] || fail "Refusing deploy: origin is not portal-v4-dev (${REMOTE_URL:-missing})"

grep -Eq '^WORKER_ENVIRONMENT=DEV$' "${RUNTIME_DIR}/.env" || fail "Refusing deploy: runtime WORKER_ENVIRONMENT is not DEV"
grep -Eq "^EXPECTED_SUPABASE_PROJECT_REF=${EXPECTED_PROJECT_REF}$" "${RUNTIME_DIR}/.env" || fail "Refusing deploy: runtime Supabase project ref is not DEV"

"${NODE_BIN}" --check "${SOURCE_WORKER}" >/dev/null
"${NODE_BIN}" --check "${SOURCE_DELIVERY}" >/dev/null
ok "worker syntax"

check_png() {
  local path="$1"
  local name="$2"
  [[ -f "${path}" ]] || fail "Missing asset: ${path}"
  python3 - "${path}" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
data = p.read_bytes()
sig = b"\x89PNG\r\n\x1a\n"
if len(data) < 1024 or not data.startswith(sig):
    raise SystemExit(1)
PY
  ok "${name}"
}

check_png "${SOURCE_ASSETS}/toooor.png" "assets/toooor.png"
check_png "${SOURCE_ASSETS}/strafe.png" "assets/strafe.png"

mkdir -p "${TARGET_ASSETS}"

# Replace only the worker runtime modules. Runtime secrets and sent-journal stay untouched.
tmp_worker="${RUNTIME_DIR}/.worker.mjs.deploy.$$"
cp -- "${SOURCE_WORKER}" "${tmp_worker}"
chmod 0644 "${tmp_worker}"
mv -f -- "${tmp_worker}" "${TARGET_WORKER}"

tmp_delivery="${RUNTIME_DIR}/.delivery.mjs.deploy.$$"
cp -- "${SOURCE_DELIVERY}" "${tmp_delivery}"
chmod 0644 "${tmp_delivery}"
mv -f -- "${tmp_delivery}" "${TARGET_DELIVERY}"

# The repository is authoritative only for TARGET_ASSETS. Nothing outside it is deleted.
rsync -a --delete --exclude='.DS_Store' -- "${SOURCE_ASSETS}/" "${TARGET_ASSETS}/"

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

verify_same "${SOURCE_WORKER}" "${TARGET_WORKER}" "worker.mjs"
verify_same "${SOURCE_DELIVERY}" "${TARGET_DELIVERY}" "delivery.mjs"
verify_same "${SOURCE_ASSETS}/toooor.png" "${TARGET_ASSETS}/toooor.png" "toooor.png"
verify_same "${SOURCE_ASSETS}/strafe.png" "${TARGET_ASSETS}/strafe.png" "strafe.png"

printf '\nDEV worker files deployed successfully.\n'
printf 'Service was NOT restarted.\n'
