import React from 'react';
import { ShieldAlert, Zap, Trash2 } from 'lucide-react';
import type { AlertRule } from '@/types/index';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface AlertRulesListProps {
  rules: AlertRule[];
  onToggleRule: (rule: AlertRule) => void;
  onDeleteRule: (id: string) => void;
  onCreateClick: () => void;
}

export const AlertRulesList: React.FC<AlertRulesListProps> = ({
  rules,
  onToggleRule,
  onDeleteRule,
  onCreateClick,
}) => {
  if (rules.length === 0) {
    return (
      <div className="p-12 text-center text-muted text-xs bg-card rounded-xl border border-divider">
        <ShieldAlert size={28} className="mx-auto mb-2 opacity-40 text-accent" />
        <div>No alert rules configured.</div>
        <button
          onClick={onCreateClick}
          className="mt-3 px-4 py-1.5 rounded-lg bg-[#168FD6] hover:bg-[#1C9AE5] text-white font-bold text-xs transition cursor-pointer shadow-md shadow-[#168FD6]/20 active:scale-95"
        >
          Create First Alert Rule
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map(rule => (
        <Card
          key={rule.id}
          variant="interactive"
          className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg ${rule.enabled ? 'bg-surface text-accent border border-divider' : 'bg-surface text-muted'}`}>
              <Zap size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm">{rule.name}</span>
                <Badge tone={rule.enabled ? 'green' : 'neutral'} bordered>
                  {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                </Badge>
              </div>
              <div className="text-muted mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                <span>Symbols: <strong className="text-main">{rule.symbols.join(', ')}</strong></span>
                <span>•</span>
                <span>Conditions: <strong className="text-accent">{rule.conditions.map(c => c.type).join(` ${rule.logic} `)}</strong></span>
                <span>•</span>
                <span>Cooldown: <strong className="text-main font-mono">{rule.cooldownSeconds}s</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onToggleRule(rule)}
              className={`px-3 py-1.5 rounded text-xs font-bold border transition ${
                rule.enabled ? 'bg-panel text-accent border-divider' : 'bg-panel text-bid border-divider'
              }`}
            >
              {rule.enabled ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={() => onDeleteRule(rule.id)}
              className="p-1.5 rounded hover:bg-ask/20 text-muted hover:text-ask transition"
              title="Delete rule"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
};