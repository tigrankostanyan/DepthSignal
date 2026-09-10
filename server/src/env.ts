import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Works both in ESM (tsx dev) and in the esbuild CJS bundle, where
// import.meta is empty and node's native __dirname is available.
const envDir = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

// Candidate locations in priority order:
//  1. server/.env  — dev (server/src/../.env) and prod bundle (dist/../.env -> root/.env)
//  2. process.cwd()/.env — any invocation where .env sits in the working directory
const candidates = [
  path.join(envDir, '../.env'),
  path.join(process.cwd(), '.env'),
];

let loadedFrom: string | null = null;
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    const result = dotenv.config({ path: candidate });
    if (!result.error) {
      loadedFrom = candidate;
      break;
    }
  }
}

if (loadedFrom) {
  console.log('[ENV] Loaded .env from:', loadedFrom);
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.warn('[ENV] GOOGLE_CLIENT_ID is NOT set — Google login will be disabled.');
  }
} else {
  console.warn('[ENV] No .env file found in:', candidates.join(' or '));
}
