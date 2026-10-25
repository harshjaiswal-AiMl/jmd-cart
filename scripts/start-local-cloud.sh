#!/usr/bin/env bash
set -e

echo "=== JMD Cart: Starting Local Environment with Live GCP Database & Cloud Images ==="

# Check gcloud authentication
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "Error: gcloud is not authenticated. Run 'gcloud auth login' first."
  exit 1
fi

# Ensure cloud-sql-proxy binary is in PATH
PROXY_BIN="$HOME/.local/bin/cloud-sql-proxy"
if [ ! -f "$PROXY_BIN" ]; then
  PROXY_BIN=$(which cloud-sql-proxy 2>/dev/null || true)
fi

if [ -z "$PROXY_BIN" ] || [ ! -f "$PROXY_BIN" ]; then
  echo "Downloading Google Cloud SQL Auth Proxy..."
  mkdir -p "$HOME/.local/bin"
  curl -fsSL -o "$HOME/.local/bin/cloud-sql-proxy" https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.2/cloud-sql-proxy.linux.amd64
  chmod +x "$HOME/.local/bin/cloud-sql-proxy"
  PROXY_BIN="$HOME/.local/bin/cloud-sql-proxy"
fi

# Start Cloud SQL proxy on port 5433 in background if not already running
if ! nc -z 127.0.0.1 5433 2>/dev/null && ! (echo > /dev/tcp/127.0.0.1/5433) 2>/dev/null; then
  echo "Starting Google Cloud SQL Auth Proxy on 127.0.0.1:5433..."
  "$PROXY_BIN" jmd-cart:asia-south1:jmd-cart-db --port 5433 -g > /tmp/cloud-sql-proxy.log 2>&1 &
  PROXY_PID=$!
  sleep 2
  echo "Cloud SQL Proxy running (PID $PROXY_PID)."
else
  echo "Cloud SQL Proxy is already running on port 5433."
fi

echo "Starting Next.js Dev Server on http://localhost:3000..."
pnpm dev
