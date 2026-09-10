// Production launcher for the full MyScreener stack.
//
// Starts the bundled Express API (dist/server.cjs) and the Next.js frontend
// (web/.next) in a single process tree, forwarding logs and shutting both
// down cleanly on Ctrl+C / SIGTERM.
//
// Usage:
//   npm run build:all   # once, to produce dist/ and web/.next/
//   npm run start:all
//
// Ports (override via env):
//   PORT      -> Express API   (default 3002)
//   WEB_PORT  -> Next.js web   (default 3001)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

const API_PORT = process.env.PORT || '3002';
const WEB_PORT = process.env.WEB_PORT || '3001';

function fail(message) {
  console.error(`\n[start:all] ${message}\n`);
  process.exit(1);
}

// --- Pre-flight checks -------------------------------------------------------
const serverBundle = path.join(root, 'dist', 'server.cjs');
if (!existsSync(serverBundle)) {
  fail('Server bundle not found (dist/server.cjs). Run "npm run build" first.');
}

const webBuild = path.join(root, 'web', '.next');
if (!existsSync(webBuild)) {
  fail('Frontend build not found (web/.next). Run "npm run build:web" first.');
}

const nextBin = path.join(root, 'web', 'node_modules', 'next', 'dist', 'bin', 'next');
if (!existsSync(nextBin)) {
  fail('Next.js is not installed in web/ (web/node_modules/next missing). Run "npm install" inside web/.');
}

// --- Helpers -----------------------------------------------------------------
function pipe(child, label) {
  const prefix = `[${label}] `;
  const forward = (stream, sink) => {
    stream.on('data', (chunk) => {
      const text = chunk.toString().replace(/\n$/, '');
      for (const line of text.split('\n')) {
        sink.write(`${prefix}${line}\n`);
      }
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
}

const children = [];

function shutdown(code = 0) {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(isWindows ? undefined : 'SIGTERM');
    }
  }
  // Give children a moment to exit, then force-exit.
  setTimeout(() => process.exit(code), 300);
}

function start(label, command, args, childCwd, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: childCwd,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  pipe(child, label);
  child.on('exit', (code) => {
    console.log(`\n[start:all] ${label} exited with code ${code}`);
    shutdown(code ?? 0);
  });
  child.on('error', (err) => {
    console.error(`[start:all] failed to start ${label}: ${err.message}`);
    shutdown(1);
  });
  children.push(child);
  return child;
}

// --- Launch ------------------------------------------------------------------
console.log('[start:all] starting API on port %s and web on port %s', API_PORT, WEB_PORT);

start('api', process.execPath, [serverBundle], root, { PORT: API_PORT, NODE_ENV: 'production' });
start('web', process.execPath, [nextBin, 'start', '-p', WEB_PORT], path.join(root, 'web'), { NODE_ENV: 'production' });

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
