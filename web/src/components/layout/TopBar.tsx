import React from 'react';
import { Activity, Shield, Zap } from 'lucide-react';
import { useApp } from '../../providers/AppProviders.js';

export function TopBar() {
  const { activeExchange, setActiveExchange } = useApp();

  const exchanges = [
    { id: 'BINANCE', name: 'Binance Futures' },
    { id: 'BYBIT', name: 'Bybit Linear' },
    { id: 'STOCK_EXCHANGE', name: 'US Equities' }
  ];

  return (
    <header className="h-14 bg-[#121418] border-b border-[#2B2F36] flex items-center justify-between px-6 select-none">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1.5 bg-[#181A20] p-1 rounded-lg border border-[#2B2F36]">
          {exchanges.map((ex) => (
            <button
              key={ex.id}
              onClick={() => setActiveExchange(ex.id)}
              className={`px-3 py-1 text-xs font-semibold rounded transition ${
                activeExchange === ex.id
                  ? 'bg-[#2B2F36] text-[#F0B90B] shadow'
                  : 'text-[#848E9C] hover:text-white'
              }`}
            >
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-4 text-xs">
        <div className="flex items-center space-x-1.5 text-[#0ECB81] font-mono">
          <span className="w-2 h-2 rounded-full bg-[#0ECB81] animate-pulse" />
          <span>REALTIME FEED OK</span>
        </div>
      </div>
    </header>
  );
}
