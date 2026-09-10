import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Unlink,
  Check,
  Copy,
  Loader2,
  BellRing,
} from 'lucide-react';
import type { TelegramStatusResponse, UserSettings } from '@/types/index';
import { createTelegramLinkToken, disconnectTelegram, fetchTelegramStatus, sendTelegramTestAlert } from '@/lib/api';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Badge } from '@/components/ui/Badge';
import { MessageBanner } from '@/components/ui/MessageBanner';
import { Modal } from '@/components/ui/Modal';

const inputCls =
  'w-full bg-primary border border-divider rounded px-3 py-2 text-white font-mono focus:border-[#168FD6] focus:outline-none';

interface TelegramSectionProps {
  form: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
}

export const TelegramSection: React.FC<TelegramSectionProps> = ({ form, onChange }) => {
  const [tgStatus, setTgStatus] = useState<TelegramStatusResponse | null>(null);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null);
  const [tgCopied, setTgCopied] = useState(false);
  const [tgTestMsg, setTgTestMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tgTesting, setTgTesting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const loadTelegramStatus = async () => {
    try {
      const status = await fetchTelegramStatus();
      setTgStatus(status);
      if (status.connected && status.telegramChatId) {
        onChange({ telegramChatId: status.telegramChatId });
      }
    } catch (e) {
      // Ignore if not logged in
    }
  };

  useEffect(() => {
    loadTelegramStatus();
  }, []);

  const handleGenerateTelegramLink = async () => {
    setTgLoading(true);
    setTgTestMsg(null);
    try {
      const tokenResp = await createTelegramLinkToken();
      setTgDeepLink(tokenResp.deepLink);
    } catch (err: any) {
      setTgTestMsg({ type: 'error', text: err.message || 'Failed to generate linking token' });
    } finally {
      setTgLoading(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    setConfirmDisconnect(false);
    setTgLoading(true);
    try {
      await disconnectTelegram();
      setTgDeepLink(null);
      setTgTestMsg({ type: 'success', text: 'Telegram account disconnected.' });
      await loadTelegramStatus();
    } catch (err: any) {
      setTgTestMsg({ type: 'error', text: err.message || 'Failed to disconnect Telegram' });
    } finally {
      setTgLoading(false);
    }
  };

  const handleSendTestAlert = async () => {
    setTgTesting(true);
    setTgTestMsg(null);
    try {
      const res = await sendTelegramTestAlert();
      if (res.success) {
        setTgTestMsg({ type: 'success', text: `Test alert sent successfully! (Msg ID: ${res.messageId || 'OK'})` });
      } else {
        setTgTestMsg({ type: 'error', text: res.error || 'Failed to deliver test alert' });
      }
    } catch (err: any) {
      setTgTestMsg({ type: 'error', text: err.message || 'Test alert delivery failed' });
    } finally {
      setTgTesting(false);
    }
  };

  const handleCopyDeepLink = () => {
    if (!tgDeepLink) return;
    navigator.clipboard.writeText(tgDeepLink);
    setTgCopied(true);
    setTimeout(() => setTgCopied(false), 2000);
  };

  return (
    <Card className="p-4">
      <SectionHeader
        icon={<Send size={14} className="text-accent" />}
        title="Telegram Alerts & External Webhooks"
        actions={
          tgStatus && (
            <Badge tone={tgStatus.connected ? 'green' : 'neutral'} bordered>
              {tgStatus.connected ? 'TELEGRAM CONNECTED' : 'TELEGRAM NOT LINKED'}
            </Badge>
          )
        }
      />

      {/* User-friendly 1-Click Telegram Deep Link Connection Box */}
      <div className="mb-4 p-4 rounded-lg bg-primary border border-divider">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white text-xs">Direct Telegram Account Linking</span>
              {tgStatus?.connected && (
                <span className="text-[10px] bg-bid/20 text-bid px-1.5 py-0.5 rounded font-mono">
                  {tgStatus.telegramUsername || `ID: ${tgStatus.telegramChatId}`}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              {tgStatus?.connected
                ? 'Your Telegram account is actively linked. Real-time market breakout alerts & wall triggers are sent directly to your chat.'
                : 'Connect your Telegram account in 1 click without manually finding your chat ID. Alerts are delivered instantly.'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {tgStatus?.connected ? (
              <>
                <button
                  type="button"
                  disabled={tgTesting}
                  onClick={handleSendTestAlert}
                  className="px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 text-[#24C4E8] border border-[#168FD6]/40 font-bold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  {tgTesting ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />}
                  <span>Send Test Alert</span>
                </button>
                <button
                  type="button"
                  disabled={tgLoading}
                  onClick={() => setConfirmDisconnect(true)}
                  className="px-3 py-1.5 rounded bg-ask/10 hover:bg-ask/20 text-ask border border-[#F6465D]/30 font-bold transition flex items-center space-x-1.5"
                >
                  <Unlink size={12} />
                  <span>Disconnect</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={tgLoading}
                onClick={handleGenerateTelegramLink}
                className="px-4 py-1.5 rounded bg-[#0088cc] hover:bg-[#0088cc]/90 text-white font-bold transition flex items-center space-x-1.5 shadow"
              >
                {tgLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Connect Telegram</span>
              </button>
            )}
          </div>
        </div>

        {/* Generated Deep Link Modal/Drawer */}
        {tgDeepLink && !tgStatus?.connected && (
          <div className="mt-3 pt-3 border-t border-divider space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-accent">Step 1: Open Link in Telegram and click START</span>
              <span className="text-[10px] text-muted">Expires in 10 minutes</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={tgDeepLink}
                className="flex-1 bg-card border border-divider rounded px-2.5 py-1.5 text-xs text-main font-mono"
              />
              <button
                type="button"
                onClick={handleCopyDeepLink}
                className="px-2.5 py-1.5 rounded bg-panel hover:bg-panel text-white transition flex items-center space-x-1"
                title="Copy Link"
              >
                {tgCopied ? <Check size={13} className="text-bid" /> : <Copy size={13} />}
                <span>{tgCopied ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={tgDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded bg-[#0088cc] hover:bg-[#0088cc]/90 text-white font-bold transition flex items-center space-x-1"
              >
                <span>Open Bot</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}

        {/* Test alert / Status feedback message */}
        {tgTestMsg && (
          <MessageBanner type={tgTestMsg.type === 'success' ? 'success' : 'error'} className="mt-3 rounded">
            <span className="flex items-center space-x-2">
              {tgTestMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{tgTestMsg.text}</span>
            </span>
          </MessageBanner>
        )}
      </div>

      {/* Manual Webhook & Chat ID Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Custom Webhook URL (JSON payload POST)">
          <input
            type="url"
            placeholder="https://api.yourdomain.com/trading-alerts"
            value={form.webhookUrl || ''}
            onChange={(e) => onChange({ webhookUrl: e.target.value })}
            className={inputCls}
          />
        </FormField>

        <FormField label="Manual Telegram Chat / Group ID (Optional)">
          <input
            type="text"
            placeholder="-1001234567890"
            value={form.telegramChatId || ''}
            onChange={(e) => onChange({ telegramChatId: e.target.value })}
            className={inputCls}
          />
        </FormField>
      </div>

      <Modal
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        title="Disconnect Telegram?"
        description="Are you sure you want to disconnect your Telegram account from MyScreener alerts?"
        footer={
          <>
            <button
              onClick={() => setConfirmDisconnect(false)}
              className="px-3 py-1.5 rounded bg-panel hover:bg-panel text-white text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDisconnectTelegram}
              disabled={tgLoading}
              className="px-3 py-1.5 rounded bg-ask hover:bg-[#f6465d]/90 text-white text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-60"
            >
              {tgLoading && <Loader2 size={12} className="animate-spin" />}
              <span>Disconnect</span>
            </button>
          </>
        }
      />
    </Card>
  );
};