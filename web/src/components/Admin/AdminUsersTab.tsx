'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import type { AdminUserRow } from '@/lib/api';

interface AdminUsersTabProps {
  users: AdminUserRow[];
  onPlanChange: (userId: string, newPlan: string) => void;
  onRoleChange: (userId: string, newRole: 'TRADER' | 'ADMIN' | 'USER') => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  users,
  onPlanChange,
  onRoleChange,
}) => {
  const [searchUser, setSearchUser] = useState('');

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchUser.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Filter users by name or email..."
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
            className="w-full bg-card border border-divider rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-muted/60 focus:outline-none focus:border-[#168FD6]"
          />
        </div>
        <div className="text-xs text-muted">
          Total Accounts: <strong className="text-white">{users.length}</strong>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card border border-divider rounded-xl overflow-hidden shadow-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface border-b border-divider text-muted font-semibold">
            <tr>
              <th className="p-3">User & Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Subscription Tier</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-surface/50 transition">
                <td className="p-3">
                  <div className="font-bold text-main">{u.displayName}</div>
                  <div className="text-[11px] text-muted font-mono">{u.email}</div>
                  <div className="text-[9px] text-muted font-mono mt-0.5">{u.id}</div>
                </td>
                <td className="p-3">
                  <select
                    value={u.role}
                    onChange={(e) => onRoleChange(u.id, e.target.value as 'TRADER' | 'ADMIN' | 'USER')}
                    className="bg-primary border border-divider rounded px-2 py-1 text-xs text-main focus:outline-none focus:border-[#168FD6]"
                  >
                    <option value="USER">USER</option>
                    <option value="TRADER">TRADER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="p-3">
                  <select
                    value={u.plan || 'FREE'}
                    onChange={(e) => onPlanChange(u.id, e.target.value)}
                    className={`border rounded px-2 py-1 text-xs font-bold focus:outline-none ${
                      u.plan === 'ADVANCED'
                        ? 'bg-[#3B82F6]/15 border-[#3B82F6]/40 text-[#60a5fa]'
                        : u.plan === 'PRO'
                          ? 'bg-[#168FD6]/15 border-[#168FD6]/40 text-[#24C4E8]'
                          : 'bg-primary border-divider text-muted'
                    }`}
                  >
                    <option value="FREE">FREE</option>
                    <option value="PRO">PRO ($49)</option>
                    <option value="ADVANCED">ADVANCED ($149)</option>
                  </select>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      u.status === 'active'
                        ? 'bg-bid/15 text-bid border border-[#0ECB81]/30'
                        : 'bg-panel text-muted'
                    }`}
                  >
                    {u.status || 'active'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => onPlanChange(u.id, u.plan === 'ADVANCED' ? 'FREE' : 'ADVANCED')}
                    className="px-2.5 py-1 rounded bg-panel hover:bg-panel text-xs font-semibold text-main transition cursor-pointer"
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
  );
};
