#!/bin/sh
set -eu

INSTALL_DIR=/usr/local/lib/pd-portal-e2e-auth
UNIT_DIR=/etc/systemd/system
CREDENTIAL_DIR=/etc/credstore.encrypted/pd-portal-e2e-auth.service
CREDENTIAL_PATH=$CREDENTIAL_DIR/supabase-service-role-key.cred
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

fail() {
  printf '%s\n' "FAIL $1" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || fail root-required
[ "${1-}" = "--credential-stdin" ] || [ "${1-}" = "--reuse-credential" ] || \
  fail 'usage: install-host.sh --credential-stdin|--reuse-credential'

install -d -o root -g root -m 0755 "$INSTALL_DIR"
for source in broker.mjs constants.mjs guards.mjs redaction.mjs; do
  install -o root -g root -m 0644 "$SCRIPT_DIR/$source" "$INSTALL_DIR/$source"
done
install -o root -g root -m 0644 \
  "$REPO_ROOT/infra/systemd/pd-portal-e2e-auth.service" \
  "$REPO_ROOT/infra/systemd/pd-portal-e2e-auth.socket" \
  "$UNIT_DIR/"

install -d -o root -g root -m 0700 "$CREDENTIAL_DIR"
if [ "$1" = "--credential-stdin" ]; then
  umask 077
  systemd-creds encrypt --with-key=host --name=supabase-service-role-key \
    - "$CREDENTIAL_PATH"
else
  [ -f "$CREDENTIAL_PATH" ] || fail credential-missing
  [ ! -L "$CREDENTIAL_PATH" ] || fail credential-symlink
fi
chown root:root "$CREDENTIAL_PATH"
chmod 0400 "$CREDENTIAL_PATH"

systemctl daemon-reload
systemctl enable --now pd-portal-e2e-auth.socket
printf '%s\n' 'PASS host-installed'
