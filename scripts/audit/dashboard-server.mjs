#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { ROOT, loadConfig, parseArgs } from './core.mjs';
import { appendDecision, buildDashboardState } from './governance.mjs';

function json(response, status, payload) {
  const body = `${JSON.stringify(payload)}\n`;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'"
  });
  response.end(body);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new Error('Request body exceeds 16 KiB');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const host = config.dashboard.host;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Dashboard must bind to loopback');
  const port = Number(args.port || config.dashboard.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Dashboard port must be 1024 through 65535');
  const dashboardFile = resolve(ROOT, 'audit/dashboard/index.local');
  const expectedOrigin = `http://${host}:${port}`;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, expectedOrigin);
      if (request.method === 'GET' && url.pathname === '/') {
        const body = readFileSync(dashboardFile);
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-length': body.length,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer',
          'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'"
        });
        response.end(body);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/state') {
        json(response, 200, buildDashboardState(config));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/favicon.ico') {
        response.writeHead(204, { 'cache-control': 'public, max-age=86400' });
        response.end();
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/decisions') {
        if (request.headers.origin !== expectedOrigin) {
          json(response, 403, { ok: false, error: 'Origin rejected' });
          return;
        }
        if (!String(request.headers['content-type'] || '').startsWith('application/json')) {
          json(response, 415, { ok: false, error: 'JSON required' });
          return;
        }
        const input = await readBody(request);
        if (!buildDashboardState(config).findings.some((finding) => finding.id === input.findingId)) {
          json(response, 404, { ok: false, error: 'Finding ID is not present in the current findings run' });
          return;
        }
        const record = appendDecision(config, input);
        json(response, 201, { ok: true, recordHash: record.recordHash });
        return;
      }
      json(response, 404, { ok: false, error: 'Not found' });
    } catch (error) {
      json(response, 400, { ok: false, error: error.message.slice(0, 300) });
    }
  });
  server.listen(port, host, () => console.log(JSON.stringify({ ok: true, url: expectedOrigin, external: false, production: false }, null, 2)));
}

main().catch((error) => {
  console.error(`Dashboard failed: ${error.message}`);
  process.exit(1);
});
