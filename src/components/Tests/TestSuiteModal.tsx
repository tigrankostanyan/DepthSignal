import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Play, ShieldCheck, RefreshCw, Terminal, Cpu } from 'lucide-react';
import { runDomainTests } from '../../lib/api.js';

export const TestSuiteModal: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
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
    <div className="flex-1 flex flex-col h-full bg-[#0B0E11] overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="p-4 border-b border-[#2B2F36] bg-[#181A20] flex items-center justify-between flex-none">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-[#0ECB81]/10 border border-[#0ECB81]/30 text-[#0ECB81]">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white uppercase tracking-tight">Automated Domain Verification Suite</h1>
            <p className="text-xs text-[#848E9C]">
              Validating architectural invariants, cross-exchange isolation, futures mark price reference, and SQLite persistence
            </p>
          </div>
        </div>

        <button
          onClick={executeTests}
          disabled={running}
          className="flex items-center space-x-1.5 px-4 py-2 rounded bg-[#0ECB81] hover:bg-[#0ECB81]/90 text-black font-bold transition shadow disabled:opacity-50"
        >
          <Play size={14} className="fill-black" />
          <span>{running ? 'Executing Tests...' : 'Run Automated Tests'}</span>
        </button>
      </div>

      {/* Summary Scorecard */}
      <div className="p-4 bg-[#181A20] border-b border-[#2B2F36] grid grid-cols-3 gap-4 flex-none">
        <div className="bg-[#1E2329] p-3 rounded-lg border border-[#2B2F36]">
          <div className="text-[10px] text-[#848E9C] font-semibold uppercase">Total Verification Cases</div>
          <div className="text-xl font-bold font-mono text-white mt-1">{total}</div>
        </div>

        <div className="bg-[#1E2329] p-3 rounded-lg border border-[#0ECB81]/30">
          <div className="text-[10px] text-[#0ECB81] font-semibold uppercase">Tests Passed</div>
          <div className="text-xl font-bold font-mono text-[#0ECB81] mt-1">{passed} / {total}</div>
        </div>

        <div className="bg-[#1E2329] p-3 rounded-lg border border-[#F6465D]/30">
          <div className="text-[10px] text-[#F6465D] font-semibold uppercase">Tests Failed</div>
          <div className="text-xl font-bold font-mono text-[#F6465D] mt-1">{failed}</div>
        </div>
      </div>

      {/* Test Results List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {results.map((test, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-xl border transition shadow-lg ${
              test.passed
                ? 'bg-[#181A20] border-[#0ECB81]/30'
                : 'bg-[#181A20] border-[#F6465D]/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {test.passed ? (
                  <CheckCircle2 size={18} className="text-[#0ECB81] mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={18} className="text-[#F6465D] mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm font-sans">{test.title || test.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#0B0E11] text-[#F0B90B] text-[10px] font-mono border border-[#2B2F36]">
                      {test.category || test.suite}
                    </span>
                    {test.durationMs !== undefined && (
                      <span className="text-[10px] text-[#848E9C] font-mono">
                        {test.durationMs}ms
                      </span>
                    )}
                  </div>
                  <div className="text-[#EAECEF] text-xs mt-1 font-sans leading-relaxed">
                    {test.message}
                  </div>
                </div>
              </div>

              <span className={`px-2.5 py-0.5 rounded font-mono font-bold text-xs ${
                test.passed ? 'bg-[#0ECB81]/20 text-[#0ECB81]' : 'bg-[#F6465D]/20 text-[#F6465D]'
              }`}>
                {test.passed ? 'PASSED' : 'FAILED'}
              </span>
            </div>

            {test.details && (
              <div className="mt-3 p-2.5 rounded bg-[#0B0E11] border border-[#2B2F36] font-mono text-[10px] text-[#848E9C]">
                <pre>{JSON.stringify(test.details, null, 2)}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
