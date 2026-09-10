// Cross-platform clean script.
// Removes build artefacts for both the server bundle and the Next.js app.
// Usage: npm run clean
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  'dist',
  'server.js',
  'tsconfig.tsbuildinfo',
  'web/.next',
  'web/out',
  'web/tsconfig.tsbuildinfo',
];

for (const target of targets) {
  const absolute = path.join(root, target);
  try {
    await rm(absolute, { recursive: true, force: true });
    console.log(`[clean] removed ${target}`);
  } catch (err) {
    console.warn(`[clean] skipped ${target}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log('[clean] done');
