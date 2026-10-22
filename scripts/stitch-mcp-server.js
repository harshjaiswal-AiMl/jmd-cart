#!/usr/bin/env node
/**
 * Stitch MCP Server Bridge
 * Connects directly to Google Stitch via @_davideast/stitch-mcp
 */
const { spawn, execSync } = require('child_process');

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
    console.error('[stitch-mcp-server] Failed to fetch token via gcloud:', e.message);
  }
  return null;
}

const token = process.env.STITCH_ACCESS_TOKEN || getAccessToken();
const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.STITCH_PROJECT_ID || 'jmd-cart';

if (!token) {
  console.error('[stitch-mcp-server] Error: Unable to obtain Google Cloud access token.');
  process.exit(1);
}

const env = {
  ...process.env,
  STITCH_ACCESS_TOKEN: token,
  GOOGLE_CLOUD_PROJECT: project,
  STITCH_PROJECT_ID: project
};

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
