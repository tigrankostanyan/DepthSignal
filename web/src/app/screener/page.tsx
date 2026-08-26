import React, { useState } from 'react';
import { useMarketData } from '../../hooks/useMarketData.js';
import { Search, ArrowUpDown, Filter, TrendingUp, TrendingDown } from 'lucide-react';

export default function ScreenerPage() {
  const { tickers, loading } = useMarketData();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'volume24h' | 'change24h' | 'price'>('volume24h');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredTickers = tickers
    .filter((t) => t.symbol.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const valA = a[sortField] || 0;
      const valB = b[sortField] || 0;
      return sortAsc ? valA - valB : valB - valA;
    });

  const handleSort = (field: 'volume24h' | 'change24h' | 'price') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#181A20] p-4 rounded-xl border border-[#2B2F36]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 text-[#848E9C]" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbols (BTC, ETH, SOL...)"
            className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#F0B90B]"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs text-[#848E9C]">
          <span>Total Pairs: <strong className="text-white font-mono">{filteredTickers.length}</strong></span>
        </div>
      </div>

      {/* Ticker Screener Table */}
      <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#2B2F36] bg-[#121418] text-[#848E9C]">
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Symbol</th>
                <th 
                  className="py-3 px-4 font-bold uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Price</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th 
                  className="py-3 px-4 font-bold uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => handleSort('change24h')}
                >
                  <div className="flex items-center space-x-1">
                    <span>24h Change</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th 
                  className="py-3 px-4 font-bold uppercase tracking-wider cursor-pointer hover:text-white"
                  onClick={() => handleSort('volume24h')}
                >
                  <div className="flex items-center space-x-1">
                    <span>24h Volume</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">RSI (14)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2F36]">
              {loading && tickers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#848E9C]">
                    Streaming live order book & ticker feed...
                  </td>
                </tr>
              ) : filteredTickers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#848E9C]">
                    No matching symbols found.
                  </td>
                </tr>
              ) : (
                filteredTickers.map((ticker) => {
                  const isPositive = (ticker.change24h || 0) >= 0;
                  return (
                    <tr key={ticker.symbol} className="hover:bg-[#20232A] transition">
                      <td className="py-3 px-4 font-bold text-white flex items-center space-x-2">
                        <span>{ticker.symbol}</span>
                        <span className="text-[10px] px-1 py-0.5 bg-[#2B2F36] text-[#848E9C] rounded font-mono">
                          {ticker.exchange}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#EAECEF]">
                        ${ticker.price ? ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={`inline-flex items-center space-x-1 ${isPositive ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          <span>{isPositive ? '+' : ''}{(ticker.change24h || 0).toFixed(2)}%</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#848E9C]">
                        ${ticker.volume24h ? (ticker.volume24h / 1_000_000).toFixed(2) + 'M' : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-right text-white">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          (ticker.rsi || 50) > 70 ? 'bg-[#F6465D]/20 text-[#F6465D]' :
                          (ticker.rsi || 50) < 30 ? 'bg-[#0ECB81]/20 text-[#0ECB81]' :
                          'bg-[#2B2F36] text-[#EAECEF]'
                        }`}>
                          {(ticker.rsi || 50).toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
