import React, { useState, useEffect } from 'react';
import { getAlertRules, createAlertRule, deleteAlertRule } from '../../lib/api/alerts.js';
import { AlertRuleDTO } from '../../types/alerts.js';
import { Bell, Plus, Trash2, ShieldCheck, Pause, Play } from 'lucide-react';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRuleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [name, setName] = useState('');
  const [conditionType, setConditionType] = useState('PRICE_ABOVE');
  const [targetPrice, setTargetPrice] = useState('100000');

  const loadAlerts = () => {
    setLoading(true);
    getAlertRules()
      .then(setAlerts)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAlertRule({
      name: name || `${symbol} ${conditionType}`,
      symbol,
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      conditionType,
      targetPrice: parseFloat(targetPrice),
      channels: ['IN_APP', 'TELEGRAM'],
      cooldownMinutes: 15
    });
    setShowModal(false);
    loadAlerts();
  };

  const handleDelete = async (id: string) => {
    await deleteAlertRule(id);
    loadAlerts();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-[#181A20] p-4 rounded-xl border border-[#2B2F36]">
        <div className="flex items-center space-x-2">
          <Bell className="text-[#F0B90B]" size={18} />
          <h2 className="font-bold text-white text-sm uppercase tracking-wide">Real-time Alert Rules</h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 rounded-lg bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black font-bold text-xs flex items-center space-x-1.5 transition"
        >
          <Plus size={14} />
          <span>New Alert</span>
        </button>
      </div>

      <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl overflow-hidden shadow-xl">
        <div className="divide-y divide-[#2B2F36]">
          {loading && alerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#848E9C]">Loading active alert rules...</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#848E9C]">
              No alert rules created yet. Click "New Alert" to configure real-time market notifications.
            </div>
          ) : (
            alerts.map((a) => (
              <div key={a.id} className="p-4 flex items-center justify-between hover:bg-[#20232A] transition text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white">{a.name}</span>
                    <span className="px-1.5 py-0.5 bg-[#2B2F36] text-[#F0B90B] rounded font-mono text-[10px]">
                      {a.symbol}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      a.status === 'ACTIVE' ? 'bg-[#0ECB81]/15 text-[#0ECB81]' : 'bg-[#2B2F36] text-[#848E9C]'
                    }`}>
                      {a.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#848E9C] mt-1">
                    Condition: <strong className="text-white">{a.conditionType}</strong> | Target: ${a.targetPrice?.toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 rounded hover:bg-[#F6465D]/20 text-[#848E9C] hover:text-[#F6465D] transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-4">Create New Alert Rule</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#848E9C] font-bold uppercase mb-1">Symbol</label>
                <input
                  type="text"
                  required
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[#848E9C] font-bold uppercase mb-1">Condition</label>
                <select
                  value={conditionType}
                  onChange={(e) => setConditionType(e.target.value)}
                  className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white"
                >
                  <option value="PRICE_ABOVE">Price Above</option>
                  <option value="PRICE_BELOW">Price Below</option>
                  <option value="VOLUME_SPIKE">Volume Spike</option>
                  <option value="WALL_DETECTED">Wall Detected</option>
                </select>
              </div>

              <div>
                <label className="block text-[#848E9C] font-bold uppercase mb-1">Target Price ($)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full bg-[#0B0E11] border border-[#2B2F36] rounded px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[#2B2F36] hover:bg-[#3B4049] text-white rounded font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-black rounded font-bold"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
