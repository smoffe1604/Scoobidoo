#!/usr/bin/env bash
# Put the current origin/main on hetzner_bils and reload nginx.
# The CSVs are copied from local data/ and are not in git.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="${DEPLOY_SERVER:-hetzner_bils}"
REMOTE=/opt/scoobidoo
HOST=scoobidoo.bils.hair

if [[ ! -f "$ROOT/data/policies.csv" ]]; then
  echo "ERROR: $ROOT/data/policies.csv is missing. Unzip the exercise data first." >&2
  exit 1
fi

ssh "$SERVER" "mkdir -p '$REMOTE' /var/www/$HOST"
ssh "$SERVER" "if [[ ! -d '$REMOTE/.git' ]]; then
    git clone https://github.com/smoffe1604/Scoobidoo.git '$REMOTE'
  else
    git -C '$REMOTE' fetch origin
    git -C '$REMOTE' reset --hard origin/main
  fi"

ssh "$SERVER" "mkdir -p '$REMOTE/data'"
scp "$ROOT"/data/*.csv "$SERVER:$REMOTE/data/"

ssh "$SERVER" "cd '$REMOTE/backend' \
  && python3 -m venv .venv \
  && .venv/bin/pip install -q -r requirements.txt \
  && cd '$REMOTE/frontend' \
  && npm install \
  && npm run build \
  && pm2 delete scoobidoo >/dev/null 2>&1 || true \
  && pm2 start '$REMOTE/ecosystem.config.js' \
  && pm2 save"

ssh "$SERVER" "if [[ ! -f /etc/letsencrypt/live/$HOST/fullchain.pem ]]; then
    cp '$REMOTE/deploy/nginx/$HOST.bootstrap' /etc/nginx/sites-available/$HOST
    ln -sfn /etc/nginx/sites-available/$HOST /etc/nginx/sites-enabled/$HOST
    nginx -t
    systemctl reload nginx
    certbot certonly --webroot -w /var/www/$HOST -d $HOST --non-interactive --keep-until-expiring
  fi
  cp '$REMOTE/deploy/nginx/$HOST' /etc/nginx/sites-available/$HOST
  ln -sfn /etc/nginx/sites-available/$HOST /etc/nginx/sites-enabled/$HOST
  nginx -t
  systemctl reload nginx"

curl --fail --silent --show-error "https://$HOST/health"
echo
echo "Deployment complete: https://$HOST"
