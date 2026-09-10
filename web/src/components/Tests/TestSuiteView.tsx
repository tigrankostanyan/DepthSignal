import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Play, ShieldCheck } from 'lucide-react';
import { runDomainTests } from '@/lib/api';
import type { DomainTestResult } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const TestSuiteView: React.FC = () => {
  const [results, setResults] = useState<DomainTestResult[]>([]);
  const [total, setTotal] = useState(0);
  const [passed, setPassed] = useState(0);
  const [failed, setFailed] = useState(0);
  const [running, setRunning] = useState(false);

  const executeTests = async () => {
    try {
      setRunning(true);
      const res = await runDomainTests();
      setResults(res.results || []);
      setTotal(res.total || 0);
      setPassed(res.passed || 0);
      setFailed(res.failed || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    executeTests();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-primary select-none text-xs">
      {/* Header */}
      <div className="flex-none">
        <PageHeader
          icon={<ShieldCheck size={20} />}
          iconClassName="p-2 rounded bg-bid/10 border border-[#0ECB81]/30 text-bid"
          title="Automated Domain Verification Suite"
          subtitle="Validating architectural invariants, cross-exchange isolation, futures mark price reference, and SQLite persistence"
          actions={
            <button
              onClick={executeTests}
              disabled={running}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-[#168FD6] hover:bg-[#1C9AE5] text-white font-bold transition shadow-md shadow-[#168FD6]/20 disabled:opacity-50"
            >
              <Play size={14} className="fill-white text-white" />
              <span>{running ? 'Executing Tests...' : 'Run Automated Tests'}</span>
            </button>
          }
        />
      </div>

      {/* Summary Scorecard */}
      <div className="p-4 bg-card border-b border-divider grid grid-cols-3 gap-4 flex-none">
        <StatCard label="Total Verification Cases" value={total} size="xl" />
        <StatCard label="Tests Passed" value={`${passed} / ${total}`} accent="text-bid" borderClassName="border-[#0ECB81]/30" size="xl" />
        <StatCard label="Tests Failed" value={failed} accent="text-ask" borderClassName="border-[#F6465D]/30" size="xl" />
      </div>

      {/* Test Results List */}
      <div className="flex-1 overflow-auto min-h-0 p-4 space-y-3">
        {results.map((test, idx) => (
          <Card
            key={test.id || idx}
            borderClassName={test.passed ? 'border-[#0ECB81]/30' : 'border-[#F6465D]/50'}
          >
            <div className="p-4 flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {test.passed ? (
                  <CheckCircle2 size={18} className="text-bid mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={18} className="text-ask mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm font-sans">{test.name}</span>
                    <Badge tone="yellow" size="sm">{test.category}</Badge>
                    {test.durationMs !== undefined && (
                      <span className="text-[10px] text-muted font-mono">
                        {test.durationMs}ms
                      </span>
                    )}
                  </div>
                  <div className="text-main text-xs mt-1 font-sans leading-relaxed">
                    {test.message}
                  </div>
                </div>
              </div>

              <Badge tone={test.passed ? 'green' : 'red'} size="md">
                {test.passed ? 'PASSED' : 'FAILED'}
              </Badge>
            </div>

            {test.details && (
              <div className="px-4 pb-4">
                <div className="p-2.5 rounded bg-primary border border-divider font-mono text-[10px] text-muted">
                  <pre>{typeof test.details === 'string' ? test.details : JSON.stringify(test.details, null, 2)}</pre>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
