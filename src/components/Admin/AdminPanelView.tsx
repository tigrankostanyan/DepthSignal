import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Send, 
  RotateCw, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { 
  fetchAdminUsers, 
  updateAdminUserPlan, 
  updateAdminUserRole, 
  fetchAdminNotificationDeliveries, 
  retryNotificationDelivery, 
  fetchAdminStats 
} from '../../lib/api.js';

export const AdminPanelView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'deliveries' | 'stats'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchUser, setSearchUser] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uList, dList, sData] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminNotificationDeliveries(filterStatus || undefined),
        fetchAdminStats()
      ]);
      setUsers(uList);
      setDeliveries(dList.data || []);
      setStats(sData);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load admin data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const handlePlanChange = async (userId: string, newPlan: string) => {
    try {
      await updateAdminUserPlan(userId, newPlan);
      setMessage({ text: `Successfully updated user plan to ${newPlan}`, type: 'success' });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update plan', type: 'error' });
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'TRADER' | 'ADMIN') => {
    try {
      await updateAdminUserRole(userId, newRole);
      setMessage({ text: `Successfully updated user role to ${newRole}`, type: 'success' });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update role', type: 'error' });
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    try {
      await retryNotificationDelivery(deliveryId);
      setMessage({ text: 'Notification re-queued for immediate dispatch', type: 'success' });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to retry notification', type: 'error' });
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchUser.toLowerCase()) || 
    u.name.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0E11] text-[#EAECEF] overflow-hidden">
      {/* Admin Header */}
      <div className="p-4 border-b border-[#2B2F36] bg-[#181A20] flex items-center justify-between flex-none">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-[#F0B90B] flex items-center justify-center font-bold text-black text-sm">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              Administrator Operations Terminal
            </h1>
            <p className="text-xs text-[#848E9C]">
              User tier management, authoritative subscription overrides, and notification delivery queues.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#2B2F36] hover:bg-[#34383F] text-white text-xs font-semibold transition"
        >
          <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Message feedback */}
      {message && (
        <div className={`p-2.5 text-xs flex justify-between items-center ${
          message.type === 'success' ? 'bg-[#0ECB81]/15 text-[#0ECB81] border-b border-[#0ECB81]/30' : 'bg-[#F6465D]/15 text-[#F6465D] border-b border-[#F6465D]/30'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="px-4 pt-3 border-b border-[#2B2F36] bg-[#181A20] flex items-center justify-between flex-none">
        <div className="flex space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-2.5 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'users' ? 'border-[#F0B90B] text-white' : 'border-transparent text-[#848E9C] hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>User & Subscription Directory ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`pb-2.5 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'deliveries' ? 'border-[#F0B90B] text-white' : 'border-transparent text-[#848E9C] hover:text-white'
            }`}
          >
            <Send size={14} />
            <span>Notification Delivery Logs ({deliveries.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`pb-2.5 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'stats' ? 'border-[#F0B90B] text-white' : 'border-transparent text-[#848E9C] hover:text-white'
            }`}
          >
            <Activity size={14} />
            <span>System Telemetry & Metrics</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center justify-between">
              <div className="relative w-72">
                <Search size={14} className="absolute left-3 top-2.5 text-[#848E9C]" />
                <input
                  type="text"
                  placeholder="Filter users by name or email..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full bg-[#181A20] border border-[#2B2F36] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#848E9C] focus:outline-none focus:border-[#F0B90B]"
                />
              </div>
              <div className="text-xs text-[#848E9C]">
                Total Accounts: <strong className="text-white">{users.length}</strong>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E2329] border-b border-[#2B2F36] text-[#848E9C] font-semibold">
                  <tr>
                    <th className="p-3">User & Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Subscription Tier</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Active Alerts</th>
                    <th className="p-3">Watchlist Items</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B2F36]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#1E2329]/50 transition">
                      <td className="p-3">
                        <div className="font-bold text-white">{u.name}</div>
                        <div className="text-[11px] text-[#848E9C] font-mono">{u.email}</div>
                        <div className="text-[9px] text-[#848E9C] font-mono mt-0.5">{u.id}</div>
                      </td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                          className="bg-[#0B0E11] border border-[#2B2F36] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#F0B90B]"
                        >
                          <option value="TRADER">TRADER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          value={u.subscription?.plan || 'FREE'}
                          onChange={(e) => handlePlanChange(u.id, e.target.value)}
                          className={`border rounded px-2 py-1 text-xs font-bold focus:outline-none ${
                            u.subscription?.plan === 'ADVANCED' 
                              ? 'bg-[#3B82F6]/15 border-[#3B82F6]/40 text-[#60a5fa]' 
                              : u.subscription?.plan === 'PRO'
                              ? 'bg-[#F0B90B]/15 border-[#F0B90B]/40 text-[#F0B90B]'
                              : 'bg-[#0B0E11] border-[#2B2F36] text-[#848E9C]'
                          }`}
                        >
                          <option value="FREE">FREE</option>
                          <option value="PRO">PRO ($49)</option>
                          <option value="ADVANCED">ADVANCED ($149)</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          u.subscription?.status === 'active' 
                            ? 'bg-[#0ECB81]/15 text-[#0ECB81] border border-[#0ECB81]/30' 
                            : 'bg-[#2B2F36] text-[#848E9C]'
                        }`}>
                          {u.subscription?.status || 'active'}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-white">
                        {u.usage?.activeAlertRulesCount || 0}
                      </td>
                      <td className="p-3 font-mono font-bold text-white">
                        {u.usage?.totalWatchlistItemsCount || 0}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handlePlanChange(u.id, u.subscription?.plan === 'ADVANCED' ? 'FREE' : 'ADVANCED')}
                          className="px-2.5 py-1 rounded bg-[#2B2F36] hover:bg-[#34383F] text-xs font-semibold text-white transition"
                        >
                          Toggle VIP
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'deliveries' && (
          <div className="space-y-4">
            {/* Status Filter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-[#848E9C]">Filter Status:</span>
                {['', 'pending', 'delivered', 'failed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-2.5 py-1 rounded capitalize transition ${
                      filterStatus === st 
                        ? 'bg-[#F0B90B] text-black font-bold' 
                        : 'bg-[#181A20] text-[#848E9C] hover:text-white border border-[#2B2F36]'
                    }`}
                  >
                    {st || 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Deliveries Table */}
            <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E2329] border-b border-[#2B2F36] text-[#848E9C] font-semibold">
                  <tr>
                    <th className="p-3">ID / Time</th>
                    <th className="p-3">Channel</th>
                    <th className="p-3">Destination</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Attempts</th>
                    <th className="p-3">Error Details</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B2F36]">
                  {deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#848E9C]">
                        No notification deliveries matching this filter.
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((d) => (
                      <tr key={d.id} className="hover:bg-[#1E2329]/50 transition">
                        <td className="p-3">
                          <div className="font-mono text-white text-[11px]">{d.id}</div>
                          <div className="text-[10px] text-[#848E9C]">
                            {new Date(d.createdAt).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-[#2B2F36] font-mono text-[10px] text-[#F0B90B] border border-[#2B2F36]">
                            {d.channel}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-white text-[11px] max-w-xs truncate">
                          {d.destination || 'In-App SSE'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 w-fit ${
                            d.status === 'delivered'
                              ? 'bg-[#0ECB81]/15 text-[#0ECB81] border border-[#0ECB81]/30'
                              : d.status === 'failed'
                              ? 'bg-[#F6465D]/15 text-[#F6465D] border border-[#F6465D]/30'
                              : 'bg-[#F0B90B]/15 text-[#F0B90B] border border-[#F0B90B]/30'
                          }`}>
                            {d.status === 'delivered' && <CheckCircle2 size={11} />}
                            {d.status === 'failed' && <XCircle size={11} />}
                            {d.status === 'pending' && <Clock size={11} />}
                            <span className="uppercase">{d.status}</span>
                          </span>
                        </td>
                        <td className="p-3 font-mono text-white">
                          {d.attempts} / {d.maxAttempts}
                        </td>
                        <td className="p-3 text-[11px] text-[#F6465D] max-w-xs truncate">
                          {d.lastError || '-'}
                        </td>
                        <td className="p-3 text-right">
                          {d.status === 'failed' && (
                            <button
                              onClick={() => handleRetryDelivery(d.id)}
                              className="px-2 py-1 rounded bg-[#F0B90B] hover:bg-[#dfa700] text-black font-bold text-[11px] transition flex items-center space-x-1 ml-auto"
                            >
                              <RotateCw size={11} />
                              <span>Retry</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'stats' && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl p-5">
              <div className="text-[#848E9C] text-xs font-semibold mb-1">Total Registered Accounts</div>
              <div className="text-3xl font-black text-white font-mono">{stats.totalUsers}</div>
              <div className="mt-4 pt-3 border-t border-[#2B2F36] space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#848E9C]">FREE Plan:</span>
                  <span className="font-mono text-white font-bold">{stats.planDistribution?.FREE || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848E9C]">PRO Plan:</span>
                  <span className="font-mono text-[#F0B90B] font-bold">{stats.planDistribution?.PRO || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848E9C]">ADVANCED Plan:</span>
                  <span className="font-mono text-[#3B82F6] font-bold">{stats.planDistribution?.ADVANCED || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl p-5">
              <div className="text-[#848E9C] text-xs font-semibold mb-1">Real-Time WebSocket Streams</div>
              <div className="text-3xl font-black text-[#0ECB81] font-mono">{stats.activeWsClients} Active</div>
              <div className="mt-4 pt-3 border-t border-[#2B2F36] text-xs text-[#848E9C]">
                Active broadcast subscribers receiving synchronized order book depth and ticker ticks.
              </div>
            </div>

            <div className="bg-[#181A20] border border-[#2B2F36] rounded-xl p-5">
              <div className="text-[#848E9C] text-xs font-semibold mb-1">Notification Failures</div>
              <div className="text-3xl font-black text-[#F6465D] font-mono">{stats.failedDeliveriesCount}</div>
              <div className="mt-4 pt-3 border-t border-[#2B2F36] text-xs text-[#848E9C]">
                Permanently failed or blocked SSRF delivery records across all user dispatches.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
