import { runAllDomainTests } from './domainTests.js';
import { runSecurityHardeningTests } from './securityHardeningTests.js';

async function main() {
  console.log('====================================================');
  console.log('RUNNING DOMAIN & SECURITY HARDENING TEST SUITES');
  console.log('====================================================\n');

  const domainResults = await runAllDomainTests();
  const securityResults = await runSecurityHardeningTests();
  const allResults = [...domainResults, ...securityResults];

  let passed = 0;
  let failed = 0;

  for (const res of allResults) {
    const name = (res as any).title || (res as any).name;
    const cat = (res as any).category || (res as any).suite;
    if (res.passed) {
      passed++;
      console.log(`\x1b[32m[PASS]\x1b[0m [${cat}] ${name}`);
    } else {
      failed++;
      console.log(`\x1b[31m[FAIL]\x1b[0m [${cat}] ${name} - ${(res as any).message}`);
    }
  }

  console.log('\n====================================================');
  console.log(`TOTAL: ${allResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
