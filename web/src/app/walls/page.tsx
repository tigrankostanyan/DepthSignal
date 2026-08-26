import React, { useState, useEffect } from 'react';
import { getWallClusters } from '../../lib/api/walls.js';
import { WallCluster } from '../../types/market.js';
import { Layers, RefreshCw, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function WallsPage() {
  const [walls, setWalls] = useState<WallCluster[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWalls = () => {
    setLoading(true);
    getWallClusters(50000)
      .then(setWalls)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWalls();
    const interval = setInterval(fetchWalls, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-[#181A20] p-4 rounded-xl border border-[#2B2F36]">
        <div className="flex items-center space-x-2">
          <Layers className="text-[#F0B90B]" size={18} />
          <h2 className="font-bold text-white text-sm uppercase tracking-wide">Liquidity Wall Clusters</h2>
        </div>
        <button
          onClick={fetchWalls}
          disabled={loading}
          className="p-1.5 rounded-lg bg-[#2B2F36] hover:bg-[#3B4049] text-white transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BUY WALLS */}
        <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl p-4 shadow-xl">
          <div className="text-xs font-bold text-[#0ECB81] uppercase mb-3 flex items-center space-x-1.5">
            <ArrowUpRight size={14} />
            <span>Support Buy Walls (&gt; $50K USD)</span>
          </div>
          <div className="space-y-2">
            {walls.filter(w => w.side === 'BUY').length === 0 ? (
              <div className="text-xs text-[#848E9C] py-4 text-center">Scanning depth for buy walls...</div>
            ) : (
              walls.filter(w => w.side === 'BUY').map((w) => (
                <div key={w.id} className="flex items-center justify-between p-2 rounded bg-[#0B0E11] border border-[#2B2F36] text-xs font-mono">
                  <div>
                    <span className="font-bold text-white mr-2">{w.symbol}</span>
                    <span className="text-[#0ECB81] font-bold">${w.priceLevel.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#848E9C] mr-2">-{w.distancePct.toFixed(2)}%</span>
                    <span className="text-[#EAECEF] font-bold">${(w.volumeUsd / 1000).toFixed(0)}k</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SELL WALLS */}
        <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl p-4 shadow-xl">
          <div className="text-xs font-bold text-[#F6465D] uppercase mb-3 flex items-center space-x-1.5">
            <ArrowDownRight size={14} />
            <span>Resistance Sell Walls (&gt; $50K USD)</span>
          </div>
          <div className="space-y-2">
            {walls.filter(w => w.side === 'SELL').length === 0 ? (
              <div className="text-xs text-[#848E9C] py-4 text-center">Scanning depth for sell walls...</div>
            ) : (
              walls.filter(w => w.side === 'SELL').map((w) => (
                <div key={w.id} className="flex items-center justify-between p-2 rounded bg-[#0B0E11] border border-[#2B2F36] text-xs font-mono">
                  <div>
                    <span className="font-bold text-white mr-2">{w.symbol}</span>
                    <span className="text-[#F6465D] font-bold">${w.priceLevel.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#848E9C] mr-2">+{w.distancePct.toFixed(2)}%</span>
                    <span className="text-[#EAECEF] font-bold">${(w.volumeUsd / 1000).toFixed(0)}k</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
