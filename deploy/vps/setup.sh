#!/usr/bin/env bash
# Installs the STAKE resolver as a systemd service (Ubuntu 24.04, run as root from a repo clone).
# Safe to re-run. It never reads or writes resolver/.env: the operator adds the key by hand.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
RESOLVER_DIR="$REPO/resolver"
UNIT=/etc/systemd/system/stake-resolver.service

node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$node_major" -lt 22 ]; then
  echo "Node 22+ is required (found: $(node -v 2>/dev/null || echo none))." >&2
  exit 1
fi

echo "Installing resolver dependencies in $RESOLVER_DIR"
(cd "$RESOLVER_DIR" && npm ci --no-audit --no-fund)

echo "Installing $UNIT"
sed "s|@RESOLVER_DIR@|$RESOLVER_DIR|g" "$REPO/deploy/vps/stake-resolver.service" > "$UNIT"
systemctl daemon-reload
systemctl enable stake-resolver.service

if [ ! -f "$RESOLVER_DIR/.env" ]; then
  cat <<MSG

Service installed and enabled, but NOT started: $RESOLVER_DIR/.env is missing.
  1. cp $RESOLVER_DIR/.env.example $RESOLVER_DIR/.env && chmod 600 $RESOLVER_DIR/.env
  2. Put the resolver key in RESOLVER_PRIVATE_KEY
  3. systemctl start stake-resolver && journalctl -u stake-resolver -f
MSG
  exit 0
fi
chmod 600 "$RESOLVER_DIR/.env"

# Never run two resolvers with the same key (nonce clashes): refuse if one runs outside systemd.
if ! systemctl is-active --quiet stake-resolver.service && pgrep -f "node_modules/.bin/tsx src/index.ts" >/dev/null; then
  cat <<MSG

Service installed and enabled, but NOT started: another resolver process is already running:
$(pgrep -af "node_modules/.bin/tsx src/index.ts")
Stop it first, then start the service:
  pkill -f "node_modules/.bin/tsx src/index.ts"
  systemctl start stake-resolver && journalctl -u stake-resolver -f
MSG
  exit 0
fi

systemctl restart stake-resolver.service
echo "Started. Follow the logs with: journalctl -u stake-resolver -f"
