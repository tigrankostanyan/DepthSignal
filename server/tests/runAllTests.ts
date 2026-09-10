// ==========================================
// UNIFIED TEST RUNNER — runs ALL automated suites in a single command.
//   npx tsx server/tests/runAllTests.ts
//
// Suites:
//   1. Domain (WallEngine, MarketState, Persistence)
//   2. Security Hardening (isolation, rate limiting, SQLi, sessions)
//   3. Billing & Notifications (entitlements, usage, webhooks)
//   4. Telegram Linking (crypto tokens, expiry, notifications)
//   5. Comprehensive Runtime Verification (spawned as child process —
//      it self-executes and manages its own process exit)
// ==========================================

// Load env BEFORE any other imports (same as server.ts)
import '../src/env.js';

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { runAllDomainTests } from './domainTests.js';
import { runSecurityHardeningTests } from './securityHardeningTests.js';
import { runBillingAndNotificationTests } from './billingAndNotificationTests.js';
import { runTelegramLinkingTests } from './telegramLinkingTests.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface NormalizedResult {
  title: string;
  category: string;
  passed: boolean;
  message?: string;
  durationMs?: number;
}

function normalize(raw: any): NormalizedResult {
  return {
    title: (raw as any).title || (raw as any).name || 'Unnamed test',
    category: (raw as any).category || (raw as any).suite || 'UNKNOWN',
    passed: Boolean((raw as any).passed),
    message: (raw as any).message || (raw as any).error,
    durationMs: (raw as any).durationMs
  };
}

function printHeader(text: string) {
  console.log('\n====================================================');
  console.log(`  ${text}`);
  console.log('====================================================');
}

async function runInProcessSuite(name: string, suite: () => Promise<any[]>): Promise<{ total: number; passed: number; failed: number }> {
  printHeader(name);
  const raw = await suite();
  const results = raw.map(normalize);

  let passed = 0;
  let failed = 0;
  for (const res of results) {
    if (res.passed) {
      passed++;
      console.log(`\x1b[32m[PASS]\x1b[0m [${res.category}] ${res.title}`);
    } else {
      failed++;
      console.log(`\x1b[31m[FAIL]\x1b[0m [${res.category}] ${res.title} - ${res.message || 'no message'}`);
    }
  }
  console.log(`\x1b[36m${name}: ${results.length} total | ${passed} passed | ${failed} failed\x1b[0m`);
  return { total: results.length, passed, failed };
}

async function runComprehensiveSuite(): Promise<{ total: number; passed: number; failed: number }> {
  printHeader('Comprehensive Runtime Verification (child process)');
  const script = path.join(__dirname, 'comprehensiveRuntimeVerification.ts');

  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', script], {
      stdio: ['ignore', 'inherit', 'inherit'],
      cwd: process.cwd(),
      shell: true
    });

    child.on('exit', (code) => {
      const passed = code === 0;
      console.log(`\x1b[36mComprehensive Runtime Verification: ${passed ? 'PASSED' : 'FAILED'} (exit code ${code})\x1b[0m`);
      resolve({ total: passed ? 1 : 1, passed: passed ? 1 : 0, failed: passed ? 0 : 1 });
    });

    child.on('error', (err) => {
      console.error(`\x1b[31m[FAIL] Comprehensive Runtime Verification - failed to spawn: ${err.message}\x1b[0m`);
      resolve({ total: 1, passed: 0, failed: 1 });
    });
  });
}

async function main() {
  console.log('====================================================');
  console.log('  RUNNING ALL TEST SUITES');
  console.log('====================================================');

  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;

  const inProcessSuites: Array<[string, () => Promise<any[]>]> = [
    ['Domain Tests', runAllDomainTests],
    ['Security Hardening Tests', runSecurityHardeningTests],
    ['Billing & Notification Tests', runBillingAndNotificationTests],
    ['Telegram Linking Tests', runTelegramLinkingTests],
  ];

  for (const [name, suite] of inProcessSuites) {
    try {
      const { total, passed, failed } = await runInProcessSuite(name, suite);
      grandTotal += total;
      grandPassed += passed;
      grandFailed += failed;
    } catch (err: any) {
      grandTotal += 1;
      grandFailed += 1;
      console.error(`\x1b[31m[FAIL] ${name} - suite crashed: ${err.message || err}\x1b[0m`);
    }
  }

  const comp = await runComprehensiveSuite();
  grandTotal += comp.total;
  grandPassed += comp.passed;
  grandFailed += comp.failed;

  console.log('\n====================================================');
  console.log(`GRAND TOTAL: ${grandTotal} | PASSED: ${grandPassed} | FAILED: ${grandFailed}`);
  console.log('====================================================');

  process.exit(grandFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
