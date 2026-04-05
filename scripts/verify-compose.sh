#!/usr/bin/env bash
# After `docker compose up -d`, checks API directly and through the frontend proxy.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "FAIL: $*" >&2; exit 1; }

check_json() {
  local url=$1
  local label=$2
  code=$(curl -s -o /tmp/dt.json -w "%{http_code}" "$url") || fail "curl $label"
  [[ "$code" == "200" ]] || fail "$label HTTP $code"
  python3 -c "import json; d=json.load(open('/tmp/dt.json')); assert 'temperature' in d" \
    || fail "$label invalid JSON"
  echo "OK $label"
}

check_json "http://127.0.0.1:8000/data" "backend /data"
check_json "http://127.0.0.1:3000/api/data" "frontend nginx /api/data -> backend"
echo "All integration checks passed."
