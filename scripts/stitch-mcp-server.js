#!/usr/bin/env node
/**
 * Stitch MCP Server Bridge
 * Connects directly to Google Stitch via @_davideast/stitch-mcp
 * Supports STITCH_API_KEY (direct from env/.env) or gcloud OAuth access token.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Try loading from .env if not present in process.env
if (!process.env.STITCH_API_KEY) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('STITCH_API_KEY=')) {
        process.env.STITCH_API_KEY = trimmed.slice('STITCH_API_KEY='.length).replace(/^["']|["']$/g, '');
        break;
      }
    }
  }
}

function getAccessToken() {
  try {
    const token = execSync('gcloud.cmd auth print-access-token', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (token && token.length > 20) {
      return token;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

const env = { ...process.env };

if (process.env.STITCH_API_KEY) {
  env.STITCH_API_KEY = process.env.STITCH_API_KEY;
} else {
  const token = process.env.STITCH_ACCESS_TOKEN || getAccessToken();
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.STITCH_PROJECT_ID || 'jmd-cart';
  if (!token) {
    console.error('[stitch-mcp-server] Error: Unable to authenticate (no API key or OAuth token).');
    process.exit(1);
  }
  env.STITCH_ACCESS_TOKEN = token;
  env.GOOGLE_CLOUD_PROJECT = project;
  env.STITCH_PROJECT_ID = project;
}

const child = spawn('stitch-mcp.cmd', ['proxy'], {
  shell: true,
  env,
  stdio: ['pipe', 'pipe', 'inherit']
});

process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
