import { Request, Response, NextFunction } from 'express';
import { SSEManager } from '../services/realtime/sseManager.js';
import { BillingProvider } from '../services/billing/BillingProvider.js';
import { runAllDomainTests } from '../../tests/domainTests.js';
import { runSecurityHardeningTests } from '../../tests/securityHardeningTests.js';
import { runBillingAndNotificationTests } from '../../tests/billingAndNotificationTests.js';
import { runTelegramLinkingTests } from '../../tests/telegramLinkingTests.js';

//  system controller
export class SystemController {
  constructor(
    private readonly sseManager: SSEManager,
    private readonly billingProvider: BillingProvider
  ) {}

  // Health endpoint
  health = (_req: Request, res: Response): void => {
    res.json({
      status: 'ok',
      time: Date.now(),
      connections: this.sseManager.getActiveClientCount()
    });
  };

  // Integrations status endpoint
  integrationsStatus = (_req: Request, res: Response): void => {
    res.json({
      billing: this.billingProvider.isConfigured,
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      email: Boolean(process.env.SMTP_HOST),
      webhook: Boolean(process.env.WEBHOOK_SIGNING_SECRET)
    });
  };

  // Run tests endpoint
  runTests = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const domainResults = await runAllDomainTests();
      const securityResults = await runSecurityHardeningTests();
      const billingResults = await runBillingAndNotificationTests();
      const telegramResults = await runTelegramLinkingTests();
      const allResults = [...domainResults, ...securityResults, ...billingResults, ...telegramResults];

      res.json({
        total: allResults.length,
        passed: allResults.filter((r) => r.passed).length,
        failed: allResults.filter((r) => !r.passed).length,
        results: allResults
      });
    } catch (e: any) {
      next(e);
    }
  };
}
