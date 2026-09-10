import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Send,
  RotateCw,
  Activity,
  ReceiptText,
} from 'lucide-react';
import {
  fetchAdminUsers,
  adminUpdateUserPlan,
  adminUpdateUserRole,
  fetchAdminDeliveries,
  retryDelivery,
  fetchAdminStats,
  fetchAdminPaymentProofs,
  adminActivateReceipt,
  adminRejectReceipt,
} from '@/lib/api';
import type { AdminUserRow, DeliveryLogRow, AdminStats, AdminPaymentProofRow } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { MessageBanner } from '@/components/ui/MessageBanner';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminDeliveriesTab } from './AdminDeliveriesTab';
import { AdminStatsGrid } from './AdminStatsGrid';
import { AdminReceiptsTab } from './AdminReceiptsTab';

export const AdminPanelView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'deliveries' | 'stats' | 'receipts'>('users');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryLogRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [receipts, setReceipts] = useState<AdminPaymentProofRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uList, dList, sData, rList] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminDeliveries(filterStatus || undefined),
        fetchAdminStats(),
        fetchAdminPaymentProofs(),
      ]);
      setUsers(uList);
      setDeliveries(dList);
      setStats(sData);
      setReceipts(rList);
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
      await adminUpdateUserPlan(userId, newPlan);
      setMessage({ text: `Successfully updated user plan to ${newPlan}`, type: 'success' });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update plan', type: 'error' });
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'TRADER' | 'ADMIN' | 'USER') => {
    try {
      await adminUpdateUserRole(userId, newRole);
      setMessage({ text: `Successfully updated user role to ${newRole}`, type: 'success' });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update role', type: 'error' });
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    try {
      await retryDelivery(deliveryId);
      setMessage({ text: 'Notification re-queued for immediate dispatch', type: 'success' });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to retry notification', type: 'error' });
    }
  };

  const handleActivateReceipt = async (receiptId: string) => {
    try {
      await adminActivateReceipt(receiptId);
      setMessage({ text: 'Plan activated — user subscription upgraded in the database.', type: 'success' });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to activate plan', type: 'error' });
    }
  };

  const handleRejectReceipt = async (receiptId: string) => {
    try {
      await adminRejectReceipt(receiptId);
      setMessage({ text: 'Receipt rejected.', type: 'success' });
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to reject receipt', type: 'error' });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-primary text-main">
      {/* Admin Header */}
      <div className="flex-none">
        <PageHeader
          icon={<ShieldCheck size={18} />}
          iconClassName="w-8 h-8 rounded-lg bg-brand/15 border border-[#168FD6]/30 text-[#24C4E8] flex items-center justify-center text-sm"
          title="Administrator Operations Terminal"
          subtitle="User tier management, authoritative subscription overrides, and notification delivery queues."
          actions={
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-panel hover:bg-panel text-white text-xs font-semibold transition cursor-pointer"
            >
              <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          }
        />
      </div>

      {/* Message feedback */}
      {message && (
        <MessageBanner type={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </MessageBanner>
      )}

      {/* Admin Tabs */}
      <div className="px-4 pt-3 border-b border-divider bg-card flex items-center justify-between flex-none">
        <div className="flex space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-2.5 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'users'
                ? 'border-[#24C4E8] text-[#24C4E8]'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>User & Subscription Directory ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`pb-2.5 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'deliveries'
                ? 'border-[#24C4E8] text-[#24C4E8]'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <Send size={14} />
            <span>Notification Delivery Logs ({deliveries.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`pb-2.5 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'stats'
                ? 'border-[#24C4E8] text-[#24C4E8]'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <Activity size={14} />
            <span>System Telemetry & Metrics</span>
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`pb-2.5 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'receipts'
                ? 'border-[#24C4E8] text-[#24C4E8]'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            <ReceiptText size={14} />
            <span>Payment Receipts ({receipts.filter((r) => r.status === 'pending').length} pending)</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'users' && (
          <AdminUsersTab
            users={users}
            onPlanChange={handlePlanChange}
            onRoleChange={handleRoleChange}
          />
        )}

        {activeTab === 'deliveries' && (
          <AdminDeliveriesTab
            deliveries={deliveries}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            onRetryDelivery={handleRetryDelivery}
          />
        )}

        {activeTab === 'stats' && stats && <AdminStatsGrid stats={stats} />}

        {activeTab === 'receipts' && (
          <AdminReceiptsTab
            receipts={receipts}
            onActivate={handleActivateReceipt}
            onReject={handleRejectReceipt}
          />
        )}
      </div>
    </div>
  );
};