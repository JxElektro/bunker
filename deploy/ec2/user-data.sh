#!/usr/bin/env bash
set -euo pipefail

# cloud-init user-data for Ubuntu 22.04+
#
# What it does:
# - installs Docker + git
# - pulls repo
# - builds and runs the Socket.IO server container
#
# Assumptions:
# - instance has outbound internet
# - port 4040 is allowed by SG (or you proxy via Caddy/Nginx on 443)

REPO_URL="https://github.com/JxElektro/bunker.git"
APP_DIR="/opt/bunker"

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y ca-certificates curl git

# Docker (official convenience script; OK for MVP)
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu || true

mkdir -p "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git pull
fi

cd "$APP_DIR"

docker build -f apps/server/Dockerfile -t bunker-server:latest .

docker rm -f bunker-server || true
docker run -d \
  --restart unless-stopped \
  --name bunker-server \
  -e PORT=4040 \
  -p 4040:4040 \
  bunker-server:latest

