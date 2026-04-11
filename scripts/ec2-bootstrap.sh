#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-https://github.com/somenparida/Digital_twin.git}"
PROJECT_DIR="${2:-/home/ec2-user/Digital_twin}"

echo "[1/8] Installing system packages..."
sudo dnf update -y
sudo dnf install -y git docker curl

echo "[2/8] Starting Docker..."
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user || true

# Use sudo for docker commands in current session (group change applies after relogin)
DOCKER="sudo docker"

if ! $DOCKER compose version >/dev/null 2>&1; then
  echo "[3/8] Installing Docker Compose plugin..."
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -SL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

echo "[4/8] Cloning/updating project..."
if [ -d "$PROJECT_DIR/.git" ]; then
  cd "$PROJECT_DIR"
  git fetch origin
  git checkout main
  git pull origin main
else
  rm -rf "$PROJECT_DIR"
  git clone "$REPO_URL" "$PROJECT_DIR"
  cd "$PROJECT_DIR"
  git checkout main
fi

echo "[5/8] Stopping old app containers..."
$DOCKER compose down --remove-orphans || true

echo "[6/8] Building and starting backend + frontend..."
$DOCKER compose up -d --build --remove-orphans backend frontend

echo "[7/8] Waiting for startup..."
for i in $(seq 1 45); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 && \
     curl -fsS http://127.0.0.1:3000/api/data >/dev/null 2>&1; then
    echo "Services are healthy."
    break
  fi
  if [ "$i" -eq 45 ]; then
    echo "Services did not become healthy in time. Showing logs..."
    $DOCKER compose ps
    $DOCKER compose logs --tail 200 backend
    $DOCKER compose logs --tail 120 frontend
    exit 1
  fi
  sleep 2
done

echo "[8/8] Final status..."
$DOCKER compose ps

echo "Done. Test from your laptop:"
echo "  curl -i http://<EC2_PUBLIC_IP>:3000/"
echo "  curl -i http://<EC2_PUBLIC_IP>:3000/api/data"
echo "  curl -i http://<EC2_PUBLIC_IP>:8000/health"
