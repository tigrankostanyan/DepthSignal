import React, { useState } from 'react';
import {
  ShieldAlert,
  Plus
} from 'lucide-react';
import type { AlertRule, AlertTrigger } from '@/types/index';
import { PageHeader } from '@/components/ui/PageHeader';
import { AlertCreateForm } from './AlertCreateForm';
import { AlertRulesList } from './AlertRulesList';
import { AlertTriggerFeed } from './AlertTriggerFeed';

interface AlertManagerProps {
  rules: AlertRule[];
  triggers: AlertTrigger[];
  onSaveRule: (rule: Partial<AlertRule>) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onMarkRead: (id?: string) => Promise<void>;
  onClearTriggers: () => Promise<void>;
  onTestSimulation: () => Promise<void>;
}

export const AlertManager: React.FC<AlertManagerProps> = ({
  rules,
  triggers,
  onSaveRule,
  onDeleteRule,
  onMarkRead,
  onClearTriggers,
  onTestSimulation,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'rules' | 'triggers'>('rules');
  const [isCreating, setIsCreating] = useState(false);

  const unreadCount = triggers.filter(t => !t.read).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-primary select-none">
      {/* Alerts Header */}
      <div className="flex-none">
        <PageHeader
          icon={<ShieldAlert size={20} />}
          iconClassName="p-2 rounded bg-surface border border-divider text-accent"
          title="Institutional Alert Engine"
          subtitle="Real-time condition evaluation with cooldown protection and multi-channel adapters"
          actions={
            <div className="flex items-center space-x-2">
              <div className="flex bg-primary rounded p-0.5 border border-divider">
                <button
                  onClick={() => setActiveSubTab('rules')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition ${
                    activeSubTab === 'rules' ? 'bg-panel text-white shadow-sm' : 'text-muted hover:text-white'
                  }`}
                >
                  Active Rules ({rules.length})
                </button>
                <button
                  onClick={() => setActiveSubTab('triggers')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition flex items-center space-x-1.5 ${
                    activeSubTab === 'triggers' ? 'bg-panel text-white shadow-sm' : 'text-muted hover:text-white'
                  }`}
                >
                  <span>Live Trigger Feed</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-ask text-white text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>

              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#168FD6] hover:bg-[#1C9AE5] text-white font-bold text-xs transition shadow-md shadow-[#168FD6]/20 cursor-pointer active:scale-95"
              >
                <Plus size={14} className="text-white" />
                <span>Create Rule</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto min-h-0 p-4">
        {/* CREATE RULE MODAL / FORM */}
        {isCreating && (
          <AlertCreateForm
            onClose={() => setIsCreating(false)}
            onSave={onSaveRule}
          />
        )}

        {/* SUBTAB 1: ACTIVE RULES LIST */}
        {activeSubTab === 'rules' && !isCreating && (
          <AlertRulesList
            rules={rules}
            onToggleRule={(rule) => onSaveRule({ ...rule, enabled: !rule.enabled })}
            onDeleteRule={onDeleteRule}
            onCreateClick={() => setIsCreating(true)}
          />
        )}

        {/* SUBTAB 2: LIVE TRIGGER FEED */}
        {activeSubTab === 'triggers' && (
          <AlertTriggerFeed
            triggers={triggers}
            onMarkRead={onMarkRead}
            onClearTriggers={onClearTriggers}
          />
        )}
      </div>
    </div>
  );
};